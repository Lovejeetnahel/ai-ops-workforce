import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { tenantContext } from '../common/tenancy/tenant-context';

export interface CompanyProfilePatch {
  legalName?: string | null;
  brandName?: string | null;
  tagline?: string | null;
  mission?: string | null;
  vision?: string | null;
  brandVoice?: string | null;
  targetMarket?: string | null;
  workingHours?: Record<string, unknown>;
  locations?: unknown[];
  businessRules?: string[];
}

/**
 * Structured company identity — one record per tenant, lazily created on
 * first read so existing tenants need no backfill. Timezone deliberately
 * lives on Tenant (PATCH /tenants/profile) — this service surfaces it
 * read-only so the UI shows one coherent profile without a second source
 * of truth.
 */
@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const [profile, tenant] = await Promise.all([
      this.prisma.db.companyProfile.findFirst(),
      this.prisma.db.tenant.findUnique({
        where: { id: tenantContext.tenantId },
        select: { name: true, timezone: true, industryModule: true },
      }),
    ]);
    return {
      businessName: tenant?.name ?? null,
      timezone: tenant?.timezone ?? null, // owned by Tenant; edit via /tenants/profile
      industryModule: tenant?.industryModule ?? null,
      legalName: profile?.legalName ?? null,
      brandName: profile?.brandName ?? null,
      tagline: profile?.tagline ?? null,
      mission: profile?.mission ?? null,
      vision: profile?.vision ?? null,
      brandVoice: profile?.brandVoice ?? null,
      targetMarket: profile?.targetMarket ?? null,
      workingHours: (profile?.workingHours as Record<string, unknown>) ?? {},
      locations: (profile?.locations as unknown[]) ?? [],
      businessRules: (profile?.businessRules as string[]) ?? [],
      updatedAt: profile?.updatedAt ?? null,
    };
  }

  async update(patch: CompanyProfilePatch) {
    const userId = tenantContext.get()?.userId ?? null;
    const data = {
      ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
      ...(patch.brandName !== undefined ? { brandName: patch.brandName } : {}),
      ...(patch.tagline !== undefined ? { tagline: patch.tagline } : {}),
      ...(patch.mission !== undefined ? { mission: patch.mission } : {}),
      ...(patch.vision !== undefined ? { vision: patch.vision } : {}),
      ...(patch.brandVoice !== undefined ? { brandVoice: patch.brandVoice } : {}),
      ...(patch.targetMarket !== undefined ? { targetMarket: patch.targetMarket } : {}),
      ...(patch.workingHours !== undefined ? { workingHours: patch.workingHours as any } : {}),
      ...(patch.locations !== undefined ? { locations: patch.locations as any } : {}),
      ...(patch.businessRules !== undefined ? { businessRules: patch.businessRules as any } : {}),
      updatedById: userId,
    };
    await this.prisma.db.companyProfile.upsert({
      where: { tenantId: tenantContext.tenantId },
      update: data,
      create: { ...data } as any, // tenantId stamped by the tenancy extension
    });
    return this.get();
  }
}
