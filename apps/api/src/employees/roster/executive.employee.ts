import { Injectable } from '@nestjs/common';
import { MemorySubject } from '@prisma/client';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Executive AI — daily/weekly reports, revenue forecast, and company scorecard.
 * Reads the Value Ledger (Control Layer) + CRM/Operations counts, writes the
 * narrative to the timeline and to org-level Brain memory.
 */
@Injectable()
export class ExecutiveEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'executive',
    name: 'Executive AI',
    department: 'Leadership',
    description: 'Reports, forecasts, scorecards, growth and cost recommendations, goal tracking.',
    defaultAuthority: 'APPROVE', // owner can raise to AUTONOMOUS per employee — approval-first is the published default
    tools: ['llm'],
    triggers: ['payment.succeeded'],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'report':
        return this.report(ctx);
      case 'kpi_update':
        return this.kpiUpdate();
      default:
        return Promise.resolve({ ok: false, summary: `Executive AI: unknown task ${ctx.input.type}` });
    }
  }

  private async report(ctx: ExecuteContext): Promise<EmployeeResult> {
    const days = Number(ctx.input.params?.days ?? 7);
    const since = new Date(Date.now() - days * 86_400_000);
    const [ledger, newLeads, completedJobs, openLeads] = await Promise.all([
      this.kit.ledger.summary(),
      this.kit.prisma.db.lead.count({ where: { createdAt: { gte: since } } }),
      this.kit.prisma.db.job.count({ where: { completedAt: { gte: since } } }),
      this.kit.prisma.db.lead.count({ where: { stage: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } } }),
    ]);
    const scorecard = { periodDays: days, netValue: ledger.netValue, revenue: ledger.totalValue, cost: ledger.totalCost, newLeads, completedJobs, openPipeline: openLeads };
    const narrative = await this.kit.complete(
      'You are a COO. Write a crisp executive summary (3-4 sentences) plus 2 prioritized recommendations from these metrics.',
      JSON.stringify(scorecard),
      300,
    );
    await this.activity({ type: 'AI_ACTION', title: `Executive AI ${days}-day report`, body: narrative });
    await this.remember(tenantContext.tenantId, `Scorecard ${new Date().toISOString().slice(0, 10)}: ${JSON.stringify(scorecard)}`, MemorySubject.TENANT, 'scorecard');
    return { ok: true, summary: 'Executive report generated', output: { scorecard, narrative } };
  }

  private async kpiUpdate(): Promise<EmployeeResult> {
    const ledger = await this.kit.ledger.summary();
    await this.remember(tenantContext.tenantId, `KPI snapshot: net $${ledger.netValue}, revenue $${ledger.totalValue}.`, MemorySubject.TENANT, 'kpi_snapshot');
    return { ok: true, summary: 'KPIs updated', output: { netValue: ledger.netValue } };
  }
}
