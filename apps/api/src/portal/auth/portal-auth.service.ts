import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Portal authentication — a SEPARATE principal from staff `User`. Login resolves
 * the tenant from its slug (the portal is tenant-branded), then verifies the
 * CustomerPortalUser within that tenant. The issued token carries `cid` (the
 * Contact id) and role=CUSTOMER, which the PortalGuard + per-customer scoping
 * rely on. Password hashing reuses AuthService.hash/verify (bcrypt, 12 rounds).
 */
@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly bus: EventBus,
  ) {}

  async login(tenantSlug: string, email: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.customerPortalUser.findFirst({
      where: { tenantId: tenant.id, email, status: 'ACTIVE' },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await AuthService.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.customerPortalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, tid: tenant.id, role: 'CUSTOMER', cid: user.contactId, aud: 'portal' },
      { expiresIn: process.env.REFRESH_EXPIRES_IN ?? '30d' },
    );
    return { accessToken, customer: { id: user.id, contactId: user.contactId, email: user.email } };
  }

  /** Business-side: provision portal access for an existing CRM contact. */
  async createForContact(contactId: string, email: string, password: string) {
    const portalUser = await this.prisma.db.customerPortalUser.create({
      data: { contactId, email, passwordHash: await AuthService.hash(password) } as any,
    });
    await this.bus.emit({
      name: DomainEvents.PORTAL_USER_CREATED,
      tenantId: tenantContext.tenantId,
      payload: { portalUser: { id: portalUser.id }, contact: { id: contactId } },
    });
    return { id: portalUser.id, contactId, email };
  }
}
