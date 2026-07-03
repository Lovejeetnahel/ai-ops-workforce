import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';

/**
 * Observability surface: liveness/readiness probes (for K8s) and operational
 * metrics — tenant-scoped business counts, AI-workforce activity, workflow runs,
 * and BullMQ queue depth.
 */
@Controller('ops')
export class OpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'ready', db: 'up' };
    } catch {
      return { status: 'degraded', db: 'down' };
    }
  }

  @Get('metrics')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async metrics() {
    const [leads, jobs, openJobs, agentTasks, workflowRuns, decisions, queue] = await Promise.all([
      this.prisma.db.lead.count(),
      this.prisma.db.job.count(),
      this.prisma.db.job.count({ where: { status: { in: ['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'] } } }),
      this.prisma.db.agentTask.count(),
      this.prisma.db.workflowRun.count(),
      this.prisma.db.decisionRecord.count(),
      this.bus.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed').catch(() => ({})),
    ]);
    return { business: { leads, jobs, openJobs }, ai: { agentTasks, decisions }, workflows: { runs: workflowRuns }, queue };
  }
}
