import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // matches REFRESH_EXPIRES_IN default
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Auth issues short-lived access tokens carrying the tenant id (`tid`) and role,
 * plus a longer-lived refresh token. Passwords are hashed with bcrypt (12
 * rounds). Login fetches by email then compares in memory so bcrypt's
 * per-hash salt is respected.
 *
 * Refresh tokens are tracked in `RefreshToken` (hash only, never the raw
 * token) so they can be revoked — on explicit logout, and on password reset
 * (which revokes every outstanding session for that user). The JWT itself
 * remains the source of truth for expiry/signature; the table only answers
 * "has this one been revoked."
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  static async hash(pw: string): Promise<string> {
    return hash(pw, BCRYPT_ROUNDS);
  }

  /** Constant-time bcrypt comparison — returns true if pw matches hash. */
  static async verify(pw: string, hashed: string): Promise<boolean> {
    return compare(pw, hashed);
  }

  async login(email: string, password: string) {
    // No tenant context on the login route → query the base client directly.
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await AuthService.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Checked AFTER password verification: reaching this branch already proves
    // the caller knows the correct password, so a distinct message here does
    // not help an attacker enumerate accounts by guessing passwords blind.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { status: true } });
    if (user.status !== 'ACTIVE' || tenant?.status !== 'ACTIVE') {
      throw new ForbiddenException('This account is not active. Contact support for help.');
    }

    return this.issueSession(user.id, user.tenantId, user.role);
  }

  private async issueSession(userId: string, tenantId: string, role: string) {
    const claims = { sub: userId, tid: tenantId, role };
    const accessToken = await this.jwt.signAsync(claims, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    });
    // `jti` guarantees this refresh JWT is unique even when issued for the same
    // user within the same second (same claims + iat would otherwise sign to
    // the byte-identical token — e.g. two tabs logging in at once, or an
    // immediate refresh-after-login — which previously crashed the following
    // insert on RefreshToken's unique tokenHash constraint).
    const refreshToken = await this.jwt.signAsync(
      { ...claims, typ: 'refresh', jti: randomBytes(16).toString('hex') },
      { expiresIn: process.env.REFRESH_EXPIRES_IN ?? '30d' },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
    };
  }

  /**
   * Exchanges a valid, unrevoked refresh token for a new access+refresh pair
   * (rotation: the old refresh token is revoked the moment a new one is
   * issued, so a leaked-then-reused token is a detectable signal, not a
   * silent standing credential).
   */
  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

    const tokenHash = sha256(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueSession(user.id, user.tenantId, user.role);
  }

  /** Revokes one refresh token. Idempotent and forgiving — logout never fails visibly. */
  async logout(refreshToken?: string): Promise<{ ok: true }> {
    if (refreshToken) {
      await this.prisma.refreshToken
        .updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  /**
   * Requests a password reset. Always resolves the same way regardless of
   * whether the email matches an account — callers must never branch on this
   * to decide what to tell the user (see PasswordResetController).
   * Email can belong to more than one User (email is unique per-tenant, not
   * globally) — every matching ACTIVE user gets their own single-use token
   * and their own email.
   */
  async requestPasswordReset(email: string, sendEmail: (userId: string, tenantId: string, name: string, rawToken: string) => Promise<void>) {
    const users = await this.prisma.user.findMany({ where: { email, status: 'ACTIVE' } });
    await Promise.all(
      users.map(async (u) => {
        const rawToken = randomBytes(32).toString('hex');
        await this.prisma.passwordResetToken.create({
          data: { userId: u.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        });
        await sendEmail(u.id, u.tenantId, u.name, rawToken).catch(() => undefined);
      }),
    );
  }

  /**
   * Redeems a password-reset token. Every failure path (not found, expired,
   * already used) throws the SAME message — the reset token itself is a
   * secret, but distinguishing "expired" from "wrong" from "reused" to an
   * unauthenticated caller would leak whether a guessed token was ever real.
   */
  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = sha256(rawToken);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    const invalid = !row || row.usedAt || row.expiresAt < new Date();
    if (invalid) throw new UnauthorizedException('This reset link is invalid or has expired.');

    const user = await this.prisma.user.findUnique({ where: { id: row!.userId } });
    if (!user) throw new UnauthorizedException('This reset link is invalid or has expired.');

    const passwordHash = await AuthService.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: row!.id }, data: { usedAt: new Date() } }),
      // Revoke every outstanding session — a password reset should log out
      // every device, including whoever the token was reset to escape from.
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    // Written via the BASE (un-extended) client with an explicit tenantId, not
    // `.db` + tenantContext.run(): this call originates from a public route with
    // no ambient request-scoped tenant context (unlike normal authenticated
    // requests, where TenantMiddleware already established one for the whole
    // request lifetime), and a one-off nested tenantContext.run() here is not
    // reliably visible to the Prisma extension's query hook by the time it
    // actually dispatches — same pattern already used for the other
    // request-agnostic writes in GLOBAL_MODELS.
    await this.prisma.auditLog
      .create({
        data: { tenantId: user.tenantId, actorId: user.id, action: 'user.password_reset', entity: 'User', entityId: user.id, diff: {} },
      })
      .catch(() => undefined);

    return { ok: true };
  }
}
