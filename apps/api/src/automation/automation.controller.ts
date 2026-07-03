import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { AutomationService } from './automation.service';

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
  ) {}

  @Get('rules')
  @Roles('ADMIN')
  list() {
    return this.prisma.db.automationRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post('rules')
  @Roles('ADMIN')
  create(@Body() body: any) {
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
