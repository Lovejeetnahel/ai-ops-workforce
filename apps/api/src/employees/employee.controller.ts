import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { AgentAuthority } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmployeeRegistry } from './framework/employee-registry.service';
import { AgentOrchestrator } from './framework/agent-orchestrator.service';
import { EmployeeMetricsService } from './framework/employee-metrics.service';

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
  ) {}

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
