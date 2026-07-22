import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AgentAuthority } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EmployeeRegistry } from './framework/employee-registry.service';
import { AgentOrchestrator } from './framework/agent-orchestrator.service';
import { EmployeeMetricsService } from './framework/employee-metrics.service';
import { AgentApprovalsService } from './framework/agent-approvals.service';
import { AiUsageService } from './framework/ai-usage.service';
import { validateEmployeeConfigInput } from './framework/employee-config';
import { CommandRateLimitGuard } from './command-rate-limit.guard';

class RunTaskDto {
  @IsString() type: string;
  @IsOptional() @IsObject() subjects?: Record<string, string>;
  @IsOptional() @IsObject() params?: Record<string, unknown>;
}
class InstallDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsEnum(AgentAuthority) authority?: AgentAuthority;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() permissions?: string[];
}
class CommandDto {
  @IsString() @MinLength(2) @MaxLength(2000) text: string;
}
class ConfigPatchDto {
  @IsOptional() @IsString() @MaxLength(2000) personality?: string;
  @IsOptional() @IsString() @MaxLength(4000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(1000) goal?: string;
  @IsOptional() kpis?: string[];
  @IsOptional() @IsObject() schedule?: Record<string, unknown>;
  @IsOptional() permissions?: string[];
}

/**
 * AI workforce admin + operations API: roster, run a task, install/enable, and
 * observability (metrics, leaderboard, task history).
 */
@Controller('employees')
@UseGuards(RolesGuard)
export class EmployeeController {
  constructor(
    private readonly registry: EmployeeRegistry,
    private readonly orchestrator: AgentOrchestrator,
    private readonly metrics: EmployeeMetricsService,
    private readonly prisma: PrismaService,
    private readonly approvals: AgentApprovalsService,
    private readonly usage: AiUsageService,
    private readonly providers: ProviderFactory,
  ) {}

  // ── Phase 3: Command Center, approvals, usage, config ─────────────────────

  /**
   * Natural-language Command Center. OWNER and ADMIN only (an ADMIN gets the
   * same approval gating as everyone: external-impact actions still queue
   * unless the tenant explicitly raised command_center to AUTONOMOUS).
   */
  @Post('command')
  @Roles('ADMIN')
  @UseGuards(CommandRateLimitGuard)
  async command(@Body() dto: CommandDto) {
    const res = await this.orchestrator.run('command_center', { type: 'command', params: { text: dto.text } });
    // Surface the run code, not raw DB ids, as the support reference.
    return { runId: (res.output as any)?.runId ?? null, ...res };
  }

  @Get('approvals')
  @Roles('ADMIN')
  approvalsPending() {
    return this.approvals.listPending();
  }

  @Get('approvals/recent')
  @Roles('ADMIN')
  approvalsRecent() {
    return this.approvals.listRecent();
  }

  @Post('approvals/:id/approve')
  @Roles('ADMIN')
  approve(@Param('id') id: string) {
    // Approver identity from the authenticated server context, never the body.
    const userId = tenantContext.get()?.userId;
    if (!userId) throw new BadRequestException('No authenticated user in context.');
    return this.approvals.approve(id, userId);
  }

  @Post('approvals/:id/reject')
  @Roles('ADMIN')
  rejectApproval(@Param('id') id: string) {
    const userId = tenantContext.get()?.userId;
    if (!userId) throw new BadRequestException('No authenticated user in context.');
    return this.approvals.reject(id, userId);
  }

  @Get('usage')
  @Roles('ADMIN')
  usageSummary() {
    return this.usage.summary();
  }

  @Get('ai-status')
  @Roles('ADMIN')
  aiStatus() {
    const llm = this.providers.llm();
    return this.usage.readiness({ provider: llm.provider, model: llm.model });
  }

  @Patch(':key/config')
  @Roles('ADMIN')
  async patchConfig(@Param('key') key: string, @Body() dto: ConfigPatchDto) {
    if (!this.registry.get(key)) throw new BadRequestException(`Unknown AI employee: ${key}`);
    const errors = validateEmployeeConfigInput(dto as Record<string, unknown>);
    if (errors.length) throw new BadRequestException(errors.join('; '));
    const existing = await this.registry.installation(key);
    const merged = {
      ...(existing.config as Record<string, unknown>),
      ...(dto.personality !== undefined ? { personality: dto.personality } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
      ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
      ...(dto.kpis !== undefined ? { kpis: dto.kpis } : {}),
      ...(dto.schedule !== undefined ? { schedule: dto.schedule } : {}),
      version: 1,
    };
    const result = await this.registry.install(key, { config: merged, permissions: dto.permissions });
    if (dto.schedule !== undefined) {
      // Schedule changed: clear the claim column so the scheduler's arm pass
      // recomputes nextRunAt from the new schedule (or leaves it disarmed).
      await this.prisma.db.agentInstallation.updateMany({ where: { agentKey: key }, data: { nextRunAt: null } });
    }
    return result;
  }

  @Get()
  @Roles('STAFF')
  async list() {
    const defs = this.registry.list();
    return Promise.all(defs.map(async (d) => ({ ...d, installation: await this.registry.installation(d.key) })));
  }

  @Post(':key/run')
  @Roles('STAFF')
  run(@Param('key') key: string, @Body() dto: RunTaskDto) {
    return this.orchestrator.run(key, { type: dto.type, subjects: dto.subjects as any, params: dto.params });
  }

  @Post(':key/install')
  @Roles('OWNER')
  install(@Param('key') key: string, @Body() dto: InstallDto) {
    return this.registry.install(key, dto);
  }

  @Post(':key/enable')
  @Roles('ADMIN')
  enable(@Param('key') key: string) {
    return this.registry.setEnabled(key, true);
  }

  @Post(':key/disable')
  @Roles('ADMIN')
  disable(@Param('key') key: string) {
    return this.registry.setEnabled(key, false);
  }

  @Get('leaderboard')
  @Roles('ADMIN')
  leaderboard() {
    return this.metrics.leaderboard();
  }

  @Get('tasks')
  @Roles('ADMIN')
  tasks(@Query('agentKey') agentKey?: string) {
    return this.prisma.db.agentTask.findMany({
      where: { ...(agentKey ? { agentKey } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':key/metrics')
  @Roles('ADMIN')
  agentMetrics(@Param('key') key: string) {
    return this.metrics.forAgent(key);
  }
}
