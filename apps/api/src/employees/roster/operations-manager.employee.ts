import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Operations Manager AI — watches workload/KPIs, detects bottlenecks, reassigns
 * work, and escalates. Reads the Operations job data + approvals; reassignment
 * writes through the existing Job model.
 */
@Injectable()
export class OperationsManagerEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'operations_manager',
    name: 'Operations Manager AI',
    department: 'Operations',
    description: 'Monitors KPIs and workload, detects bottlenecks, redistributes work, escalates SLA risks.',
    defaultAuthority: 'APPROVE',
    tools: ['llm'],
    triggers: [],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'monitor':
        return this.monitor(ctx);
      case 'reassign':
        return this.reassign(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `Operations Manager AI: unknown task ${ctx.input.type}` });
    }
  }

  private async monitor(ctx: ExecuteContext): Promise<EmployeeResult> {
    const [byStatus, unscheduled, pendingApprovals, onHold] = await Promise.all([
      this.kit.prisma.db.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.kit.prisma.db.job.count({ where: { status: 'UNSCHEDULED' } }),
      this.kit.prisma.db.jobApproval.count({ where: { status: 'PENDING' } }),
      this.kit.prisma.db.job.count({ where: { status: 'ON_HOLD' } }),
    ]);
    const bottlenecks: string[] = [];
    if (unscheduled > 3) bottlenecks.push(`${unscheduled} jobs unscheduled`);
    if (pendingApprovals > 5) bottlenecks.push(`${pendingApprovals} approvals pending`);
    if (onHold > 3) bottlenecks.push(`${onHold} jobs on hold`);

    const report = { jobsByStatus: byStatus.reduce((a, g) => ({ ...a, [g.status]: g._count._all }), {} as Record<string, number>), bottlenecks };
    if (bottlenecks.length) {
      await this.activity({ type: 'SYSTEM', title: `Operations Manager AI flagged ${bottlenecks.length} bottleneck(s)`, body: bottlenecks.join('; ') });
      await this.logDecision(ctx.taskId, 'ops_escalation', { reason: bottlenecks.join('; '), confidence: 0.9 });
    }
    return { ok: true, summary: bottlenecks.length ? `Bottlenecks: ${bottlenecks.join('; ')}` : 'Operations healthy', output: report };
  }

  private async reassign(ctx: ExecuteContext): Promise<EmployeeResult> {
    const jobId = ctx.input.subjects?.jobId;
    const toUserId = String(ctx.input.params?.toUserId ?? '');
    if (!jobId || !toUserId) return { ok: false, summary: 'jobId and toUserId required' };
    if (!ctx.autonomous) return { ok: true, summary: 'Reassignment suggested (approval required)', output: { jobId, toUserId } };
    await this.kit.prisma.db.job.update({ where: { id: jobId }, data: { assignedToId: toUserId } });
    await this.activity({ type: 'JOB_UPDATE', title: 'Operations Manager AI reassigned job', jobId });
    await this.logDecision(ctx.taskId, 'reassign_job', { reason: 'Workload rebalancing', subjects: { jobId } });
    return { ok: true, summary: 'Job reassigned', output: { jobId, toUserId } };
  }
}
