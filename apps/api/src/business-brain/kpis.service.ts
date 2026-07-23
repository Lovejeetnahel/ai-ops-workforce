import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KpiDirection } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../enterprise/analytics/analytics.service';
import { kpiAttainment, kpiHealth, kpiTrend } from './goal-math';

/**
 * Platform metric sources a KPI may bind to. Values come from the EXISTING
 * AnalyticsService (ValueLedger, leads, jobs, invoices) — real tenant data,
 * one computation path, no duplicate metric engine.
 */
export const KPI_METRIC_KEYS = [
  'revenue', 'cost', 'net_value', 'outstanding_invoices', 'avg_job_value',
  'leads_new', 'leads_won', 'conversion_rate', 'pipeline_value',
  'jobs_completed', 'jobs_open', 'active_staff',
] as const;

export interface KpiInput {
  name?: string;
  unit?: string | null;
  direction?: KpiDirection;
  metricKey?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  goalId?: string | null;
}

const METRIC_RANGE_DAYS = 30;

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * KPIs with live values, trend and health. Metric-bound KPIs are refreshed
   * from real data at read time (and snapshotted at most once per day so
   * history accrues without a separate scheduler). Manual KPIs report what
   * was last recorded — null until someone records a value, never zero-padded.
   */
  async list() {
    const kpis = await this.prisma.db.kpi.findMany({
      include: {
        goal: { select: { id: true, title: true } },
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 30 },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return Promise.all(kpis.map((k) => this.withLiveValue(k)));
  }

  async create(input: KpiInput) {
    if (!input.name?.trim()) throw new BadRequestException('KPI name is required.');
    this.assertMetricKey(input.metricKey);
    if (input.goalId) await this.assertGoal(input.goalId);
    const kpi = await this.prisma.db.kpi.create({
      data: {
        name: input.name.trim(),
        unit: input.unit ?? null,
        direction: input.direction ?? 'UP_IS_GOOD',
        metricKey: input.metricKey ?? null,
        targetValue: input.targetValue ?? null,
        currentValue: input.metricKey ? null : input.currentValue ?? null,
        goalId: input.goalId ?? null,
      } as any,
    });
    return this.withLiveValue({ ...kpi, goal: null, snapshots: [] });
  }

  async update(id: string, input: KpiInput) {
    this.assertMetricKey(input.metricKey);
    if (input.goalId) await this.assertGoal(input.goalId);
    const kpi = await this.prisma.db.kpi.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.metricKey !== undefined ? { metricKey: input.metricKey } : {}),
        ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
        ...(input.goalId !== undefined ? { goalId: input.goalId } : {}),
      },
    });
    return kpi;
  }

  /** Record a manual observation: sets currentValue + appends history. */
  async recordValue(id: string, value: number) {
    if (!Number.isFinite(value)) throw new BadRequestException('value must be a finite number.');
    const kpi = await this.prisma.db.kpi.findUnique({ where: { id } });
    if (!kpi) throw new NotFoundException('KPI not found');
    if (kpi.metricKey) {
      throw new BadRequestException(
        `This KPI tracks the platform metric "${kpi.metricKey}" — its value comes from real data and cannot be set by hand.`,
      );
    }
    await this.prisma.db.kpi.update({ where: { id }, data: { currentValue: value } });
    await this.prisma.db.kpiSnapshot.create({ data: { kpiId: id, value } as any });
    return this.get(id);
  }

  async get(id: string) {
    const kpi = await this.prisma.db.kpi.findUnique({
      where: { id },
      include: { goal: { select: { id: true, title: true } }, snapshots: { orderBy: { capturedAt: 'desc' }, take: 30 } },
    });
    if (!kpi) throw new NotFoundException('KPI not found');
    return this.withLiveValue(kpi);
  }

  async remove(id: string) {
    await this.prisma.db.kpi.delete({ where: { id } });
    return { ok: true };
  }

  private async withLiveValue(kpi: any) {
    let currentValue: number | null = kpi.currentValue;
    let snapshots: { value: number; capturedAt: Date }[] = kpi.snapshots ?? [];

    if (kpi.metricKey) {
      const now = new Date();
      currentValue = await this.analytics.metric(kpi.metricKey, {
        from: new Date(now.getTime() - METRIC_RANGE_DAYS * 86_400_000),
        to: now,
      });
      // Persist the fresh reading + at most one snapshot per calendar day.
      const today = now.toISOString().slice(0, 10);
      const latest = snapshots[0];
      if (!latest || new Date(latest.capturedAt).toISOString().slice(0, 10) !== today) {
        const snap = await this.prisma.db.kpiSnapshot.create({ data: { kpiId: kpi.id, value: currentValue } as any });
        snapshots = [snap, ...snapshots];
      }
      if (kpi.currentValue !== currentValue) {
        await this.prisma.db.kpi.update({ where: { id: kpi.id }, data: { currentValue } });
      }
    }

    const shaped = { ...kpi, currentValue, snapshots };
    return {
      ...shaped,
      attainmentPct: kpiAttainment(shaped),
      health: kpiHealth(shaped),
      trend: kpiTrend(snapshots.map((s) => s.value)),
      // Metric window so the UI can label the number honestly.
      metricWindowDays: kpi.metricKey ? METRIC_RANGE_DAYS : null,
    };
  }

  private assertMetricKey(metricKey?: string | null) {
    if (metricKey && !KPI_METRIC_KEYS.includes(metricKey as any)) {
      throw new BadRequestException(`Unknown metricKey "${metricKey}". Valid: ${KPI_METRIC_KEYS.join(', ')} — or omit it for a manual KPI.`);
    }
  }

  private async assertGoal(goalId: string) {
    const goal = await this.prisma.db.goal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (!goal) throw new BadRequestException('goalId does not reference a goal in this business.');
  }
}
