import { Injectable } from '@nestjs/common';
import { getModuleConfig, IndustryModuleConfig } from '@aiow/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves the Industry Module Config for a tenant and merges any per-tenant
 * `settings` overrides on top of the vertical defaults. This is what makes the
 * same code render "Service Request" for HVAC and "Case" for an immigration firm.
 */
@Injectable()
export class ModuleConfigService {
  private cache = new Map<string, IndustryModuleConfig>();

  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: string): Promise<IndustryModuleConfig> {
    if (this.cache.has(tenantId)) return this.cache.get(tenantId)!;

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { industryModule: true, settings: true },
    });

    const base = getModuleConfig(tenant.industryModule);
    const overrides = (tenant.settings as any)?.moduleOverrides ?? {};
    const merged: IndustryModuleConfig = {
      ...base,
      labels: { ...base.labels, ...(overrides.labels ?? {}) },
    };

    this.cache.set(tenantId, merged);
    return merged;
  }

  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }
}
