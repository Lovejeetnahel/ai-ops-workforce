import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Continuous learning engine. The reward signal is the Control Layer itself:
 * DecisionRecord outcomes (MET/MISSED) per policy/agent quantify what works.
 * Human/customer Feedback augments it. No new scoring store — it reads the
 * existing decision + ledger truth source.
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async recordFeedback(input: { subjectType: string; subjectId?: string; agentKey?: string; decisionId?: string; rating?: number; sentiment?: string; comment?: string }) {
    const feedback = await this.prisma.db.feedback.create({
      data: { subjectType: input.subjectType, subjectId: input.subjectId ?? null, agentKey: input.agentKey ?? null, decisionId: input.decisionId ?? null, rating: input.rating ?? null, sentiment: input.sentiment ?? null, comment: input.comment ?? null } as any,
    });
    await this.bus.emit({ name: DomainEvents.FEEDBACK_RECEIVED, tenantId: tenantContext.tenantId, payload: { feedback: { id: feedback.id, agentKey: input.agentKey, rating: input.rating } } });
    return feedback;
  }

  /** Per-policy/agent decision effectiveness (the learning signal). */
  async decisionScoring() {
    const grouped = await this.prisma.db.decisionRecord.groupBy({ by: ['policy', 'status'], _count: { _all: true } });
    const byPolicy: Record<string, { met: number; missed: number; open: number; partial: number; total: number }> = {};
    for (const g of grouped) {
      const p = (byPolicy[g.policy] ??= { met: 0, missed: 0, open: 0, partial: 0, total: 0 });
      const n = g._count._all;
      p.total += n;
      if (g.status === 'MET') p.met += n;
      else if (g.status === 'MISSED') p.missed += n;
      else if (g.status === 'OPEN') p.open += n;
      else if (g.status === 'PARTIAL') p.partial += n;
    }
    return Object.entries(byPolicy).map(([policy, s]) => {
      const resolved = s.met + s.missed;
      return { policy, ...s, successRate: resolved ? Math.round((s.met / resolved) * 100) : null };
    });
  }

  /** Realized value + cost per agent (ROI of learning). */
  async agentValue() {
    const grouped = await this.prisma.db.valueLedgerEntry.groupBy({ by: ['agent', 'direction'], _sum: { amount: true } });
    const byAgent: Record<string, { revenue: number; cost: number }> = {};
    for (const g of grouped) {
      if (!g.agent) continue;
      const a = (byAgent[g.agent] ??= { revenue: 0, cost: 0 });
      if (g.direction === 'CREDIT') a.revenue += Number(g._sum.amount ?? 0);
      else a.cost += Number(g._sum.amount ?? 0);
    }
    return Object.entries(byAgent).map(([agent, v]) => ({ agent, ...v, net: v.revenue - v.cost }));
  }

  async recommendations() {
    const scoring = await this.decisionScoring();
    const weak = scoring.filter((s) => s.successRate !== null && (s.successRate as number) < 50);
    return {
      summary: weak.length ? `${weak.length} policy/agent(s) below 50% success — review prompts, conditions, or authority.` : 'All policies performing at or above target.',
      underperforming: weak,
    };
  }
}
