import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ValueLedgerService } from '../../control/value-ledger.service';
import { tenantContext } from '../../common/tenancy/tenant-context';

/** Plan catalog (config, not fake). Stripe price ids are wired per environment. */
export const PLANS = [
  { key: 'starter', name: 'Starter', priceCents: 9900, seats: 3, includedAiTasks: 1000, features: ['CRM', 'Scheduling', 'Invoicing', '1 AI employee'] },
  { key: 'pro', name: 'Pro', priceCents: 29900, seats: 15, includedAiTasks: 10000, features: ['Everything in Starter', 'Full AI workforce', 'Analytics', 'Workflows'] },
  { key: 'enterprise', name: 'Enterprise', priceCents: 99900, seats: 100, includedAiTasks: 100000, features: ['Everything in Pro', 'Multi-company', 'API + webhooks', 'SSO (roadmap)', 'Priority support'] },
];

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
      create: { planKey, seats: seats ?? plan.seats, status: 'trialing', trialEndsAt: new Date(Date.now() + 14 * 86_400_000) } as any,
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
   * Sprint 3: REAL usage against plan limits. Every number is a live count
   * from source-of-truth tables — nothing metered is invented. With no
   * Subscription row the tenant is honestly reported as 'no_subscription'
   * (limits shown from the Starter plan for context, nothing enforced), and
   * Stripe billing-portal access is setup-required until Stripe is connected.
   */
  async usage() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const db = this.prisma.db;
    const [subscription, staffUsers, aiTasksMonth, callAgg, outboundMsgs, campaignSent, locations, apiKeys] = await Promise.all([
      this.current(),
      db.user.count({ where: { role: { in: ['OWNER', 'ADMIN', 'STAFF'] }, status: 'ACTIVE' } }),
      db.agentTask.count({ where: { createdAt: { gte: monthStart } } }),
      db.callRecord.aggregate({ where: { startedAt: { gte: monthStart } }, _sum: { durationSec: true }, _count: true }),
      db.message.count({ where: { direction: 'OUTBOUND', isInternal: false, createdAt: { gte: monthStart } } }),
      db.campaignRecipient.count({ where: { status: 'SENT', sentAt: { gte: monthStart } } }),
      db.location.count({ where: { active: true } }),
      db.apiKey.count(),
    ]);
    const plan = PLANS.find((p) => p.key === subscription?.planKey) ?? PLANS[0];
    const state = !subscription
      ? 'no_subscription'
      : subscription.status === 'trialing' && subscription.trialEndsAt && subscription.trialEndsAt < new Date()
        ? 'trial_expired'
        : subscription.status;
    return {
      state,
      plan: { key: plan.key, name: plan.name, seats: plan.seats, includedAiTasks: plan.includedAiTasks },
      subscription,
      usage: {
        staffUsers: { used: staffUsers, limit: plan.seats, over: staffUsers > plan.seats },
        aiTasksThisMonth: { used: aiTasksMonth, limit: plan.includedAiTasks, over: aiTasksMonth > plan.includedAiTasks },
        voice: { calls: callAgg._count, minutes: callAgg._sum.durationSec != null ? Math.round(Number(callAgg._sum.durationSec) / 60) : null, note: 'Minutes come from provider webhooks only' },
        messagesThisMonth: { conversationReplies: outboundMsgs, campaignSends: campaignSent },
        locations: { used: locations },
        apiKeys: { used: apiKeys },
        storage: { note: 'Not metered yet — no number is shown rather than a fake one' },
      },
      billingPortal: { available: false, note: 'Stripe customer portal requires a connected Stripe billing account — setup required.' },
    };
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
