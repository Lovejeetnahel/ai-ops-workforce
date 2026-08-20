import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { getModuleConfig } from '@aiow/config';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { tenantContext } from '../common/tenancy/tenant-context';
import { AutomationService } from './automation.service';
import { DomainEvents } from './events';
import { EntitlementsService } from '../common/entitlements/entitlements.service';

/**
 * Owner/admin CRUD for automation rules. The visual "automation builder" in the
 * dashboard is backed by these endpoints. Module presets are seeded on tenant
 * creation; here owners toggle, tweak, or add their own rules.
 */
@Controller('automation')
@UseGuards(RolesGuard)
export class AutomationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: AutomationService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('rules')
  @Roles('ADMIN')
  list() {
    return this.prisma.db.automationRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post('rules')
  @Roles('ADMIN')
  async create(@Body() body: any) {
    await this.entitlements.require('automationRules');
    return this.prisma.db.automationRule.create({
      data: {
        name: body.name,
        triggerEvent: body.triggerEvent,
        conditions: body.conditions ?? [],
        actions: body.actions ?? [],
        enabled: body.enabled ?? true,
      } as any,
    });
  }

  /**
   * Sprint 2: the trigger catalog for the rule builder — every domain event the
   * engine can react to, straight from the canonical DomainEvents map.
   */
  @Get('events')
  @Roles('ADMIN')
  events() {
    return Object.values(DomainEvents).sort();
  }

  /**
   * Sprint 2: industry recipes — the module's seeded automation presets plus
   * which are recommended by the tenant's preset. These are the tenant's OWN
   * DB rules (tagged presetKey), so enabling one is just the existing PATCH.
   */
  @Get('recipes')
  @Roles('ADMIN')
  async recipes() {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantContext.tenantId },
      select: { industryModule: true, settings: true },
    });
    const presets = getModuleConfig(tenant.industryModule).automations;
    const rules = await this.prisma.db.automationRule.findMany({ where: { presetKey: { not: null } } });
    return presets.map((p) => {
      const rule = rules.find((r) => r.presetKey === p.key);
      return {
        key: p.key,
        name: p.name,
        description: p.description,
        triggerEvent: p.triggerEvent,
        ruleId: rule?.id ?? null,
        enabled: rule?.enabled ?? false,
        seeded: !!rule,
      };
    });
  }

  /**
   * Sprint 2: execution history — the EventLog is the engine's real run
   * record (RECEIVED → PROCESSED/FAILED with the error preserved).
   */
  @Get('history')
  @Roles('ADMIN')
  history(@Query('status') status?: string, @Query('limit') limit?: string) {
    const take = Math.max(1, Math.min(200, parseInt(limit ?? '100', 10) || 100));
    return this.prisma.db.eventLog.findMany({
      where: status ? { status: status as any } : undefined,
      select: { id: true, name: true, source: true, status: true, error: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  @Patch('rules/:id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.triggerEvent !== undefined) data.triggerEvent = body.triggerEvent;
    if (body.conditions !== undefined) data.conditions = body.conditions;
    if (body.actions !== undefined) data.actions = body.actions;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    return this.prisma.db.automationRule.update({ where: { id }, data });
  }
}
