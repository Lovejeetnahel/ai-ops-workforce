import { Controller, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { AdminTokenGuard } from '../../public/contact/admin-token.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PLANS, planByKey } from '../../common/entitlements/plans';
import { WebhookLedgerService } from '../../common/webhooks/webhook-ledger.service';

/**
 * Sprint 4: platform-operator SaaS views. Cross-tenant by nature, so these sit
 * behind the same ADMIN_API_TOKEN operator secret as contact submissions —
 * deliberately NOT reachable with any tenant JWT, and deliberately separate
 * from tenant business dashboards. Metrics come from real Subscription +
 * BillingEvent rows; anything that cannot be computed honestly yet says so.
 */
@Controller('admin')
@UseGuards(AdminTokenGuard)
export class SaasAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookLedgerService,
  ) {}

  @Get('saas-metrics')
  async saasMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const days30 = new Date(Date.now() - 30 * 86_400_000);
    const [subs, events30, tenants] = await Promise.all([
      this.prisma.subscription.findMany(),
      this.prisma.billingEvent.findMany({ where: { createdAt: { gte: days30 } }, orderBy: { createdAt: 'desc' }, take: 2000 }),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    ]);
    const active = subs.filter((s) => s.status === 'active');
    const trialing = subs.filter((s) => s.status === 'trialing' && (!s.trialEndsAt || s.trialEndsAt > now));
    const pastDue = subs.filter((s) => s.status === 'past_due');
    const canceled = subs.filter((s) => ['canceled', 'unpaid', 'incomplete_expired'].includes(s.status));
    // MRR counts only provider-confirmed ACTIVE subscriptions at plan price.
    const mrrCents = active.reduce((sum, s) => sum + (planByKey(s.planKey)?.priceCents ?? 0), 0);
    const planDistribution: Record<string, number> = {};
    for (const p of PLANS) planDistribution[p.key] = subs.filter((s) => s.planKey === p.key && !['canceled', 'unpaid', 'incomplete_expired'].includes(s.status)).length;
    const count = (type: string) => events30.filter((e) => e.type === type).length;
    const revenue30 = events30
      .filter((e) => e.type === 'renewed' || e.type === 'recovered')
      .reduce((sum, e) => sum + Number((e.data as any)?.amountPaid ?? 0), 0);
    const trialsStarted30 = count('trial_started');
    const conversions30 = events30.filter((e) => e.type === 'subscription_created' || (e.type === 'status_synced' && (e.data as any)?.stripeStatus === 'active')).length;
    const activeAtMonthStart = subs.filter((s) => s.createdAt < monthStart && !['canceled', 'unpaid', 'incomplete_expired'].includes(s.status)).length;
    const canceled30 = events30.filter((e) => e.type === 'status_synced' && (e.data as any)?.stripeStatus === 'canceled').length;
    return {
      asOf: now.toISOString(),
      tenantsActive: tenants,
      subscriptions: { total: subs.length, active: active.length, trialing: trialing.length, pastDue: pastDue.length, canceled: canceled.length },
      mrr: { amount: mrrCents / 100, currency: 'usd', note: active.length === 0 ? 'No provider-confirmed active subscriptions yet — MRR is honestly $0.' : null },
      arr: { amount: (mrrCents * 12) / 100, currency: 'usd' },
      last30Days: {
        trialsStarted: trialsStarted30,
        newSubscriptions: conversions30,
        cancellations: canceled30,
        failedPayments: count('payment_failed'),
        recoveredPayments: count('recovered'),
        revenueCollected: { amount: revenue30, note: 'Sum of provider-confirmed invoice payments recorded in the last 30 days.' },
      },
      trialConversion:
        trialsStarted30 > 0
          ? { rate: Math.round((conversions30 / trialsStarted30) * 100) / 100, basis: 'last 30 days' }
          : { rate: null, note: 'insufficient-data — no trials started in the last 30 days' },
      churn:
        activeAtMonthStart >= 10
          ? { monthly: Math.round((canceled30 / activeAtMonthStart) * 10000) / 100, unit: '%' }
          : { monthly: null, note: 'insufficient-data — fewer than 10 subscriptions at month start makes churn statistically meaningless' },
      planDistribution,
    };
  }

  /** Webhook reliability center (platform-wide). Payloads exclude headers/secrets by construction. */
  @Get('webhooks')
  webhooksList(@Query('provider') provider?: string, @Query('state') state?: string, @Query('tenantId') tenantId?: string) {
    return this.webhooks.list({ provider, state, tenantId, limit: 100 });
  }

  @Post('webhooks/:id/retry')
  retryWebhook(@Param('id') id: string) {
    return this.webhooks.retry(id);
  }

  @Post('webhooks/:id/resolve')
  resolveWebhook(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.webhooks.resolve(id, body?.note);
  }
}
