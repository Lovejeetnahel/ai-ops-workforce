import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../analytics/analytics.service';

/**
 * The predictive intelligence engine. Uses real, explainable statistics
 * (linear-trend regression, rates, recency, z-scores) over the existing data —
 * no opaque model and no fabricated numbers. Every prediction is persisted as an
 * Insight (Prediction row) and emitted for downstream agents/automations.
 */
@Injectable()
export class PredictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async revenueForecast(horizonDays = 30) {
    const series = await this.analytics.timeseries('revenue', AnalyticsService.defaultRange(60));
    const points = series.map((s, i) => ({ x: i, y: s.value }));
    const { slope, intercept } = linreg(points);
    const baseX = points.length;
    let projected = 0;
    for (let d = 0; d < horizonDays; d++) projected += Math.max(0, intercept + slope * (baseX + d));
    const confidence = points.length >= 14 ? 0.7 : points.length >= 5 ? 0.5 : 0.3;
    return this.store('revenue_forecast', { value: round(projected), confidence, horizonDays, data: { slope: round(slope), dailyAvg: round(intercept + slope * baseX) } });
  }

  async cashFlowForecast(horizonDays = 30) {
    const revenue = await this.analytics.timeseries('revenue', AnalyticsService.defaultRange(60));
    const cost = await this.analytics.timeseries('cost', AnalyticsService.defaultRange(60));
    const rev = projectSum(revenue.map((s, i) => ({ x: i, y: s.value })), horizonDays);
    const cst = projectSum(cost.map((s, i) => ({ x: i, y: s.value })), horizonDays);
    return this.store('cash_flow_forecast', { value: round(rev - cst), confidence: 0.6, horizonDays, data: { revenue: round(rev), cost: round(cst) } });
  }

  async leadConversionProbability() {
    const range = AnalyticsService.defaultRange(90);
    const total = await this.prisma.db.lead.count({ where: { createdAt: { gte: range.from } } });
    const won = await this.prisma.db.lead.count({ where: { stage: 'COMPLETED', updatedAt: { gte: range.from } } });
    const prob = total ? won / total : 0;
    return this.store('lead_conversion', { value: round(prob * 100), confidence: total >= 20 ? 0.7 : 0.4, data: { total, won } });
  }

  async churnRisk(contactId: string) {
    const jobs = await this.prisma.db.job.findMany({ where: { contactId }, select: { completedAt: true, status: true } });
    const last = jobs.map((j) => j.completedAt).filter(Boolean).map((d) => new Date(d as Date).getTime()).sort().pop();
    const daysSince = last ? (Date.now() - last) / 86_400_000 : 999;
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    let risk = Math.min(100, Math.round(daysSince / 3) - completed * 5);
    risk = Math.max(0, risk);
    return this.store('churn', { subjectType: 'CUSTOMER', subjectId: contactId, value: risk, confidence: 0.6, label: risk > 60 ? 'high' : risk > 30 ? 'medium' : 'low', data: { daysSince: round(daysSince), completed } });
  }

  async customerLifetimeValue(contactId: string) {
    const payments = await this.prisma.db.payment.findMany({ where: { contactId, status: 'SUCCEEDED' }, select: { amount: true } });
    const historic = payments.reduce((s, p) => s + Number(p.amount), 0);
    const avg = payments.length ? historic / payments.length : 0;
    const projected = historic + avg * 3; // simple repeat-purchase projection
    return this.store('clv', { subjectType: 'CUSTOMER', subjectId: contactId, value: round(projected), confidence: payments.length >= 2 ? 0.6 : 0.3, data: { historic: round(historic), avgOrder: round(avg) } });
  }

  async demandForecast() {
    const jobs = await this.prisma.db.job.findMany({ where: { createdAt: { gte: AnalyticsService.defaultRange(56).from } }, select: { createdAt: true } });
    const weekly = new Map<number, number>();
    for (const j of jobs) {
      const week = Math.floor((Date.now() - j.createdAt.getTime()) / (7 * 86_400_000));
      weekly.set(week, (weekly.get(week) ?? 0) + 1);
    }
    const series = [...weekly.entries()].sort((a, b) => b[0] - a[0]).map(([, v], i) => ({ x: i, y: v }));
    const next = Math.max(0, Math.round(projectSum(series, 1)));
    return this.store('demand_forecast', { value: next, confidence: series.length >= 4 ? 0.6 : 0.3, horizonDays: 7, data: { weeklyHistory: series.map((s) => s.y) } });
  }

  async detectAnomalies() {
    const series = await this.analytics.timeseries('revenue', AnalyticsService.defaultRange(45));
    const values = series.map((s) => s.value);
    if (values.length < 7) return this.store('anomaly', { value: 0, confidence: 0.2, data: { anomalies: [] } });
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    const anomalies = series.filter((s) => Math.abs(s.value - mean) > 2 * std).map((s) => ({ date: s.date, value: s.value, z: round((s.value - mean) / std) }));
    return this.store('anomaly', { value: anomalies.length, confidence: 0.7, data: { mean: round(mean), std: round(std), anomalies } });
  }

  recent(type?: string) {
    return this.prisma.db.prediction.findMany({ where: { ...(type ? { type } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  private async store(type: string, p: { value?: number; label?: string; confidence?: number; horizonDays?: number; subjectType?: string; subjectId?: string; data?: unknown }) {
    const prediction = await this.prisma.db.prediction.create({
      data: { type, value: p.value ?? null, label: p.label ?? null, confidence: p.confidence ?? null, horizonDays: p.horizonDays ?? null, subjectType: p.subjectType ?? null, subjectId: p.subjectId ?? null, data: (p.data ?? {}) as any } as any,
    });
    await this.bus.emit({ name: DomainEvents.PREDICTION_CREATED, tenantId: tenantContext.tenantId, payload: { prediction: { id: prediction.id, type, value: p.value } } });
    return prediction;
  }
}

function linreg(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function projectSum(points: { x: number; y: number }[], horizon: number): number {
  const { slope, intercept } = linreg(points);
  const baseX = points.length;
  let sum = 0;
  for (let d = 0; d < horizon; d++) sum += Math.max(0, intercept + slope * (baseX + d));
  return sum;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
