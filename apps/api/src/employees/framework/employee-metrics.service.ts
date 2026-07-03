import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Per-employee observability. Tasks come from AgentTask; value/cost come from the
 * existing ValueLedgerEntry.agent tag — so the AI workforce ROI is measured by
 * the same Control Layer truth source as everything else. No new metrics tables.
 */
@Injectable()
export class EmployeeMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async forAgent(agentKey: string) {
    const [tasks, ledger] = await Promise.all([
      this.prisma.db.agentTask.groupBy({ by: ['status'], where: { agentKey }, _count: { _all: true } }),
      this.prisma.db.valueLedgerEntry.groupBy({ by: ['direction'], where: { agent: agentKey }, _sum: { amount: true } }),
    ]);
    return this.shape(agentKey, tasks, ledger);
  }

  async leaderboard() {
    const [tasks, ledger] = await Promise.all([
      this.prisma.db.agentTask.groupBy({ by: ['agentKey', 'status'], _count: { _all: true } }),
      this.prisma.db.valueLedgerEntry.groupBy({ by: ['agent', 'direction'], _sum: { amount: true } }),
    ]);
    const keys = new Set<string>([...tasks.map((t) => t.agentKey), ...ledger.map((l) => l.agent).filter(Boolean) as string[]]);
    const rows = [...keys].map((key) =>
      this.shape(
        key,
        tasks.filter((t) => t.agentKey === key).map((t) => ({ status: t.status, _count: t._count })),
        ledger.filter((l) => l.agent === key).map((l) => ({ direction: l.direction, _sum: l._sum })),
      ),
    );
    return rows.sort((a, b) => b.netValue - a.netValue);
  }

  private shape(agentKey: string, tasks: any[], ledger: any[]) {
    const done = tasks.find((t) => t.status === 'DONE')?._count._all ?? 0;
    const failed = tasks.find((t) => t.status === 'FAILED')?._count._all ?? 0;
    const total = tasks.reduce((s, t) => s + t._count._all, 0);
    const revenue = Number(ledger.find((l) => l.direction === 'CREDIT')?._sum.amount ?? 0);
    const cost = Number(ledger.find((l) => l.direction === 'DEBIT')?._sum.amount ?? 0);
    return {
      agentKey,
      tasksCompleted: done,
      tasksFailed: failed,
      tasksTotal: total,
      successRate: total ? Math.round((done / total) * 100) : 0,
      revenueGenerated: revenue,
      costGenerated: cost,
      netValue: revenue - cost,
      roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null,
    };
  }
}
