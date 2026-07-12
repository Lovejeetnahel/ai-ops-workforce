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

  /**
   * Single-call aggregate powering the main Dashboard (Phase 2). Every number
   * comes from the tenant-scoped client over existing source-of-truth tables —
   * value ledger, leads, conversations, jobs, documents, activities, automation
   * event log, agent tasks. `modules` flags let the UI hide widgets for
   * capabilities the tenant has never used, instead of showing empty noise.
   */
  async overview() {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month: Range = { from: monthStart, to: now };
    const prevMonth: Range = { from: prevMonthStart, to: monthStart };
    const db = this.prisma.db;

    const [
      leadsToday, leadsThisWeek, leadsThisMonth, leadsPrevMonth, openLeads, pipelineRows,
      revenueThisMonth, revenuePrevMonth,
      openConversations, voiceCallsThisWeek, conversationsEver,
      bookedThisWeek, bookingsEver,
      jobsOpen, jobsCompletedThisMonth, jobsEver,
      outstandingAgg, overdueInvoices,
      urgentOpenJobs, pendingApprovals, openTasks, overdueTasks,
      automationRulesEnabled, automationEventsThisWeek,
      aiTasksThisWeek, aiTasksEver,
    ] = await Promise.all([
      db.lead.count({ where: { createdAt: { gte: dayStart } } }),
      db.lead.count({ where: { createdAt: { gte: weekAgo } } }),
      db.lead.count({ where: { createdAt: { gte: monthStart } } }),
      db.lead.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
      db.lead.count({ where: { stage: { in: OPEN_LEAD as any } } }),
      db.lead.findMany({ where: { stage: { in: OPEN_LEAD as any } }, select: { estimatedValue: true } }),
      this.ledgerSum('CREDIT', month),
      this.ledgerSum('CREDIT', prevMonth),
      db.conversation.count({ where: { status: 'OPEN' as any } }),
      db.conversation.count({ where: { channel: 'VOICE' as any, createdAt: { gte: weekAgo } } }),
      db.conversation.count(),
      db.booking.count({ where: { createdAt: { gte: weekAgo }, status: { not: 'CANCELLED' as any } } }),
      db.booking.count(),
      db.job.count({ where: { status: { in: OPEN_JOB as any } } }),
      db.job.count({ where: { completedAt: { gte: monthStart } } }),
      db.job.count(),
      db.document.aggregate({ where: { type: 'INVOICE' as any, status: { in: ['SENT', 'VIEWED'] as any } }, _sum: { amount: true }, _count: true }),
      db.document.count({ where: { type: 'INVOICE' as any, status: { in: ['SENT', 'VIEWED'] as any }, createdAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } }),
      db.job.count({ where: { priority: 'EMERGENCY' as any, status: { in: ['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED'] as any } } }),
      db.jobApproval.count({ where: { status: 'PENDING' as any } }),
      db.activity.count({ where: { type: 'TASK' as any, status: 'OPEN' as any } }),
      db.activity.count({ where: { type: 'TASK' as any, status: 'OPEN' as any, dueAt: { lt: now } } }),
      db.automationRule.count({ where: { enabled: true } }),
      db.eventLog.count({ where: { createdAt: { gte: weekAgo } } }),
      db.agentTask.count({ where: { createdAt: { gte: weekAgo } } }),
      db.agentTask.count(),
    ]);

    const [recentActivity, revenueSeries] = await Promise.all([
      this.recentActivity(),
      this.timeseries('revenue', { from: new Date(now.getTime() - 30 * 86_400_000), to: now }),
    ]);

    return {
      generatedAt: now.toISOString(),
      kpis: {
        leadsToday, leadsThisWeek, leadsThisMonth, leadsPrevMonth,
        openLeads,
        pipelineValue: this.sumDecimal(pipelineRows, 'estimatedValue'),
        revenueThisMonth, revenuePrevMonth,
        openConversations, voiceCallsThisWeek,
        bookedThisWeek,
        jobsOpen, jobsCompletedThisMonth,
        outstandingInvoicesAmount: Number(outstandingAgg._sum.amount ?? 0),
        outstandingInvoicesCount: outstandingAgg._count,
        automationRulesEnabled, automationEventsThisWeek,
        aiTasksThisWeek,
      },
      attention: { overdueInvoices, urgentOpenJobs, pendingApprovals, overdueTasks, openTasks },
      recentActivity,
      revenueSeries,
      modules: {
        jobs: jobsEver > 0,
        bookings: bookingsEver > 0,
        conversations: conversationsEver > 0,
        ai: aiTasksEver > 0,
        automation: automationRulesEnabled > 0,
      },
    };
  }

  /** Most recent real business events, merged across sources (newest first). */
  private async recentActivity(limit = 10) {
    const db = this.prisma.db;
    const [leads, payments, jobs, conversations, agentTasks] = await Promise.all([
      db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, createdAt: true, serviceType: true, source: true, contact: { select: { name: true } } } }),
      db.payment.findMany({ where: { status: 'SUCCEEDED' as any }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, updatedAt: true, amount: true, contact: { select: { name: true } } } }),
      db.job.findMany({ where: { completedAt: { not: null } }, orderBy: { completedAt: 'desc' }, take: limit, select: { id: true, completedAt: true, title: true } }),
      db.conversation.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, createdAt: true, channel: true, contact: { select: { name: true } } } }),
      db.agentTask.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, createdAt: true, agentKey: true, type: true, status: true } }),
    ]);
    const items = [
      ...leads.map((l) => ({ id: `lead-${l.id}`, kind: 'lead', at: l.createdAt, title: `New lead${l.contact?.name ? ` — ${l.contact.name}` : ''}`, detail: l.serviceType ?? l.source ?? null })),
      ...payments.map((p) => ({ id: `payment-${p.id}`, kind: 'payment', at: p.updatedAt, title: `Payment received — $${Number(p.amount).toLocaleString()}`, detail: p.contact?.name ?? null })),
      ...jobs.map((j) => ({ id: `job-${j.id}`, kind: 'job', at: j.completedAt as Date, title: `Job completed — ${j.title}`, detail: null as string | null })),
      ...conversations.map((c) => ({ id: `conversation-${c.id}`, kind: 'conversation', at: c.createdAt, title: `${String(c.channel).charAt(0) + String(c.channel).slice(1).toLowerCase()} conversation started`, detail: c.contact?.name ?? null })),
      ...agentTasks.map((t) => ({ id: `ai-${t.id}`, kind: 'ai', at: t.createdAt, title: `AI ${t.agentKey} ran ${t.type}`, detail: String(t.status).toLowerCase() })),
    ];
    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit)
      .map((i) => ({ ...i, at: new Date(i.at).toISOString() }));
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
