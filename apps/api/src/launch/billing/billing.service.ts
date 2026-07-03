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
}
