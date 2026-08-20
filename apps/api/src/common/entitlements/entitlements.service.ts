import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tenantContext } from '../tenancy/tenant-context';
import { LimitKey, PAST_DUE_GRACE_DAYS, PLANS, PlanDef, planByKey, upgradeTargetFor } from './plans';

/**
 * Sprint 4: the ONE place plan limits become runtime enforcement. Feature
 * modules call `require(limitKey)` on their WRITE paths (creates only) —
 * reads and exports are never gated, so a customer over a limit can always
 * access their own data.
 *
 * Subscription states and what they enforce:
 *  • no_subscription — pre-Sprint-4 tenants have no Subscription row. Warn
 *    only, block nothing: hard-enforcing on deploy would lock out every
 *    existing customer (destructive), so enforcement begins when a
 *    Subscription row exists (created at signup from Sprint 4 onward).
 *  • trialing            — full plan limits enforced.
 *  • active              — full plan limits enforced.
 *  • past_due (in grace) — limits enforced + warning banner state.
 *  • trial_expired / past_due beyond grace / canceled — gated CREATES are
 *    blocked with SUBSCRIPTION_REQUIRED; existing data stays fully readable.
 */
export type SubscriptionState =
  | 'no_subscription'
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'past_due_grace'
  | 'past_due_locked'
  | 'canceled';

export interface EntitlementCheck {
  allowed: boolean;
  state: SubscriptionState;
  limitKey: LimitKey;
  used: number;
  limit: number | null;
  code?: 'LIMIT_REACHED' | 'SUBSCRIPTION_REQUIRED';
  reason?: string;
  upgrade?: { planKey: string; planName: string } | null;
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the tenant's subscription, plan and enforcement state. */
  async resolve(): Promise<{ subscription: any; plan: PlanDef; state: SubscriptionState; enforced: boolean }> {
    const subscription = await this.prisma.db.subscription.findUnique({ where: { tenantId: tenantContext.tenantId } });
    const plan = planByKey(subscription?.planKey) ?? PLANS[0];
    const state = resolveState(subscription);
    const enforced = subscription != null; // see class doc: no row → warn-only
    return { subscription, plan, state, enforced };
  }

  /** Live usage count for one limit — always from source-of-truth tables. */
  async count(key: LimitKey): Promise<number> {
    const db = this.prisma.db;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    switch (key) {
      case 'staffSeats':
        return db.user.count({ where: { role: { in: ['OWNER', 'ADMIN', 'STAFF'] }, status: 'ACTIVE' } });
      case 'locations':
        return db.location.count({ where: { active: true } });
      case 'aiEmployees':
        return db.agentInstallation.count({ where: { enabled: true } });
      case 'aiTasksMonthly':
        return db.agentTask.count({ where: { createdAt: { gte: monthStart } } });
      case 'voiceMinutesMonthly': {
        const agg = await db.callRecord.aggregate({ where: { startedAt: { gte: monthStart } }, _sum: { durationSec: true } });
        return Math.round(Number(agg._sum.durationSec ?? 0) / 60);
      }
      case 'messagesMonthly': {
        const [replies, sends] = await Promise.all([
          db.message.count({ where: { direction: 'OUTBOUND', isInternal: false, createdAt: { gte: monthStart } } }),
          db.campaignRecipient.count({ where: { status: 'SENT', sentAt: { gte: monthStart } } }),
        ]);
        return replies + sends;
      }
      case 'contacts':
        return db.contact.count();
      case 'automationRules':
        return db.automationRule.count({ where: { enabled: true } });
      case 'campaignsMonthly':
        return db.campaign.count({ where: { isTemplate: false, createdAt: { gte: monthStart } } });
      case 'sites':
        return db.site.count();
      case 'portalUsers':
        return db.customerPortalUser.count();
      case 'apiKeys':
        return db.apiKey.count();
    }
  }

