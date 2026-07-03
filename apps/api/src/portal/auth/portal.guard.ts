import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Guards customer-portal routes. A valid portal token carries role=CUSTOMER and
 * a `contactId` (set by TenantMiddleware from the `cid` claim). Staff tokens
 * have no `contactId` and a higher role, so they are rejected here — portal and
 * internal surfaces are strictly separated. Tenant isolation is still enforced
 * by the tenant-scoped Prisma client; this adds per-customer scoping.
 */
@Injectable()
export class PortalGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    const store = tenantContext.get();
    if (!store?.contactId || store.role !== 'CUSTOMER') {
      throw new UnauthorizedException('Customer portal authentication required');
    }
    return true;
  }
}

/** Convenience accessor for the authenticated customer's Contact id. */
export function currentContactId(): string {
  const id = tenantContext.get()?.contactId;
  if (!id) throw new UnauthorizedException('No portal session');
  return id;
}
