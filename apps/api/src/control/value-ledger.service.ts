import { Injectable } from '@nestjs/common';
import { LedgerDirection, ValueType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface LedgerInput {
  valueType: ValueType;
  amount: number;
  direction?: LedgerDirection;
  decisionId?: string;
  actionType?: string;
  agent?: string;
  source?: string;
}

/**
 * The Value Ledger — the system's source of truth for business impact. Every
 * resolved decision that produced (or cost) value writes an immutable entry
 * here, attributable to the decision/action/policy. This is NOT analytics UI;
 * it is the substrate a future ScoredPolicy uses as its reward signal.
 */
@Injectable()
export class ValueLedgerService {
  /** Rough per-action cost estimates (USD). Tunable; optional. */
  private static readonly COST: Record<string, number> = {
    SEND_SMS: 0.01,
    SEND_WHATSAPP: 0.01,
    SEND_EMAIL: 0.001,
    TRIGGER_AGENT: 0.02, // an LLM/agent invocation
    GENERATE_DOCUMENT: 0.02,
  };

  constructor(private readonly prisma: PrismaService) {}

  record(input: LedgerInput) {
    return this.prisma.db.valueLedgerEntry.create({
      data: {
        valueType: input.valueType,
        direction: input.direction ?? 'CREDIT',
        amount: input.amount,
        decisionId: input.decisionId ?? null,
        actionType: input.actionType ?? null,
        agent: input.agent ?? null,
        source: input.source ?? null,
      } as any,
    });
  }

  /** Optional cost-of-action debit; no-op for free actions. */
  recordCost(actionType: string, decisionId?: string) {
    const amount = ValueLedgerService.COST[actionType] ?? 0;
    if (!amount) return Promise.resolve(null);
    return this.record({ valueType: 'COST', direction: 'DEBIT', amount, actionType, decisionId, source: 'estimate' });
  }

  /** Totals by value type plus net value (credits − debits). Truth source read. */
  async summary() {
    const grouped = await this.prisma.db.valueLedgerEntry.groupBy({
      by: ['valueType', 'direction'],
      _sum: { amount: true },
      _count: { _all: true },
    });

    let credit = 0;
    let debit = 0;
    const byType: Record<string, { amount: number; count: number }> = {};
    for (const g of grouped) {
      const amt = Number(g._sum.amount ?? 0);
      byType[g.valueType] = { amount: (byType[g.valueType]?.amount ?? 0) + amt, count: g._count._all };
      if (g.direction === 'CREDIT') credit += amt;
      else debit += amt;
    }
    return { byType, totalValue: credit, totalCost: debit, netValue: credit - debit };
  }
}
