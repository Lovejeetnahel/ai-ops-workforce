import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../analytics/analytics.service';

/**
 * Enterprise reporting engine. Report definitions can be ad-hoc or scheduled
 * (cron stored for a scheduler). Generation reuses the Analytics engine; CSV is
 * produced natively. PDF/Excel are render targets layered on the same data.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly analytics: AnalyticsService,
  ) {}

  listDefinitions() {
    return this.prisma.db.reportDefinition.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createDefinition(input: { key: string; name: string; type: string; format?: string; schedule?: string; recipients?: string[]; config?: unknown }) {
    return this.prisma.db.reportDefinition.upsert({
      where: { tenantId_key: { tenantId: tenantContext.tenantId, key: input.key } },
      update: { name: input.name, type: input.type, format: input.format ?? 'json', schedule: input.schedule ?? null, recipients: input.recipients ?? [], config: (input.config ?? {}) as any },
      create: { key: input.key, name: input.name, type: input.type, format: input.format ?? 'json', schedule: input.schedule ?? null, recipients: input.recipients ?? [], config: (input.config ?? {}) as any } as any,
    });
  }

  async generate(type: string, days = 30) {
    const dashboard = await this.analytics.domainDashboard(type, AnalyticsService.defaultRange(days));
    const report = { type, generatedAt: new Date().toISOString(), periodDays: days, kpis: dashboard.kpis, series: dashboard.series };
    await this.bus.emit({ name: DomainEvents.REPORT_GENERATED, tenantId: tenantContext.tenantId, payload: { report: { type } } });
    return report;
  }

  /** CSV export of a report's KPIs. */
  toCsv(report: { kpis: { key: string; label: string; value: number }[] }): string {
    const rows = [['Metric', 'Key', 'Value'], ...report.kpis.map((k) => [k.label, k.key, String(k.value)])];
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }
}
