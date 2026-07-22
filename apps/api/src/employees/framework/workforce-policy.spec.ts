import { parseEmployeeConfig, parseSchedule, validateEmployeeConfigInput, CONFIG_LIMITS } from './employee-config';
import { riskOf, verdictFor } from './action-risk.policy';
import { validateToolArgs, actionIdempotencyKey } from './tool-gateway.service';
import { estimateCostMicros, parsePricingEnv } from './ai-usage.service';
import { computeNextRun } from './employee-scheduler.service';

describe('employee config validation', () => {
  it('drops invalid fields and caps lengths on read', () => {
    const parsed = parseEmployeeConfig({
      personality: 'x'.repeat(CONFIG_LIMITS.personality + 500),
      instructions: 42, // wrong type → dropped
      goal: '  close more deals  ',
      kpis: ['a', '', 3, 'b'.repeat(CONFIG_LIMITS.kpiLength + 50)],
      schedule: { frequency: 'hourly', hour: 9, taskType: 'daily_digest' }, // invalid frequency
      injected: 'ignored',
    });
    expect(parsed.personality!.length).toBe(CONFIG_LIMITS.personality);
    expect(parsed.instructions).toBeUndefined();
    expect(parsed.goal).toBe('close more deals');
    expect(parsed.kpis).toEqual(['a', 'b'.repeat(CONFIG_LIMITS.kpiLength)]);
    expect(parsed.schedule).toBeUndefined();
    expect((parsed as any).injected).toBeUndefined();
  });

  it('accepts a valid weekly schedule and rejects weekly without dayOfWeek', () => {
    expect(parseSchedule({ frequency: 'weekly', hour: 8, dayOfWeek: 1, taskType: 'weekly_report' })).toEqual({ frequency: 'weekly', hour: 8, dayOfWeek: 1, taskType: 'weekly_report' });
    expect(parseSchedule({ frequency: 'weekly', hour: 8, taskType: 'weekly_report' })).toBeUndefined();
    expect(parseSchedule({ frequency: 'daily', hour: 24, taskType: 'x' })).toBeUndefined();
  });

  it('strict input validation reports errors instead of silently dropping', () => {
    expect(validateEmployeeConfigInput({ personality: 'ok' })).toEqual([]);
    expect(validateEmployeeConfigInput({ personality: 'x'.repeat(CONFIG_LIMITS.personality + 1) })).toHaveLength(1);
    expect(validateEmployeeConfigInput({ kpis: 'not-array' })).toHaveLength(1);
    expect(validateEmployeeConfigInput({ schedule: { frequency: 'daily' } })).toHaveLength(1);
  });
});

describe('action-risk policy (authority is independent of permission)', () => {
  it('classifies external-impact vs safe tools', () => {
    expect(riskOf('sms')).toBe('EXTERNAL_IMPACT');
    expect(riskOf('payment_link')).toBe('EXTERNAL_IMPACT');
    expect(riskOf('search_knowledge')).toBe('SAFE');
    expect(riskOf('generate_quote')).toBe('SAFE'); // draft-only
    expect(riskOf('a_future_unknown_tool')).toBe('EXTERNAL_IMPACT'); // fail closed
  });

  it('maps authority × risk to the right verdict', () => {
    expect(verdictFor('sms', 'AUTONOMOUS')).toBe('EXECUTE');
    expect(verdictFor('sms', 'APPROVE')).toBe('REQUIRE_APPROVAL');
    expect(verdictFor('sms', 'SUGGEST')).toBe('DENY');
    expect(verdictFor('search_knowledge', 'SUGGEST')).toBe('EXECUTE'); // safe tools always run
  });
});

describe('tool argument validation', () => {
  it('requires the schema fields and rejects unexpected ones', () => {
    expect(validateToolArgs('sms', { to: '+15550001111', body: 'hi' })).toEqual([]);
    expect(validateToolArgs('sms', { to: '+15550001111' })).toEqual(['missing required argument: body']);
    expect(validateToolArgs('sms', { to: '+1', body: 'hi', evil: true })).toEqual(['unexpected argument: evil']);
    expect(validateToolArgs('nonexistent_tool', {})).toEqual(['unknown tool: nonexistent_tool']);
  });

  it('idempotency key is stable for identical intent and distinct otherwise', () => {
    const a = actionIdempotencyKey('t1', 'sales', 'sms', { to: '+1', body: 'x' }, 'task1');
    const b = actionIdempotencyKey('t1', 'sales', 'sms', { to: '+1', body: 'x' }, 'task1');
    const c = actionIdempotencyKey('t1', 'sales', 'sms', { to: '+1', body: 'different' }, 'task1');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('scheduler next-run computation (tenant timezone)', () => {
  it('computes the next daily occurrence in the tenant timezone', () => {
    // 2026-07-22 12:00:00 UTC = 08:00 in New York (EDT). Next 9am NY = 13:00 UTC same day.
    const from = new Date('2026-07-22T12:00:00Z');
    const next = computeNextRun({ frequency: 'daily', hour: 9, taskType: 'daily_digest' }, 'America/New_York', from);
    expect(next.toISOString()).toBe('2026-07-22T13:00:00.000Z');
  });

  it('rolls to the next day when the hour already passed locally', () => {
    // 20:00 UTC = 16:00 NY; 9am NY already passed → tomorrow 13:00 UTC.
    const from = new Date('2026-07-22T20:00:00Z');
    const next = computeNextRun({ frequency: 'daily', hour: 9, taskType: 'daily_digest' }, 'America/New_York', from);
    expect(next.toISOString()).toBe('2026-07-23T13:00:00.000Z');
  });

  it('honors weekly dayOfWeek', () => {
    // 2026-07-22 is a Wednesday. Next Monday (1) 08:00 NY = 2026-07-27 12:00 UTC.
    const from = new Date('2026-07-22T12:00:00Z');
    const next = computeNextRun({ frequency: 'weekly', hour: 8, dayOfWeek: 1, taskType: 'weekly_report' }, 'America/New_York', from);
    expect(next.toISOString()).toBe('2026-07-27T12:00:00.000Z');
  });

  it('always returns a strictly future time', () => {
    const from = new Date('2026-01-05T09:00:00Z');
    const next = computeNextRun({ frequency: 'daily', hour: 9, taskType: 'x' }, 'UTC', from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe('AI cost estimation (tokens are facts, money is an estimate)', () => {
  const pricing = parsePricingEnv(JSON.stringify({ 'claude-opus-4-8': { inPerMTokMicros: 15_000_000, outPerMTokMicros: 75_000_000 } }));

  it('computes BigInt micros without sub-cent loss', () => {
    // 1000 in / 500 out → 15000 + 37500 micros = 52,500 micros (≈ $0.0525)
    expect(estimateCostMicros({ model: 'claude-opus-4-8', inputTokens: 1000, outputTokens: 500 }, pricing)).toBe(52_500n);
    // A tiny call still records non-zero cost — the reason costCents was rejected.
    expect(estimateCostMicros({ model: 'claude-opus-4-8', inputTokens: 10, outputTokens: 5 }, pricing)).toBe(525n);
  });

  it('returns null (not zero) for unpriced models and never crashes on bad env', () => {
    expect(estimateCostMicros({ model: 'unknown-model', inputTokens: 10, outputTokens: 5 }, pricing)).toBeNull();
    expect(parsePricingEnv('not json')).toEqual({});
    expect(parsePricingEnv(JSON.stringify({ m: { inPerMTokMicros: 'NaN' } }))).toEqual({});
    expect(parsePricingEnv(undefined)).toEqual({});
  });
});
