import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to one or more roles. Roles are hierarchical and resolved in
 * RolesGuard (OWNER ⊇ ADMIN ⊇ STAFF; CUSTOMER is a separate portal audience).
 *
 * @example @Roles('ADMIN') — owner & admin may access.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
