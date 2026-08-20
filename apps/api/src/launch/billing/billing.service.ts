import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ValueLedgerService } from '../../control/value-ledger.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { PLANS, TRIAL_DAYS } from '../../common/entitlements/plans';
import { EntitlementsService } from '../../common/entitlements/entitlements.service';
import { StripeBillingService } from './stripe-billing.service';

export { PLANS };


/**
 * Billing backend: plan subscriptions + metered usage. Revenue analytics reuse
 * the Value Ledger. Subscription lifecycle is persisted here; the actual Stripe
 * subscription object is provisioned via the existing PaymentPort (seam) and its
 * id stored in `stripeRef`.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ValueLedgerService,
    private readonly entitlements: EntitlementsService,
    private readonly stripeBilling: StripeBillingService,
  ) {}

  plans() {
    return PLANS;
  }

  subscribe(planKey: string, seats?: number) {
    const plan = PLANS.find((p) => p.key === planKey);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    return this.prisma.db.subscription.upsert({
      where: { tenantId: tenantContext.tenantId },
      update: { planKey, seats: seats ?? plan.seats, status: 'active' },
      create: { planKey, seats: seats ?? plan.seats, status: 'trialing', trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) } as any,
    });
  }

  current() {
    return this.prisma.db.subscription.findUnique({ where: { tenantId: tenantContext.tenantId } });
  }

  /** Increment a metered usage counter for the current month. */
  async recordUsage(metric: string, quantity = 1) {
    const period = new Date().toISOString().slice(0, 7);
    return this.prisma.db.usageRecord.upsert({
      where: { tenantId_metric_period: { tenantId: tenantContext.tenantId, metric, period } },
      update: { quantity: { increment: quantity } },
      create: { metric, period, quantity } as any,
    });
  }

  async summary() {
    const period = new Date().toISOString().slice(0, 7);
    const [subscription, usage, revenue] = await Promise.all([
      this.current(),
      this.prisma.db.usageRecord.findMany({ where: { period } }),
      this.ledger.summary(),
    ]);
    const plan = PLANS.find((p) => p.key === subscription?.planKey) ?? null;
    return {
      subscription,
      plan,
      usageThisPeriod: usage.map((u) => ({ metric: u.metric, quantity: u.quantity })),
      revenue: { collected: revenue.totalValue, cost: revenue.totalCost, net: revenue.netValue },
    };
  }

  /**
   * Sprint 3→4: REAL usage against plan limits. Every number is a live count
   * from source-of-truth tables — nothing metered is invented. Sprint 4 adds
   * the full metered snapshot (included/consumed/remaining/overage per limit)
   * from the central EntitlementsService, honest overage reporting (counted,
   * not billed — no overage pricing exists yet), and a REAL billing-portal
   * availability signal. System/test activity is excluded from billable
   * usage: voice minutes come only from provider webhooks, message counts
   * exclude internal notes, and release-verification tenants are deleted by
   * the smoke pipeline rather than metered.
   */
  async usage() {
    const snapshot = await this.entitlements.snapshot();
    const { subscription, plan, state, enforced, usage: metered } = snapshot;
    const sub = subscription;
    const stripeConfigured = this.stripeBilling.configured();
    const db = this.prisma.db;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const callAgg = await db.callRecord.aggregate({ where: { startedAt: { gte: monthStart } }, _sum: { durationSec: true }, _count: true });
    const billableOverage = (Object.entries(metered) as Array<[string, { overage: number }]>)
      .filter(([k, v]) => v.overage > 0 && ['aiTasksMonthly', 'voiceMinutesMonthly', 'messagesMonthly'].includes(k))
      .map(([k, v]) => ({ metric: k, overage: v.overage }));
    return {
      state,
      enforced,
      plan: { key: plan.key, name: plan.name, seats: plan.limits.staffSeats, includedAiTasks: plan.limits.aiTasksMonthly, priceCents: plan.priceCents, limits: plan.limits },
      subscription: sub,
      usage: {
        staffUsers: { used: metered.staffSeats.used, limit: metered.staffSeats.included, over: metered.staffSeats.overage > 0 },
        aiTasksThisMonth: { used: metered.aiTasksMonthly.used, limit: metered.aiTasksMonthly.included, over: metered.aiTasksMonthly.overage > 0 },
        voice: { calls: callAgg._count, minutes: callAgg._sum.durationSec != null ? Math.round(Number(callAgg._sum.durationSec) / 60) : null, note: 'Minutes come from provider webhooks only' },
        messagesThisMonth: { used: metered.messagesMonthly.used, limit: metered.messagesMonthly.included },
        locations: { used: metered.locations.used, limit: metered.locations.included },
        apiKeys: { used: metered.apiKeys.used, limit: metered.apiKeys.included },
        storage: { note: 'Not metered yet — no number is shown rather than a fake one' },
        metered,
      },
      overage: {
        billable: billableOverage,
        note: billableOverage.length
          ? 'Overage is counted but NOT billed — no overage pricing is configured. Upgrade to raise included limits.'
          : null,
      },
      billingPortal: {
        available: !!(this.stripeBilling.secretKey && sub?.stripeCustomerId),
        note: this.stripeBilling.secretKey
          ? sub?.stripeCustomerId
            ? null
            : 'The Stripe portal opens once a billing customer exists (choose a plan).'
          : 'Stripe billing is not configured on this platform yet — setup required.',
      },
      stripe: { checkoutConfigured: stripeConfigured.checkout, prices: stripeConfigured.prices },
    };
  }

  /**
   * Sprint 4: the customer billing experience in one call — plan, provider
   * state, trial/renewal dates, payment method, warnings and which actions
   * are genuinely available (never a dead button).
   */
  async overview() {
    const [u, paymentMethod] = await Promise.all([this.usage(), this.stripeBilling.paymentMethod()]);
    const sub: any = u.subscription;
    const warnings: Array<{ kind: string; message: string }> = [];
    const now = Date.now();
    if (u.state === 'trialing' && sub?.trialEndsAt) {
      const daysLeft = Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / 86_400_000);
      if (daysLeft <= 5) warnings.push({ kind: 'trial_ending', message: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Choose a plan to keep full access.` });
    }
    if (u.state === 'trial_expired') warnings.push({ kind: 'trial_expired', message: 'Your free trial has ended. Your data is fully accessible — choose a plan to keep creating new work.' });
    if (u.state === 'past_due_grace') warnings.push({ kind: 'past_due', message: `A subscription payment failed. Update your payment method${sub?.graceUntil ? ` before ${new Date(sub.graceUntil).toLocaleDateString()}` : ''} to avoid interruption.` });
    if (u.state === 'past_due_locked') warnings.push({ kind: 'past_due_locked', message: 'Payment is past due and the grace period has ended. Reading and exporting your data always works; creating new work requires reactivation.' });
    if (u.state === 'canceled') warnings.push({ kind: 'canceled', message: 'Your subscription is canceled. Reactivate any time — your data is intact.' });
    for (const o of u.overage.billable) warnings.push({ kind: 'overage', message: `Over the included ${o.metric} by ${o.overage} this month (counted, not billed).` });
    const stripeReady = u.stripe.checkoutConfigured;
    return {
      ...u,
      paymentMethod,
      trialEndsAt: sub?.trialEndsAt ?? null,
      renewsAt: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: !!sub?.cancelAtPeriodEnd,
      warnings,
      actions: {
        startTrial: !sub,
        checkout: stripeReady,
        changePlan: stripeReady && !!sub,
        cancel: !!sub && !sub.cancelAtPeriodEnd && ['trialing', 'active', 'past_due_grace'].includes(u.state),
        reactivate: !!sub && (sub.cancelAtPeriodEnd || u.state === 'canceled'),
        portal: u.billingPortal.available,
      },
    };
  }

  /** Billing lifecycle audit history (BillingEvent rows, newest first). */
  billingEvents(limit = 50) {
    return this.prisma.billingEvent.findMany({
      where: { tenantId: tenantContext.tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(200, limit)),
    });
  }

  /** Feature-gate check used by UI/services. Warns honestly, never silently. */
  async gate(feature: 'staff_seat' | 'ai_task') {
    const u = await this.usage();
    if (u.state === 'no_subscription') return { allowed: true, warning: 'No subscription on file — trial behavior, nothing enforced yet.' };
    if (feature === 'staff_seat' && u.usage.staffUsers.over) return { allowed: false, warning: `Your ${u.plan.name} plan includes ${u.plan.seats} staff seats and you have ${u.usage.staffUsers.used}. Upgrade to add more.` };
    if (feature === 'ai_task' && u.usage.aiTasksThisMonth.over) return { allowed: false, warning: `You've used ${u.usage.aiTasksThisMonth.used} of ${u.plan.includedAiTasks} included AI tasks this month. Upgrade to continue.` };
    return { allowed: true };
  }
}
