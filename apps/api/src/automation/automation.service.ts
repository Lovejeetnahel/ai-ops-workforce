import { Injectable, Logger } from '@nestjs/common';
import { getModuleConfig, AutomationPreset } from '@aiow/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainEvent } from './events';
import { matches } from './rule-engine';

export interface ResolvedRule {
  name: string;
  actions: { type: string; params: Record<string, unknown> }[];
}

/**
 * For a given event, resolves the ordered list of actions to run from the
 * tenant's `AutomationRule` rows in the DB — this includes both the industry
 * module's seeded presets (copied in by `seedPresets()` at provisioning, each
 * tagged with `presetKey`) and any custom rules the tenant authors themselves.
 *
 * IMPORTANT: this must NOT also re-evaluate the static `packages/config`
 * presets directly — every tenant already has a DB-backed copy of them
 * (seeded at provisioning), so doing both double-fires every preset-driven
 * automation (duplicate SMS/email, duplicate jobs/dispatches, duplicate Value
 * Ledger entries) and makes a tenant's `enabled: false` override on a preset
 * meaningless, since the static branch ignored it. (Found via live end-to-end
 * verification: a single emergency lead produced two dispatched jobs and two
 * SMS sends from one event.) Conditions are evaluated against the event
 * payload; only matching, enabled rules contribute actions.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(event: DomainEvent): Promise<ResolvedRule[]> {
    const resolved: ResolvedRule[] = [];

    const rules = await this.prisma.db.automationRule.findMany({
      where: { triggerEvent: event.name, enabled: true },
    });
    for (const rule of rules) {
      const conditions = (rule.conditions as any) ?? [];
      if (!matches(conditions, event.payload)) continue;
      resolved.push({ name: rule.name, actions: (rule.actions as any) ?? [] });
    }

    this.logger.debug(`Resolved ${resolved.length} rule(s) for ${event.name}`);
    return resolved;
  }

  /** Seed a new tenant with the enabled presets for its module. */
  async seedPresets(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { industryModule: true },
    });
    const presets = getModuleConfig(tenant.industryModule).automations;
    for (const preset of presets) {
      await this.prisma.db.automationRule.create({
        data: {
          name: preset.name,
          triggerEvent: preset.triggerEvent,
          conditions: preset.conditions as any,
          actions: preset.actions as any,
          enabled: preset.enabledByDefault,
          presetKey: preset.key,
        } as any,
      });
    }
  }
}
