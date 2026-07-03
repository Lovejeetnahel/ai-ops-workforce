import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PredictionService } from './prediction.service';

/**
 * AI Executive Intelligence — the daily briefing and "what should I do today?"
 * advisor. Assembles real KPIs + predictions + operational signals and asks the
 * LLM for a prioritized briefing. Reuses Analytics + Predictions; no separate
 * data path. Falls back to a structured digest when no LLM key is set.
 */
@Injectable()
export class BriefingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly analytics: AnalyticsService,
    private readonly predictions: PredictionService,
  ) {}

  async daily() {
    const dashboard = await this.analytics.domainDashboard('executive');
    const [forecast, overdue, pendingApprovals, urgentJobs] = await Promise.all([
      this.predictions.revenueForecast(30),
      this.prisma.db.document.count({ where: { type: 'INVOICE', status: { in: ['SENT', 'VIEWED'] }, createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } }),
      this.prisma.db.jobApproval.count({ where: { status: 'PENDING' } }),
      this.prisma.db.job.count({ where: { priority: 'EMERGENCY', status: { in: ['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED'] } } }),
    ]);

    const signals = {
      kpis: dashboard.kpis,
      revenueForecast30d: Number(forecast.value ?? 0),
      overdueInvoices: overdue,
      pendingApprovals,
      urgentOpenJobs: urgentJobs,
    };

    const briefing = await this.narrate(signals);
    return { date: new Date().toISOString().slice(0, 10), signals, briefing };
  }

  private async narrate(signals: Record<string, unknown>): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Structured digest fallback — real, not a placeholder.
      return [
        `Revenue (30d): $${(signals.kpis as any[])?.find((k) => k.key === 'revenue')?.value ?? 0}.`,
        `Forecast next 30d: $${signals.revenueForecast30d}.`,
        `${signals.overdueInvoices} overdue invoice(s), ${signals.pendingApprovals} approval(s) pending, ${signals.urgentOpenJobs} urgent open job(s).`,
        `Priorities: clear urgent jobs, push approvals, chase overdue invoices.`,
      ].join(' ');
    }
    const res = await this.providers.llm().complete({
      system: 'You are the CEO\'s chief of staff. Give a punchy daily briefing: 2-sentence state of the business, then a numbered "Do today" list of the top 3 actions, justified by the numbers.',
      messages: [{ role: 'user', content: JSON.stringify(signals) }],
      maxTokens: 400,
    });
    return res.text;
  }
}
