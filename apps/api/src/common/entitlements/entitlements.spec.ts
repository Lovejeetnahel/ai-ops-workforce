import { resolveState } from './entitlements.service';
import { PLANS, planByKey, upgradeTargetFor, TRIAL_DAYS, PAST_DUE_GRACE_DAYS } from './plans';
import { verifyStripeSignature } from '../../integrations/adapters/stripe.adapter';
import { createHmac } from 'node:crypto';

describe('plan catalog integrity (Sprint 4)', () => {
  it('has three plans with complete, monotonically increasing limits', () => {
    expect(PLANS.map((p) => p.key)).toEqual(['starter', 'pro', 'enterprise']);
    const keys = Object.keys(PLANS[0].limits);
    expect(keys.length).toBeGreaterThanOrEqual(12);
    for (const key of keys) {
      const [s, p, e] = PLANS.map((pl) => (pl.limits as any)[key]);
      expect(s).toBeGreaterThan(0);
      expect(p).toBeGreaterThanOrEqual(s);
      expect(e).toBeGreaterThanOrEqual(p);
    }
  });

  it('every plan declares a Stripe price ENV NAME, never a hardcoded price id', () => {
    for (const p of PLANS) {
      expect(p.stripePriceEnv).toMatch(/^STRIPE_PRICE_[A-Z]+$/);
    }
  });

  it('planByKey and upgradeTargetFor resolve correctly', () => {
    expect(planByKey('pro')!.name).toBe('Pro');
    expect(planByKey('nope')).toBeNull();
    // At starter's seat limit (3), the upgrade target is pro.
    expect(upgradeTargetFor('staffSeats', 3)!.key).toBe('pro');
    // Beyond every plan there is honestly no target.
    expect(upgradeTargetFor('staffSeats', 100)).toBeNull();
  });

  it('trial and grace constants are sane', () => {
    expect(TRIAL_DAYS).toBeGreaterThanOrEqual(7);
    expect(PAST_DUE_GRACE_DAYS).toBeGreaterThanOrEqual(7);
  });
});

describe('subscription state machine', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('no subscription row → warn-only state', () => {
    expect(resolveState(null)).toBe('no_subscription');
  });

  it('trialing with future trial end stays trialing; past becomes trial_expired', () => {
    expect(resolveState({ status: 'trialing', trialEndsAt: future, graceUntil: null, pastDueSince: null })).toBe('trialing');
    expect(resolveState({ status: 'trialing', trialEndsAt: past, graceUntil: null, pastDueSince: null })).toBe('trial_expired');
  });

  it('past_due honors the grace window, then locks', () => {
    expect(resolveState({ status: 'past_due', trialEndsAt: null, graceUntil: future, pastDueSince: past })).toBe('past_due_grace');
    expect(resolveState({ status: 'past_due', trialEndsAt: null, graceUntil: past, pastDueSince: past })).toBe('past_due_locked');
  });

  it('past_due without explicit grace derives it from pastDueSince', () => {
    const recent = new Date(Date.now() - 2 * 86_400_000);
    expect(resolveState({ status: 'past_due', trialEndsAt: null, graceUntil: null, pastDueSince: recent })).toBe('past_due_grace');
    const old = new Date(Date.now() - (PAST_DUE_GRACE_DAYS + 2) * 86_400_000);
    expect(resolveState({ status: 'past_due', trialEndsAt: null, graceUntil: null, pastDueSince: old })).toBe('past_due_locked');
  });

  it('terminal provider statuses map to canceled', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
      expect(resolveState({ status, trialEndsAt: null, graceUntil: null, pastDueSince: null })).toBe('canceled');
    }
  });

  it('an unknown provider status never locks a paying customer out', () => {
    expect(resolveState({ status: 'weird_future_status', trialEndsAt: null, graceUntil: null, pastDueSince: null })).toBe('active');
  });
});

describe('Stripe webhook signature verification (shared by payments + billing)', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
  const sign = (ts: number, b: string, s: string) => createHmac('sha256', s).update(`${ts}.${b}`).digest('hex');

  it('accepts a valid signature', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() => verifyStripeSignature(body, `t=${ts},v1=${sign(ts, body, secret)}`, secret)).not.toThrow();
  });

  it('rejects a wrong secret, a tampered body, a replayed timestamp, and a missing header', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() => verifyStripeSignature(body, `t=${ts},v1=${sign(ts, body, 'other')}`, secret)).toThrow();
    expect(() => verifyStripeSignature(body + 'x', `t=${ts},v1=${sign(ts, body, secret)}`, secret)).toThrow();
    const old = ts - 10 * 60;
    expect(() => verifyStripeSignature(body, `t=${old},v1=${sign(old, body, secret)}`, secret)).toThrow();
    expect(() => verifyStripeSignature(body, '', secret)).toThrow();
  });
});