  /**
   * Check whether one more unit of `limitKey` is allowed. `increment` covers
   * bulk operations (e.g. a campaign about to send N messages).
   */
  async check(limitKey: LimitKey, increment = 1): Promise<EntitlementCheck> {
    const { plan, state, enforced } = await this.resolve();
    const used = await this.count(limitKey);
    const limit = plan.limits[limitKey];
    const base: EntitlementCheck = { allowed: true, state, limitKey, used, limit, upgrade: null };
    if (!enforced) {
      if (used + increment > limit) {
        base.reason = `Over the ${plan.name} plan's ${describeLimit(limitKey)} limit (${used}/${limit}) — nothing is blocked without a subscription, but a plan will be required.`;
      }
      return base;
    }
    if (state === 'trial_expired' || state === 'past_due_locked' || state === 'canceled') {
      const why =
        state === 'trial_expired'
          ? 'Your free trial has ended.'
          : state === 'canceled'
            ? 'Your subscription is canceled.'
            : 'Your subscription is past due and the grace period has ended.';
      return {
        ...base,
        allowed: false,
        code: 'SUBSCRIPTION_REQUIRED',
        reason: `${why} Your existing data remains fully accessible — reactivate a plan to keep creating new work.`,
        upgrade: { planKey: plan.key, planName: plan.name },
      };
    }
    if (used + increment > limit) {
      const target = upgradeTargetFor(limitKey, used + increment - 1);
      return {
        ...base,
        allowed: false,
        code: 'LIMIT_REACHED',
        reason: `Your ${plan.name} plan includes ${limit} ${describeLimit(limitKey)} and you are at ${used}. Upgrade to add more.`,
        upgrade: target ? { planKey: target.key, planName: target.name } : null,
      };
    }
    return base;
  }

  /** Enforce on a write path: throws 402 with a structured, honest payload. */
  async require(limitKey: LimitKey, increment = 1): Promise<EntitlementCheck> {
    const result = await this.check(limitKey, increment);
    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: 402,
          error: 'Payment Required',
          code: result.code,
          message: result.reason,
          limitKey: result.limitKey,
          used: result.used,
          limit: result.limit,
          state: result.state,
          upgrade: result.upgrade,
        },
        402,
      );
    }
    return result;
  }

  /** Full usage-vs-limits snapshot for the billing UI (all live counts). */
  async snapshot() {
    const { subscription, plan, state, enforced } = await this.resolve();
    const keys = Object.keys(plan.limits) as LimitKey[];
    const counts = await Promise.all(keys.map((k) => this.count(k)));
    const usage: Record<string, { used: number; included: number; remaining: number; overage: number }> = {};
    keys.forEach((k, i) => {
      const included = plan.limits[k];
      usage[k] = {
        used: counts[i],
        included,
        remaining: Math.max(0, included - counts[i]),
        overage: Math.max(0, counts[i] - included),
      };
    });
    return { subscription, plan: { key: plan.key, name: plan.name, priceCents: plan.priceCents, limits: plan.limits }, state, enforced, usage };
  }
}

export function resolveState(subscription: { status: string; trialEndsAt: Date | null; graceUntil: Date | null; pastDueSince: Date | null } | null): SubscriptionState {
  if (!subscription) return 'no_subscription';
  const now = new Date();
  switch (subscription.status) {
    case 'trialing':
      return subscription.trialEndsAt && subscription.trialEndsAt < now ? 'trial_expired' : 'trialing';
    case 'active':
      return 'active';
    case 'past_due': {
      const grace = subscription.graceUntil ?? (subscription.pastDueSince ? new Date(subscription.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000) : null);
      return grace && grace > now ? 'past_due_grace' : 'past_due_locked';
    }
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      // Unknown provider status: treat as active-with-warning rather than
      // locking a paying customer out over an unmapped state.
      return 'active';
  }
}

function describeLimit(key: LimitKey): string {
  const names: Record<LimitKey, string> = {
    staffSeats: 'staff seats',
    locations: 'locations',
    aiEmployees: 'active AI employees',
    aiTasksMonthly: 'AI tasks this month',
    voiceMinutesMonthly: 'voice minutes this month',
    messagesMonthly: 'outbound messages this month',
    contacts: 'contacts',
    automationRules: 'active automation rules',
    campaignsMonthly: 'campaigns this month',
    sites: 'websites',
    portalUsers: 'customer portal users',
    apiKeys: 'API keys',
  };
  return names[key];
}
