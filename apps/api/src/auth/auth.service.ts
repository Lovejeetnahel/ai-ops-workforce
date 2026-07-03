import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

/**
 * Auth issues short-lived access tokens carrying the tenant id (`tid`) and role.
 * Passwords are hashed with bcrypt (12 rounds). Login fetches by email then
 * compares in memory so bcrypt's per-hash salt is respected.
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

    const claims = { sub: user.id, tid: user.tenantId, role: user.role };
    const accessToken = await this.jwt.signAsync(claims, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...claims, typ: 'refresh' },
      { expiresIn: process.env.REFRESH_EXPIRES_IN ?? '30d' },
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
    };
  }
}
