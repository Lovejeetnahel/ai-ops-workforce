import { Injectable } from '@nestjs/common';
import { IndustryModule, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AutomationService } from '../automation/automation.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * Tenant provisioning. Creating a business is the moment the whole product
 * "becomes" an HVAC tool or an immigration tool: we set industryModule and seed
 * that vertical's automation presets. Everything downstream reads the module
 * config from there.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: AutomationService,
  ) {}

  async provision(dto: { name: string; ownerEmail: string; ownerPassword: string; industryModule: IndustryModule }) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Tenant + owner created outside tenant context (base client).
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        industryModule: dto.industryModule,
        users: {
          create: {
            email: dto.ownerEmail,
            passwordHash: await AuthService.hash(dto.ownerPassword),
            name: 'Owner',
            role: 'OWNER',
          },
        },
      },
    });

    // Seed module automation presets within the new tenant's context.
    await tenantContext.run({ tenantId: tenant.id }, () => this.automation.seedPresets(tenant.id));

    return { id: tenant.id, slug: tenant.slug, industryModule: tenant.industryModule };
  }

  current() {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { id: true, name: true, slug: true, industryModule: true, timezone: true, settings: true },
    });
  }

  /**
   * Invite a staff/admin user. Found via live verification: no endpoint
   * existed anywhere to create a STAFF user — only the tenant-signup OWNER and
   * customer-portal invites — which made the entire Employee Workforce vertical
   * (dispatch assignment, clock-in, field execution) impossible to use, since
   * there was no way to provision the technician/staff accounts every one of
   * those features assumes exist. Mirrors PortalAuthService.createForContact's
   * existing pattern (same password hashing, same tenant-scoped create).
   */
  async createStaffUser(input: { email: string; password: string; name: string; role: UserRole; skills?: string[]; serviceZones?: string[] }) {
    return this.prisma.db.user.create({
      data: {
        email: input.email,
        passwordHash: await AuthService.hash(input.password),
        name: input.name,
        role: input.role,
        skills: input.skills ?? [],
        serviceZones: input.serviceZones ?? [],
      } as any,
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
