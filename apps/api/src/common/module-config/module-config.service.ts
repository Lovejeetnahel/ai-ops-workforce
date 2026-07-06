import { Injectable } from '@nestjs/common';
import { getModuleConfig, getPreset, IndustryModuleConfig, IndustryPreset } from '@aiow/config';
import { PrismaService } from '../prisma/prisma.service';

/** Engine config plus the tenant's industry preset (Phase 1), when one is set. */
export type ResolvedModuleConfig = IndustryModuleConfig & { preset?: IndustryPreset };

/**
 * Resolves the Industry Module Config for a tenant and merges any per-tenant
 * `settings` overrides on top of the vertical defaults. This is what makes the
 * same code render "Service Request" for HVAC and "Case" for an immigration firm.
 * Phase 1: if Tenant.settings.presetKey names an industry preset, its label,
 * tagline and label overrides are layered on and the full preset (nav groups,
 * workspaces, hidden modules) rides along for the frontend.
 */
@Injectable()
export class ModuleConfigService {
  private cache = new Map<string, ResolvedModuleConfig>();

  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: string): Promise<ResolvedModuleConfig> {
    if (this.cache.has(tenantId)) return this.cache.get(tenantId)!;

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { industryModule: true, settings: true },
    });

    const base = getModuleConfig(tenant.industryModule);
    const overrides = (tenant.settings as any)?.moduleOverrides ?? {};
    const presetKey = (tenant.settings as any)?.presetKey as string | undefined;
    const preset = presetKey ? getPreset(presetKey) : undefined;

    const merged: ResolvedModuleConfig = {
      ...base,
      ...(preset ? { label: preset.label, tagline: preset.tagline } : {}),
      labels: { ...base.labels, ...(preset?.labels ?? {}), ...(overrides.labels ?? {}) },
      ...(preset ? { preset } : {}),
    };

    this.cache.set(tenantId, merged);
    return merged;
  }

  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }
}
