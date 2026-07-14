import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/**
 * Gates the Contact-submission retrieval/triage endpoints.
 *
 * There is no cross-tenant "platform admin" concept anywhere in this product
 * today — every User and every role (CUSTOMER/STAFF/ADMIN/OWNER) belongs to
 * exactly one tenant, and RolesGuard only ever ranks within that tenant. A
 * PublicContactSubmission has no tenant (a prospect submitted it before
 * signing up), so no tenant's JWT — not even an OWNER's — is a meaningful
 * authorization for it. Rather than inventing a new cross-tenant user/role
 * concept for one small feature, this uses a single shared operator secret
 * (ADMIN_API_TOKEN, required in production — see main.ts validateEnv()),
 * sent as the `X-Admin-Token` header. Compared in constant time to avoid
 * leaking the secret via response-time timing.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_TOKEN;
    if (!expected) throw new UnauthorizedException('Admin access is not configured');

    const provided = ctx.switchToHttp().getRequest().headers['x-admin-token'];
    if (typeof provided !== 'string' || !provided) throw new UnauthorizedException('Missing admin token');

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }
}
