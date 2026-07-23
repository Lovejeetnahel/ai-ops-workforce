import { businessHealthScore, goalHealth, kpiAttainment, kpiHealth, kpiTrend } from './goal-math';

describe('goalHealth', () => {
  const now = new Date('2026-07-23T12:00:00Z');

  it('achieved → DONE; non-active statuses are INACTIVE (MISSED reads OVERDUE)', () => {
    expect(goalHealth({ status: 'ACHIEVED', progress: 100 }, now)).toBe('DONE');
    expect(goalHealth({ status: 'PAUSED', progress: 10 }, now)).toBe('INACTIVE');
    expect(goalHealth({ status: 'DRAFT', progress: 0 }, now)).toBe('INACTIVE');
    expect(goalHealth({ status: 'MISSED', progress: 40 }, now)).toBe('OVERDUE');
  });

  it('past due → OVERDUE regardless of progress', () => {
    expect(goalHealth({ status: 'ACTIVE', progress: 95, dueAt: '2026-07-01' }, now)).toBe('OVERDUE');
  });

  it('behind schedule by >20 points → AT_RISK; otherwise ON_TRACK', () => {
    // Window Jan 1 → Dec 31 2026; late July ≈ 56% elapsed.
    const frame = { status: 'ACTIVE', startAt: '2026-01-01', dueAt: '2026-12-31' };
    expect(goalHealth({ ...frame, progress: 20 }, now)).toBe('AT_RISK');
    expect(goalHealth({ ...frame, progress: 50 }, now)).toBe('ON_TRACK');
  });

  it('no due date → ON_TRACK while active', () => {
    expect(goalHealth({ status: 'ACTIVE', progress: 0 }, now)).toBe('ON_TRACK');
  });
});

describe('kpiAttainment + kpiHealth', () => {
  it('never invents attainment when data is missing', () => {
    expect(kpiAttainment({ direction: 'UP_IS_GOOD', currentValue: null, targetValue: 100 })).toBeNull();
    expect(kpiAttainment({ direction: 'UP_IS_GOOD', currentValue: 50, targetValue: null })).toBeNull();
    expect(kpiHealth({ direction: 'UP_IS_GOOD', currentValue: null, targetValue: null })).toBe('UNTRACKED');
  });

  it('UP_IS_GOOD: 90%+ healthy, 60-89 watch, <60 at risk', () => {
    expect(kpiHealth({ direction: 'UP_IS_GOOD', currentValue: 95, targetValue: 100 })).toBe('HEALTHY');
    expect(kpiHealth({ direction: 'UP_IS_GOOD', currentValue: 70, targetValue: 100 })).toBe('WATCH');
    expect(kpiHealth({ direction: 'UP_IS_GOOD', currentValue: 20, targetValue: 100 })).toBe('AT_RISK');
  });

  it('DOWN_IS_GOOD inverts: below target is winning', () => {
    // Target: ≤5 overdue invoices. Currently 2 → attainment 250→clamped 200 → HEALTHY.
    expect(kpiHealth({ direction: 'DOWN_IS_GOOD', currentValue: 2, targetValue: 5 })).toBe('HEALTHY');
    // Currently 20 → 25% → AT_RISK.
    expect(kpiHealth({ direction: 'DOWN_IS_GOOD', currentValue: 20, targetValue: 5 })).toBe('AT_RISK');
    // Zero current with a positive target is fully attained, not a crash.
    expect(kpiAttainment({ direction: 'DOWN_IS_GOOD', currentValue: 0, targetValue: 5 })).toBe(200);
  });
});

describe('kpiTrend', () => {
  it('needs two observations; ±2% is FLAT', () => {
    expect(kpiTrend([])).toBe('UNKNOWN');
    expect(kpiTrend([100])).toBe('UNKNOWN');
    expect(kpiTrend([110, 100])).toBe('UP');
    expect(kpiTrend([90, 100])).toBe('DOWN');
    expect(kpiTrend([101, 100])).toBe('FLAT');
    expect(kpiTrend([5, 0])).toBe('UP'); // division-by-zero guard
  });
});

describe('businessHealthScore', () => {
  const base = { avgGoalProgress: null, goalsAtRisk: 0, activeGoals: 0, kpiStates: [] as any[], overdueInvoices: 0, pendingApprovals: 0, failedAiTasksThisWeek: 0 };

  it('empty business → neutral baselines, never 0 or fake 100', () => {
    const { score, components } = businessHealthScore(base);
    expect(components.goals).toBe(24);
    expect(components.kpis).toBe(24);
    expect(components.operations).toBe(20);
    expect(score).toBe(68);
  });

  it('strong goals + healthy KPIs + clean ops → high score', () => {
    const { score } = businessHealthScore({
      ...base,
      avgGoalProgress: 90, activeGoals: 3, goalsAtRisk: 0,
      kpiStates: ['HEALTHY', 'HEALTHY', 'WATCH'],
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('risk and operational problems drag the score down, floored at 0', () => {
    const { score, components } = businessHealthScore({
      avgGoalProgress: 10, activeGoals: 2, goalsAtRisk: 2,
      kpiStates: ['AT_RISK', 'AT_RISK'],
      overdueInvoices: 10, pendingApprovals: 8, failedAiTasksThisWeek: 9,
    });
    expect(components.operations).toBe(0);
    expect(components.kpis).toBe(0);
    expect(score).toBeLessThanOrEqual(10);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
