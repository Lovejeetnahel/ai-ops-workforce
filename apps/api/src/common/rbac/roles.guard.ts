import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { tenantContext } from '../tenancy/tenant-context';

/** Higher number = more privilege. CUSTOMER is portal-only, lowest. */
const RANK: Record<UserRole, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const store = tenantContext.get();
    if (!store?.role) throw new ForbiddenException('Authentication required');

    const userRank = RANK[store.role as UserRole] ?? -1;
    const minRequired = Math.min(...required.map((r) => RANK[r]));

    if (userRank < minRequired) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
