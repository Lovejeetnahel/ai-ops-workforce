import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { IndustryModule, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService } from '../common/entitlements/entitlements.service';
import { TRIAL_DAYS } from '../common/entitlements/plans';
import { AuthService } from '../auth/auth.service';
import { AutomationService } from '../automation/automation.service';
import { getPreset } from '@aiow/config';
import { ModuleConfigService } from '../common/module-config/module-config.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/** Bumped whenever the Terms/Privacy content materially changes; recorded on acceptance. */
const CURRENT_TERMS_VERSION = '2026-07-14';

/** Pure name→slug derivation, exported for unit tests. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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
    private readonly moduleConfig: ModuleConfigService,
    private readonly providers: ProviderFactory,
    private readonly entitlements: EntitlementsService,
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

    const slug = await this.uniqueSlug(dto.name);
    const ownerName = `${dto.firstName} ${dto.lastName}`.trim();
    const now = new Date();

    // Phase 1 presets: onboarding answers land in Tenant.settings (Json) — no
    // schema change. presetKey drives per-industry nav/vocabulary at runtime.
    // `onboardingProgress` is always initialized here (even all-empty/false) so
    // the dashboard can tell "a tenant that signed up through this flow and
    // hasn't finished onboarding yet" apart from a pre-Release-2 tenant that
    // has no concept of onboarding at all — the latter's settings will simply
    // never contain this key, and must never see the "finish setting up"
    // banner nag on every dashboard load.
    const settings = {
      ...(dto.presetKey || dto.country || dto.businessSize || dto.teamSize
        ? {
            presetKey: dto.presetKey ?? null,
            onboarding: {
              country: dto.country ?? null,
              businessSize: dto.businessSize ?? null,
              teamSize: dto.teamSize ?? null,
            },
          }
        : {}),
      onboardingProgress: { completedSteps: [], skipped: false, dashboardReached: false, updatedAt: now.toISOString() },
    };

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

    // Sprint 4: every new signup starts a real local 14-day trial on Pro (no
    // card, no Stripe object — honestly local until checkout). Base client:
    // Subscription is keyed by tenantId, no ambient context needed.
    await this.prisma.subscription.create({
      data: { tenantId: tenant.id, planKey: 'pro', seats: 15, status: 'trialing', trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000) },
    });
    await this.prisma.billingEvent.create({ data: { tenantId: tenant.id, type: 'trial_started', data: { planKey: 'pro', trialDays: TRIAL_DAYS, at: 'signup' } } });

    return { id: tenant.id, slug: tenant.slug, industryModule: tenant.industryModule };
  }

  /**
   * Collision-safe tenant slug. Tenant.slug is @unique, and the old
   * name-only derivation meant a second business whose name slugified to an
   * existing slug crashed provisioning with a P2002 — surfaced in production
   * as a generic "Could not create your account." Tries name, name-2 …
   * name-9, then falls back to a random suffix (also covering the rare
   * concurrent-signup race via the caller's create still being guarded by
   * the DB constraint).
   */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'business';
    for (let i = 0; i < 9; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const existing = await this.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    return `${base}-${randomBytes(3).toString('hex')}`;
  }

  current() {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { id: true, name: true, slug: true, industryModule: true, timezone: true, settings: true },
    });
  }

  /** Update the tenant's timezone (validated as a real IANA zone). */
  async updateTimezone(timezone: string) {
    try {
      // Throws RangeError for anything that is not a valid IANA time zone.
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new BadRequestException(`"${timezone}" is not a valid IANA timezone (e.g. America/Toronto).`);
    }
    return this.prisma.db.tenant.update({
      where: { id: tenantContext.tenantId },
      data: { timezone },
      select: { id: true, timezone: true },
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
    await this.entitlements.require('staffSeats');
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

  // ── Sprint 2 additions ────────────────────────────────────────────────

  /** Team roster for Settings (never returns password hashes). */
  listTeam() {
    return this.prisma.db.user.findMany({
      where: { role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, skills: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Provider readiness for Settings/Apps — no secrets, ever. */
  async integrationsStatus() {
    const status = await this.providers.commsStatus(tenantContext.tenantId);
    return [
      { key: 'TWILIO', label: 'Twilio (SMS & WhatsApp)', ...status.sms, enables: ['Inbox SMS replies', 'Campaigns', 'Review requests'] },
      { key: 'SENDGRID', label: 'SendGrid (Email)', ...status.email, enables: ['Email campaigns', 'Password reset delivery', 'Review requests'] },
      { key: 'VAPI', label: 'Vapi (Voice AI)', ...status.voice, enables: ['Inbound AI phone answering', 'Call transcripts'] },
      { key: 'STRIPE', label: 'Stripe (Card payments)', ...status.stripe, enables: ['Invoice payment links', 'Card transactions'] },
    ];
  }

  /**
   * Sprint 4 launch checklist: the activation journey with every state
   * computed from real data — nothing is checked off that is not actually
   * configured. Optional items say so instead of blocking launch.
   */
  async launchChecklist() {
    const db = this.prisma.db;
    const tenantId = tenantContext.tenantId;
    const [subscription, profile, tenant, services, locations, staff, goals, comms, agentsEnabled, voiceAgents, rules, sites] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { tenantId } }),
      db.companyProfile.findFirst({ select: { id: true, tenantId: true, brandName: true, legalName: true } }),
      db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true } }),
      db.serviceOffering.count({ where: { active: true } }),
      db.location.count({ where: { active: true } }),
      db.user.count({ where: { role: { in: ['OWNER', 'ADMIN', 'STAFF'] }, status: 'ACTIVE' } }),
      db.goal.count(),
      this.providers.commsStatus(tenantId),
      db.agentInstallation.count({ where: { enabled: true } }),
      db.voiceAgent.count(),
      db.automationRule.count({ where: { enabled: true } }),
      db.site.count(),
    ]);
    const settings = (tenant.settings as any) ?? {};
    const items = [
      { key: 'plan', label: 'Plan / trial active', done: !!subscription, optional: false, href: '/settings?tab=billing', detail: subscription ? `${subscription.planKey} (${subscription.status})` : 'Start your free trial' },
      { key: 'profile', label: 'Company profile', done: !!(profile?.brandName || profile?.legalName), optional: false, href: '/brain', detail: 'Grounds every AI answer in your real business' },
      { key: 'preset', label: 'Industry preset', done: !!settings.presetKey, optional: false, href: '/settings?tab=preset', detail: settings.presetKey ?? 'Pick the preset that matches your business' },
      { key: 'services', label: 'Services & prices', done: services > 0, optional: false, href: '/apps/appointments', detail: `${services} service(s)` },
      { key: 'team', label: 'Invite your team', done: staff > 1, optional: true, href: '/settings?tab=team', detail: `${staff} staff user(s)` },
      { key: 'location', label: 'Locations', done: locations > 0, optional: true, href: '/settings?tab=locations', detail: 'Only needed for multi-location businesses' },
      { key: 'goals', label: 'Goals & KPIs', done: goals > 0, optional: false, href: '/brain', detail: `${goals} goal(s)` },
      { key: 'comms', label: 'Connect SMS or email', done: comms.sms.configured || comms.email.configured, optional: true, href: '/settings?tab=integrations', detail: 'Needed for campaigns, review requests and reminders' },
      { key: 'payments', label: 'Connect Stripe (your customers)', done: comms.stripe.configured, optional: true, href: '/settings?tab=integrations', detail: 'Needed for payment links on invoices' },
      { key: 'voice', label: 'Voice AI', done: comms.voice.configured && voiceAgents > 0, optional: true, href: '/voice-ai', detail: comms.voice.configured ? `${voiceAgents} agent(s)` : 'Connect Vapi to answer calls with AI' },
      { key: 'employees', label: 'Activate AI employees', done: agentsEnabled > 0, optional: false, href: '/workforce', detail: `${agentsEnabled} enabled` },
      { key: 'automations', label: 'Automations', done: rules > 0, optional: true, href: '/automation', detail: `${rules} active rule(s)` },
      { key: 'website', label: 'Website', done: sites > 0, optional: true, href: '/websites', detail: sites ? `${sites} site(s)` : 'Publish a landing page with a lead form' },
    ];
    const required = items.filter((i) => !i.optional);
    return {
      items,
      requiredDone: required.filter((i) => i.done).length,
      requiredTotal: required.length,
      launchReady: required.every((i) => i.done),
    };
  }

  /** Recent audit history for Settings → Audit (read-only). */
  auditHistory(limit = 50) {
    return this.prisma.db.auditLog.findMany({
      select: { id: true, actorId: true, action: true, entity: true, entityId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(200, limit)),
    });
  }

  /**
   * Change the industry preset (OWNER-only at the controller). Only presets
   * that run on the tenant's EXISTING engine are allowed — switching engines
   * would change data semantics and is deliberately not supported here.
   */
  async changePreset(presetKey: string) {
    const preset = getPreset(presetKey);
    if (!preset) throw new BadRequestException(`Unknown preset: ${presetKey}`);
    const tenant = await this.prisma.db.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { industryModule: true, settings: true },
    });
    if (preset.engine !== tenant.industryModule)
      throw new BadRequestException(
        `The "${preset.label}" preset runs on the ${preset.engine} engine; this workspace runs ${tenant.industryModule}. Presets on a different engine can't be applied to existing data.`,
      );
    const settings = { ...((tenant.settings as any) ?? {}), presetKey };
    const updated = await this.prisma.db.tenant.update({
      where: { id: tenantContext.tenantId },
      data: { settings },
      select: { id: true, settings: true },
    });
    this.moduleConfig.invalidate(tenantContext.tenantId);
    return { id: updated.id, presetKey };
  }

  /**
   * Store preset-driven onboarding answers and apply the tenant's explicit
   * selections: company services/locations onto CompanyProfile, an optional
   * main goal, and the KPI defaults the user ACCEPTED (never silently all).
   * Everything is idempotent — re-running never duplicates goals or KPIs.
   */
  async applyOnboarding(input: {
    answers?: Record<string, unknown>;
    mainGoal?: string;
    acceptKpis?: { name: string; metricKey: string | null; unit?: string; direction?: string; targetValue?: number }[];
    services?: string;
    locations?: string;
  }) {
    const tenant = await this.prisma.db.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { settings: true },
    });
    const current = (tenant.settings as any) ?? {};
    await this.prisma.db.tenant.update({
      where: { id: tenantContext.tenantId },
      data: {
        settings: {
          ...current,
          onboarding: { ...(current.onboarding ?? {}), answers: { ...(current.onboarding?.answers ?? {}), ...(input.answers ?? {}) } },
        },
      },
    });

    // Locations land on the structured CompanyProfile; services stay in the
    // stored answers (the Business Brain page owns richer service records).
    if (input.locations?.trim()) {
      await this.prisma.db.companyProfile.upsert({
        where: { tenantId: tenantContext.tenantId },
        update: { locations: [{ label: 'Service area', address: input.locations.trim() }] as any },
        create: { locations: [{ label: 'Service area', address: input.locations.trim() }] as any } as any,
      });
    }

    let goal = null;
    if (input.mainGoal?.trim()) {
      const existing = await this.prisma.db.goal.findFirst({
        where: { title: input.mainGoal.trim() },
        select: { id: true, tenantId: true },
      });
      goal =
        existing ??
        (await this.prisma.db.goal.create({
          data: { title: input.mainGoal.trim(), priority: 'HIGH', status: 'ACTIVE' } as any,
        }));
    }

    const createdKpis: string[] = [];
    for (const k of input.acceptKpis ?? []) {
      if (!k?.name) continue;
      const exists = await this.prisma.db.kpi.findFirst({ where: { name: k.name }, select: { id: true, tenantId: true } });
      if (exists) continue;
      await this.prisma.db.kpi.create({
        data: {
          name: k.name,
          unit: k.unit ?? null,
          direction: (k.direction as any) ?? 'UP_IS_GOOD',
          metricKey: k.metricKey ?? null,
          targetValue: k.targetValue ?? null,
          goalId: goal?.id ?? null,
        } as any,
      });
      createdKpis.push(k.name);
    }

    return { ok: true, goalId: goal?.id ?? null, createdKpis };
  }

  /**
   * Sprint 3 data controls: record a data export / account deletion request.
   * Fulfillment is a manual operator process today (stated in the UI) — the
   * request is durably recorded (audit trail) and surfaced to admins; nothing
   * is deleted automatically and no completion is ever claimed falsely.
   */
  async dataRequest(type: 'EXPORT' | 'DELETE') {
    const store = tenantContext.get();
    await this.prisma.db.auditLog.create({
      data: { actorId: store?.userId ?? null, action: type === 'EXPORT' ? 'data.export_requested' : 'data.deletion_requested', entity: 'Tenant', entityId: tenantContext.tenantId, diff: {} } as any,
    });
    await this.prisma.db.staffNotification.create({
      data: {
        category: 'data.request',
        title: type === 'EXPORT' ? 'Data export requested' : 'ACCOUNT DELETION requested',
        body: 'Recorded in the audit log. Fulfillment is handled by the operator per the data-controls policy.',
        href: '/settings',
        priority: 'HIGH',
      } as any,
    });
    return { ok: true, recorded: type, note: 'Your request is recorded and visible in the audit history. Fulfillment is handled by our team — you will be contacted at your account email.' };
  }
}
