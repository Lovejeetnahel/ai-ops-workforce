import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Closed-loop ROI (Sprint 2). One read model over the EXISTING Value Ledger,
 * decisions, AI usage and campaign attribution — no new store, no fabricated
 * causation. Every number is bucketed by how confidently it traces to a cause:
 *
 *   DIRECT       deterministic link recorded at write time
 *   ASSISTED     a tracked touchpoint participated
 *   ESTIMATED    heuristic (labeled so in the UI)
 *   UNATTRIBUTED real value with no known cause
 *   UNKNOWN      recorded before attribution existed (all pre-Sprint-2 rows)
 */
@Injectable()
export class RoiService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(days = 30) {
    const from = new Date(Date.now() - days * 86_400_000);
    const db = this.prisma.db;

    const [credits, debits, byAgent, byAttribution, aiUsage, campaigns, wonLeads] = await Promise.all([
      db.valueLedgerEntry.aggregate({ where: { direction: 'CREDIT', createdAt: { gte: from } }, _sum: { amount: true } }),
      db.valueLedgerEntry.aggregate({ where: { direction: 'DEBIT', createdAt: { gte: from } }, _sum: { amount: true } }),
      db.valueLedgerEntry.groupBy({
        by: ['agent', 'direction'],
        where: { createdAt: { gte: from }, agent: { not: null } },
        _sum: { amount: true },
      }),
      db.valueLedgerEntry.groupBy({
        by: ['attribution', 'direction'],
        where: { createdAt: { gte: from } },
        _sum: { amount: true },
      }),
      db.aiUsageEvent.aggregate({ where: { createdAt: { gte: from } }, _sum: { costMicros: true } }),
      db.campaign.findMany({
        where: { startedAt: { gte: from } },
        select: { id: true, name: true, channel: true, status: true, _count: { select: { recipients: true, leads: true } } },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      db.lead.findMany({
        where: { wonAt: { gte: from } },
        select: { id: true, actualValue: true, campaignId: true, source: true },
      }),
    ]);

    const revenue = Number(credits._sum.amount ?? 0);
    const cost = Number(debits._sum.amount ?? 0);
    const aiCost = Number(aiUsage._sum?.costMicros ?? 0) / 1_000_000; // micros → USD

    // Per-agent rollup (credits minus debits attributed to that agent).
    const agents = new Map<string, { value: number; cost: number }>();
    for (const row of byAgent) {
      const key = row.agent as string;
      const entry = agents.get(key) ?? { value: 0, cost: 0 };
      if (row.direction === 'CREDIT') entry.value += Number(row._sum.amount ?? 0);
      else entry.cost += Number(row._sum.amount ?? 0);
      agents.set(key, entry);
    }

    const attribution = ['DIRECT', 'ASSISTED', 'ESTIMATED', 'UNATTRIBUTED', 'UNKNOWN'].map((kind) => ({
      kind,
      revenue: Number(byAttribution.find((b) => b.attribution === kind && b.direction === 'CREDIT')?._sum.amount ?? 0),
      cost: Number(byAttribution.find((b) => b.attribution === kind && b.direction === 'DEBIT')?._sum.amount ?? 0),
    }));

    // Campaign-attributed won value — ESTIMATED (lead-tag heuristic, labeled).
    const campaignWins = new Map<string, number>();
    for (const lead of wonLeads)
      if (lead.campaignId) campaignWins.set(lead.campaignId, (campaignWins.get(lead.campaignId) ?? 0) + Number(lead.actualValue ?? 0));

    return {
      windowDays: days,
      totals: { revenue, cost, aiCost, net: revenue - cost - aiCost },
      attribution,
      byAgent: [...agents.entries()]
        .map(([agent, v]) => ({ agent, value: v.value, cost: v.cost, net: v.value - v.cost }))
        .sort((a, b) => b.net - a.net),
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        channel: c.channel,
        status: c.status,
        recipients: c._count.recipients,
        attributedLeads: c._count.leads,
        attributedWonValue: campaignWins.get(c.id) ?? 0,
        attributionKind: 'ESTIMATED',
      })),
      honesty: {
        note: 'Attribution buckets are never merged. UNKNOWN covers value recorded before attribution tracking existed; campaign revenue is an ESTIMATED lead-tag heuristic, not a measured conversion path.',
      },
    };
  }
}
