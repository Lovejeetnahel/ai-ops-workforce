import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { GoalsService } from './goals.service';
import { KpisService } from './kpis.service';
import { businessHealthScore, goalHealth, KpiHealthState } from './goal-math';

/**
 * Executive dashboard — everything on it is DERIVED from real tenant data:
 * goals, KPIs, approvals, invoices, tasks. Risks/opportunities/
 * recommendations are deterministic rules over those same signals, each one
 * traceable to the number that produced it. Nothing is fabricated; an empty
 * business gets honest empty states and a neutral-baseline health score.
 */
@Injectable()
export class ExecutiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
    private readonly kpis: KpisService,
  ) {}

  async dashboard() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [allGoals, allKpis, pendingApprovals, overdueInvoices, failedTasks, staleLeads, unsentQuotes] = await Promise.all([
      this.goals.list(),
      this.kpis.list(),
      this.prisma.db.agentApproval.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, agentKey: true, toolName: true, reason: true, expiresAt: true, createdAt: true },
      }),
      this.prisma.db.document.count({
        where: { type: 'INVOICE', status: { in: ['SENT', 'VIEWED'] }, createdAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
      }),
      this.prisma.db.agentTask.count({ where: { status: 'FAILED', createdAt: { gte: weekAgo } } }),
      this.prisma.db.lead.count({ where: { stage: 'NEW', updatedAt: { lt: new Date(now.getTime() - 3 * 86_400_000) } } }),
      this.prisma.db.document.count({ where: { type: 'QUOTE', status: 'DRAFT' } }),
    ]);

    const activeGoals = allGoals.filter((g: any) => g.status === 'ACTIVE');
    const goalsAtRisk = activeGoals.filter((g: any) => ['AT_RISK', 'OVERDUE'].includes(goalHealth(g, now)));
    const trackedKpiStates = allKpis.map((k: any) => k.health).filter((h: KpiHealthState) => h !== 'UNTRACKED');

    const health = businessHealthScore({
      avgGoalProgress: activeGoals.length
        ? Math.round(activeGoals.reduce((s: number, g: any) => s + g.progress, 0) / activeGoals.length)
        : null,
      goalsAtRisk: goalsAtRisk.length,
      activeGoals: activeGoals.length,
      kpiStates: trackedKpiStates,
      overdueInvoices,
      pendingApprovals: pendingApprovals.length,
      failedAiTasksThisWeek: failedTasks,
    });

    // Risks — each one names its real, checkable signal.
    const risks: { title: string; detail: string; severity: 'HIGH' | 'MEDIUM' }[] = [];
    for (const g of goalsAtRisk) {
      risks.push({
        title: `Goal at risk: ${g.title}`,
        detail: g.dueAt && new Date(g.dueAt) < now ? 'Past its due date.' : `Progress (${g.progress}%) is behind schedule.`,
        severity: g.priority === 'CRITICAL' || g.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      });
    }
    for (const k of allKpis.filter((k: any) => k.health === 'AT_RISK')) {
      risks.push({ title: `KPI off target: ${k.name}`, detail: `At ${k.attainmentPct}% of target.`, severity: 'MEDIUM' });
    }
    if (overdueInvoices > 0) risks.push({ title: `${overdueInvoices} invoice(s) unpaid for 7+ days`, detail: 'Cash sitting uncollected.', severity: overdueInvoices >= 5 ? 'HIGH' : 'MEDIUM' });
    if (failedTasks > 0) risks.push({ title: `${failedTasks} AI task(s) failed this week`, detail: 'Check the AI Workforce task log.', severity: 'MEDIUM' });

    // Opportunities — real, actionable, from real records.
    const opportunities: { title: string; detail: string }[] = [];
    if (staleLeads > 0) opportunities.push({ title: `${staleLeads} new lead(s) untouched for 3+ days`, detail: 'A follow-up could still win them.' });
    if (unsentQuotes > 0) opportunities.push({ title: `${unsentQuotes} draft quote(s) never sent`, detail: 'Finish and send them to move deals forward.' });
    if (pendingApprovals.length > 0) opportunities.push({ title: `${pendingApprovals.length} AI action(s) waiting on approval`, detail: 'Approving unblocks work already prepared.' });

    // Recommendations — deterministic priority order over the same signals.
    const recommendations: string[] = [];
    if (goalsAtRisk.length) recommendations.push(`Review the ${goalsAtRisk.length} at-risk goal(s) — reset the plan or the due date.`);
    if (pendingApprovals.length) recommendations.push('Clear the pending AI approvals queue — held actions expire after 7 days.');
    if (overdueInvoices) recommendations.push('Chase overdue invoices (the Collections AI can draft reminders for your approval).');
    if (staleLeads) recommendations.push('Work the untouched new leads before they go cold.');
    if (!activeGoals.length) recommendations.push('Define your first goal — every AI employee will see it and work toward it.');
    if (!allKpis.length) recommendations.push('Add a KPI (revenue, leads or conversion) so progress is measured, not guessed.');

    return {
      generatedAt: now.toISOString(),
      healthScore: health.score,
      healthComponents: health.components,
      goals: {
        active: activeGoals,
        atRiskCount: goalsAtRisk.length,
        achievedCount: allGoals.filter((g: any) => g.status === 'ACHIEVED').length,
      },
      kpis: allKpis,
      risks,
      opportunities,
      pendingApprovals,
      recommendations,
    };
  }
}
