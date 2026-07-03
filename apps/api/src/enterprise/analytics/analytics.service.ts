import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';

export interface Range {
  from: Date;
  to: Date;
}

const OPEN_JOB = ['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'ON_HOLD'];
const OPEN_LEAD = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED'];

/**
 * The KPI + analytics engine. Computes every metric from the EXISTING source of
 * truth (Value Ledger, CRM leads, Operations jobs, Revenue documents) — no
 * separate analytics store. Powers predefined domain dashboards and custom
 * saved dashboards/widgets.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  static defaultRange(days = 30): Range {
    return { from: new Date(Date.now() - days * 86_400_000), to: new Date() };
  }

  /** Resolve a single KPI by key over a range. */
  async kpi(key: string, range: Range = AnalyticsService.defaultRange()) {
    const value = await this.metric(key, range);
    return { key, value, label: LABELS[key] ?? key };
  }

  async metric(key: string, range: Range): Promise<number> {
    switch (key) {
      case 'revenue':
        return this.ledgerSum('CREDIT', range);
      case 'cost':
        return this.ledgerSum('DEBIT', range);
      case 'net_value':
        return (await this.ledgerSum('CREDIT', range)) - (await this.ledgerSum('DEBIT', range));
      case 'jobs_completed':
        return this.prisma.db.job.count({ where: { completedAt: { gte: range.from, lte: range.to } } });
      case 'jobs_open':
        return this.prisma.db.job.count({ where: { status: { in: OPEN_JOB as any } } });
      case 'leads_new':
        return this.prisma.db.lead.count({ where: { createdAt: { gte: range.from, lte: range.to } } });
      case 'leads_won':
        return this.prisma.db.lead.count({ where: { stage: 'COMPLETED', updatedAt: { gte: range.from, lte: range.to } } });
      case 'pipeline_value':
        return this.sumDecimal(await this.prisma.db.lead.findMany({ where: { stage: { in: OPEN_LEAD as any } }, select: { estimatedValue: true } }), 'estimatedValue');
      case 'conversion_rate': {
        const total = await this.prisma.db.lead.count({ where: { createdAt: { gte: range.from, lte: range.to } } });
        const won = await this.prisma.db.lead.count({ where: { stage: 'COMPLETED', updatedAt: { gte: range.from, lte: range.to } } });
        return total ? Math.round((won / total) * 100) : 0;
      }
      case 'avg_job_value': {
        const completed = await this.prisma.db.job.count({ where: { completedAt: { gte: range.from, lte: range.to } } });
        const revenue = await this.ledgerSum('CREDIT', range);
        return completed ? Math.round(revenue / completed) : 0;
      }
      case 'outstanding_invoices':
        return this.sumDecimal(await this.prisma.db.document.findMany({ where: { type: 'INVOICE', status: { in: ['SENT', 'VIEWED'] } }, select: { amount: true } }), 'amount');
      case 'active_staff':
        return this.prisma.db.user.count({ where: { role: 'STAFF', status: 'ACTIVE' } });
      case 'agent_tasks':
        return this.prisma.db.agentTask.count({ where: { createdAt: { gte: range.from, lte: range.to } } });
      default:
        return 0;
    }
  }

  /** Daily time series for a ledger-backed metric. */
  async timeseries(metricKey: 'revenue' | 'cost', range: Range) {
    const dir = metricKey === 'revenue' ? 'CREDIT' : 'DEBIT';
    const rows = await this.prisma.db.valueLedgerEntry.findMany({
      where: { direction: dir as any, createdAt: { gte: range.from, lte: range.to } },
      select: { amount: true, createdAt: true },
    });
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + Number(r.amount));
    }
    return [...buckets.entries()].sort().map(([date, value]) => ({ date, value }));
  }

  /** Pre-built domain dashboard (KPIs + series). */
  async domainDashboard(type: string, range: Range = AnalyticsService.defaultRange()) {
    const sets: Record<string, string[]> = {
      revenue: ['revenue', 'cost', 'net_value', 'outstanding_invoices', 'avg_job_value'],
      sales: ['leads_new', 'leads_won', 'conversion_rate', 'pipeline_value'],
      operations: ['jobs_completed', 'jobs_open', 'active_staff', 'avg_job_value'],
      executive: ['revenue', 'net_value', 'leads_new', 'jobs_completed', 'conversion_rate', 'pipeline_value'],
    };
    const keys = sets[type] ?? sets.executive;
    const kpis = await Promise.all(keys.map((k) => this.kpi(k, range)));
    const series = type === 'revenue' || type === 'executive' ? await this.timeseries('revenue', range) : [];
    return { type, range, kpis, series };
  }

  // ── Saved dashboards ──────────────────────────────────────────────────────
  listDashboards() {
    return this.prisma.db.dashboard.findMany({ orderBy: { updatedAt: 'desc' }, include: { widgets: { orderBy: { position: 'asc' } } } });
  }

  saveDashboard(input: { key: string; name: string; type?: string; layout?: unknown }) {
    return this.prisma.db.dashboard.upsert({
      where: { tenantId_key: { tenantId: tenantContext.tenantId, key: input.key } },
      update: { name: input.name, type: input.type ?? 'custom', layout: (input.layout ?? {}) as any },
      create: { key: input.key, name: input.name, type: input.type ?? 'custom', layout: (input.layout ?? {}) as any } as any,
    });
  }

  addWidget(dashboardId: string, input: { kind: string; title: string; metricKey: string; config?: unknown; position?: number }) {
    return this.prisma.db.dashboardWidget.create({
      data: { dashboardId, kind: input.kind, title: input.title, metricKey: input.metricKey, config: (input.config ?? {}) as any, position: input.position ?? 0 } as any,
    });
  }

  private async ledgerSum(direction: 'CREDIT' | 'DEBIT', range: Range): Promise<number> {
    const agg = await this.prisma.db.valueLedgerEntry.aggregate({
      where: { direction: direction as any, createdAt: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private sumDecimal(rows: any[], field: string): number {
    return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
  }
}

const LABELS: Record<string, string> = {
  revenue: 'Revenue',
  cost: 'Cost',
  net_value: 'Net Value',
  jobs_completed: 'Jobs Completed',
  jobs_open: 'Open Jobs',
  leads_new: 'New Leads',
  leads_won: 'Leads Won',
  pipeline_value: 'Pipeline Value',
  conversion_rate: 'Conversion Rate %',
  avg_job_value: 'Avg Job Value',
  outstanding_invoices: 'Outstanding Invoices',
  active_staff: 'Active Staff',
  agent_tasks: 'AI Tasks',
};
