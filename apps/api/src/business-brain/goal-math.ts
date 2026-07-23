/**
 * Pure Business Brain math — goal health, KPI attainment/trend/health and the
 * composite business health score. No I/O, fully unit-tested. Every number is
 * DERIVED from real inputs; missing data yields explicit null/'untracked'
 * states, never invented values.
 */

export type GoalHealth = 'ON_TRACK' | 'AT_RISK' | 'OVERDUE' | 'DONE' | 'INACTIVE';
export type KpiHealthState = 'HEALTHY' | 'WATCH' | 'AT_RISK' | 'UNTRACKED';
export type KpiTrend = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';

export interface GoalLike {
  status: string;
  progress: number; // 0-100
  dueAt?: Date | string | null;
  startAt?: Date | string | null;
}

/**
 * Health of a single goal from status + progress + schedule. A goal with a
 * due date is AT_RISK when elapsed time outpaces progress by more than 20
 * points (e.g. 70% of the window gone but only 40% progress).
 */
export function goalHealth(goal: GoalLike, now: Date = new Date()): GoalHealth {
  if (goal.status === 'ACHIEVED') return 'DONE';
  if (goal.status !== 'ACTIVE') return goal.status === 'MISSED' ? 'OVERDUE' : 'INACTIVE';
  const due = goal.dueAt ? new Date(goal.dueAt) : null;
  if (due && due < now) return 'OVERDUE';
  if (due) {
    const start = goal.startAt ? new Date(goal.startAt) : null;
    if (start && due > start) {
      const elapsedPct = Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / (due.getTime() - start.getTime())) * 100));
      if (elapsedPct - goal.progress > 20) return 'AT_RISK';
    }
  }
  return 'ON_TRACK';
}

export interface KpiLike {
  direction: string; // UP_IS_GOOD | DOWN_IS_GOOD
  currentValue?: number | null;
  targetValue?: number | null;
}

/**
 * Attainment percentage toward target (0-200 clamp), direction-aware.
 * null when either side is missing — attainment is never invented.
 */
export function kpiAttainment(kpi: KpiLike): number | null {
  const cur = kpi.currentValue;
  const tgt = kpi.targetValue;
  if (cur === null || cur === undefined || tgt === null || tgt === undefined) return null;
  if (kpi.direction === 'DOWN_IS_GOOD') {
    // At/below target = 100%+. current 0 with any positive target = fully attained.
    if (cur <= 0) return 200;
    if (tgt <= 0) return cur <= 0 ? 200 : 0;
    return clamp((tgt / cur) * 100);
  }
  if (tgt === 0) return cur >= 0 ? 200 : 0;
  return clamp((cur / tgt) * 100);
}

function clamp(pct: number): number {
  return Math.max(0, Math.min(200, Math.round(pct)));
}

export function kpiHealth(kpi: KpiLike): KpiHealthState {
  const attainment = kpiAttainment(kpi);
  if (attainment === null) return 'UNTRACKED';
  if (attainment >= 90) return 'HEALTHY';
  if (attainment >= 60) return 'WATCH';
  return 'AT_RISK';
}

/** Trend from the two most recent observations (newest first). */
export function kpiTrend(values: number[]): KpiTrend {
  if (values.length < 2) return 'UNKNOWN';
  const [latest, prev] = values;
  if (prev === 0) return latest === 0 ? 'FLAT' : latest > 0 ? 'UP' : 'DOWN';
  const change = (latest - prev) / Math.abs(prev);
  if (change > 0.02) return 'UP';
  if (change < -0.02) return 'DOWN';
  return 'FLAT';
}

export interface HealthInputs {
  /** Average progress (0-100) across ACTIVE goals; null when no active goals. */
  avgGoalProgress: number | null;
  /** Count of ACTIVE goals that are OVERDUE or AT_RISK. */
  goalsAtRisk: number;
  activeGoals: number;
  /** KPI health states for every tracked KPI (UNTRACKED excluded by caller). */
  kpiStates: KpiHealthState[];
  overdueInvoices: number;
  pendingApprovals: number;
  failedAiTasksThisWeek: number;
}

/**
 * Composite Business Health Score (0-100) with a transparent component
 * breakdown — the dashboard shows the parts, not just the number. When a
 * component has no data it contributes its neutral baseline rather than
 * pretending perfection or failure.
 */
export function businessHealthScore(i: HealthInputs): { score: number; components: Record<string, number> } {
  // Goals component (0-40): progress vs risk.
  let goals = 24; // neutral baseline when no goals are defined yet
  if (i.activeGoals > 0 && i.avgGoalProgress !== null) {
    const riskPenalty = Math.min(20, (i.goalsAtRisk / i.activeGoals) * 20);
    goals = Math.round((i.avgGoalProgress / 100) * 40 - riskPenalty);
    goals = Math.max(0, Math.min(40, goals));
  }

  // KPI component (0-40): share of healthy KPIs.
  let kpis = 24; // neutral baseline when no KPIs are tracked yet
  if (i.kpiStates.length > 0) {
    const weight = (s: KpiHealthState) => (s === 'HEALTHY' ? 1 : s === 'WATCH' ? 0.55 : 0);
    kpis = Math.round((i.kpiStates.reduce((sum, s) => sum + weight(s), 0) / i.kpiStates.length) * 40);
  }

  // Operations component (0-20): penalize real open problems.
  const ops = Math.max(0, 20 - Math.min(10, i.overdueInvoices * 2) - Math.min(5, i.pendingApprovals) - Math.min(5, i.failedAiTasksThisWeek));

  const score = Math.max(0, Math.min(100, goals + kpis + ops));
  return { score, components: { goals, kpis, operations: ops } };
}
