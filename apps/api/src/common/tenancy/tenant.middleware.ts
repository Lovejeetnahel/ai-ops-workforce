import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { tenantContext } from './tenant-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves the active tenant for every request and runs the rest of the request
 * inside its AsyncLocalStorage context. Two resolution paths:
 *
 *  1. Authenticated app/portal requests → tenant from the JWT `tid` claim.
 *  2. Provider webhooks (no JWT) → tenant from the `X-Tenant-Id` header that we
 *     embed in the webhook URL we registered with Twilio/Vapi/Stripe.
 *
 * Routes under /api/auth and /api/webhooks/* may carry the tenant via header
 * instead of a token.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let userId: string | undefined;
    let role: string | undefined;
    let contactId: string | undefined;
    let scopes: string[] | undefined;
    let apiKeyId: string | undefined;
    let rateLimitPerMin: number | undefined;

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload: any = this.jwt.verify(auth.slice(7));
        // Reject refresh tokens used as access tokens — they carry typ:'refresh'
        if (payload.typ === 'refresh') throw new UnauthorizedException('Refresh token cannot be used as access token');
        tenantId = payload.tid;
        userId = payload.sub;
        role = payload.role;
        contactId = payload.cid; // present on customer-portal tokens
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Public API key (x-api-key) → resolve tenant + scopes.
    const apiKey = req.headers['x-api-key'];
    if (!tenantId && typeof apiKey === 'string') {
      const row = await this.prisma.apiKey.findUnique({ where: { hashedKey: createHash('sha256').update(apiKey).digest('hex') } });
      if (!row || row.revoked || (row.expiresAt && row.expiresAt < new Date())) {
        throw new UnauthorizedException('Invalid API key');
      }
      tenantId = row.tenantId;
      role = 'API';
      scopes = row.scopes;
      apiKeyId = row.id;
      rateLimitPerMin = row.rateLimitPerMin;
      this.prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }

    // Webhooks: trust the signed tenant id baked into the registered URL.
    if (!tenantId && typeof req.headers['x-tenant-id'] === 'string') {
      tenantId = req.headers['x-tenant-id'];
    }

    if (!tenantId) {
      // Public routes (login, health) — continue without a tenant context.
      return next();
    }

    tenantContext.run({ tenantId, userId, role, contactId, scopes, apiKeyId, rateLimitPerMin }, () => next());
  }
}
