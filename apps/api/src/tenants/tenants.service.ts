import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { IndustryModule, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AutomationService } from '../automation/automation.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/** Bumped whenever the Terms/Privacy content materially changes; recorded on acceptance. */
const CURRENT_TERMS_VERSION = '2026-07-14';

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

  async provision(dto: {
    name: string;
    firstName: string;
    lastName: string;
    ownerEmail: string;
    ownerPassword: string;
    industryModule: IndustryModule;
    presetKey?: string;
    country?: string;
    businessSize?: string;
    teamSize?: string;
    termsAccepted: boolean;
    marketingConsent?: boolean;
  }) {
    if (!dto.termsAccepted) {
      throw new BadRequestException('You must accept the Terms of Service and Privacy Policy to create an account.');
    }

    // Application-level check (not a DB unique constraint — email is only
    // unique PER TENANT, since the same person can legitimately be invited as
    // staff into unrelated tenants). This only guards new-owner signup, so it
    // can never block a staff invite in a different tenant. No tenant name or
    // other account detail is revealed — just enough to point them at login.
    const existingOwner = await this.prisma.user.findFirst({ where: { email: dto.ownerEmail, role: 'OWNER' } });
    if (existingOwner) {
      throw new ConflictException('An account with that email already exists. Try signing in instead.');
    }

    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ownerName = `${dto.firstName} ${dto.lastName}`.trim();
    const now = new Date();

    // Phase 1 presets: onboarding answers land in Tenant.settings (Json) — no
    // schema change. presetKey drives per-industry nav/vocabulary at runtime.
    const settings =
      dto.presetKey || dto.country || dto.businessSize || dto.teamSize
        ? {
            presetKey: dto.presetKey ?? null,
            onboarding: {
              country: dto.country ?? null,
              businessSize: dto.businessSize ?? null,
              teamSize: dto.teamSize ?? null,
            },
          }
        : undefined;

    // Tenant + owner created outside tenant context (base client).
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        industryModule: dto.industryModule,
        ...(settings ? { settings } : {}),
        users: {
          create: {
            email: dto.ownerEmail,
            passwordHash: await AuthService.hash(dto.ownerPassword),
            name: ownerName || 'Owner',
            role: 'OWNER',
            termsAcceptedAt: now,
            termsVersion: CURRENT_TERMS_VERSION,
            marketingConsent: dto.marketingConsent === true,
            marketingConsentAt: dto.marketingConsent === true ? now : null,
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

  /**
   * First-time onboarding progress (Website Release 2) — stored additively
   * inside the existing `Tenant.settings` JSON blob, the same convention
   * already used for `presetKey`/`onboarding` answers. No schema change, no
   * new table; merges into whatever is already there so it can never clobber
   * unrelated settings.
   */
  async updateOnboarding(input: { completedSteps?: string[]; skipped?: boolean; dashboardReached?: boolean }) {
    const tenant = await this.prisma.db.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { settings: true },
    });
    const current = (tenant.settings as any) ?? {};
    const prior = current.onboardingProgress ?? { completedSteps: [], skipped: false, dashboardReached: false };
    const merged = {
      completedSteps: Array.from(new Set([...(prior.completedSteps ?? []), ...(input.completedSteps ?? [])])),
      skipped: input.skipped ?? prior.skipped ?? false,
      dashboardReached: input.dashboardReached ?? prior.dashboardReached ?? false,
      updatedAt: new Date().toISOString(),
    };
    return this.prisma.db.tenant.update({
      where: { id: tenantContext.tenantId },
      data: { settings: { ...current, onboardingProgress: merged } },
      select: { settings: true },
    });
  }
}
