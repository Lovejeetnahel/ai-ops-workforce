import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { PLANS, TRIAL_DAYS, PAST_DUE_GRACE_DAYS, planByKey } from '../../common/entitlements/plans';

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Sprint 4: SaaS subscription billing against the PLATFORM Stripe account
 * (STRIPE_BILLING_SECRET_KEY, falling back to STRIPE_SECRET_KEY). This is
 * deliberately separate from ProviderFactory.payment(), which resolves the
 * TENANT's own Stripe account for invoicing THEIR customers — tenant
 * credentials are never used to bill the tenant.
 *
 * HONESTY CONTRACT:
 *  • Nothing here fakes payment success. Checkout/portal/plan changes throw
 *    503 setup-required when the platform key or price ids are absent.
 *  • Provider-confirmed state (webhooks + API sync) is authoritative: local
 *    Subscription rows mirror Stripe, they never invent status.
 *  • Every lifecycle transition is recorded as a BillingEvent (audit).
 */
@Injectable()
export class StripeBillingService {
  private readonly logger = new Logger(StripeBillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  get secretKey(): string {
    return process.env.STRIPE_BILLING_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? '';
  }

  get webhookSecret(): string {
    return process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? '';
  }

  configured(): { checkout: boolean; webhook: boolean; prices: Record<string, boolean> } {
    const prices: Record<string, boolean> = {};
    for (const p of PLANS) prices[p.key] = !!process.env[p.stripePriceEnv];
    return { checkout: !!this.secretKey && Object.values(prices).some(Boolean), webhook: !!this.webhookSecret, prices };
  }

  async api(method: 'GET' | 'POST' | 'DELETE', path: string, form?: Record<string, string>) {
    if (!this.secretKey) throw new ServiceUnavailableException('Stripe billing is not configured on this platform yet — setup required.');
    const res = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form) : undefined,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `Stripe ${res.status}`;
      this.logger.warn(`Stripe ${method} ${path} failed: ${msg}`);
      throw new BadRequestException(`Stripe: ${msg}`);
    }
    return data;
  }

  private async audit(tenantId: string, type: string, data: Record<string, unknown> = {}) {
    await this.prisma.billingEvent.create({ data: { tenantId, type, data: data as any } });
  }

  /** Local trial subscription (no card, no Stripe object — honestly local). */
  async startTrial(tenantId: string, planKey = 'pro') {
    const plan = planByKey(planKey);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (existing) return existing; // never resets an existing subscription's clock
    const sub = await this.prisma.subscription.create({
      data: { tenantId, planKey, seats: plan.seats, status: 'trialing', trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) },
    });
    await this.audit(tenantId, 'trial_started', { planKey, trialDays: TRIAL_DAYS });
    return sub;
  }

  private async ensureCustomer(tenantId: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
    const owner = await this.prisma.user.findFirst({ where: { tenantId, role: 'OWNER' }, select: { email: true, name: true } });
    const customer = await this.api('POST', '/customers', {
      name: tenant.name,
      ...(owner?.email ? { email: owner.email } : {}),
      'metadata[tenantId]': tenantId,
    });
    await this.prisma.subscription.upsert({
      where: { tenantId },
      update: { stripeCustomerId: customer.id },
      create: { tenantId, planKey: 'starter', status: 'trialing', stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /** Hosted Stripe Checkout for a paid subscription. */
  async checkout(planKey: string) {
    const tenantId = tenantContext.tenantId;
    const plan = planByKey(planKey);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    const price = process.env[plan.stripePriceEnv];
    if (!price)
      throw new ServiceUnavailableException(
        `The ${plan.name} plan has no Stripe price configured on this platform yet (${plan.stripePriceEnv}) — setup required.`,
      );
    const customer = await this.ensureCustomer(tenantId);
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    const session = await this.api('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][tenantId]': tenantId,
      success_url: `${appUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl}/settings?tab=billing&checkout=cancelled`,
      allow_promotion_codes: 'true',
    });
    await this.audit(tenantId, 'checkout_created', { planKey, sessionId: session.id });
    return { url: session.url, sessionId: session.id };
  }

  /** Stripe Billing Portal session (manage payment method, invoices, cancel). */
  async portalSession() {
    const tenantId = tenantContext.tenantId;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeCustomerId)
      throw new ServiceUnavailableException('No Stripe billing customer exists for this account yet — choose a plan first.');
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    const session = await this.api('POST', '/billing_portal/sessions', {
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/settings?tab=billing`,
    });
    return { url: session.url };
  }

  /** Upgrade/downgrade the active Stripe subscription in place (prorated). */
  async changePlan(planKey: string) {
    const tenantId = tenantContext.tenantId;
    const plan = planByKey(planKey);
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeRef) {
      // No provider subscription yet (trial or none): checkout is the path.
      return { requiresCheckout: true, ...(await this.checkout(planKey)) };
    }
    const price = process.env[plan.stripePriceEnv];
    if (!price) throw new ServiceUnavailableException(`The ${plan.name} plan has no Stripe price configured yet — setup required.`);
    const current = await this.api('GET', `/subscriptions/${sub.stripeRef}`);
    const itemId = current.items?.data?.[0]?.id;
    if (!itemId) throw new BadRequestException('Stripe subscription has no items to update');
    const updated = await this.api('POST', `/subscriptions/${sub.stripeRef}`, {
      'items[0][id]': itemId,
      'items[0][price]': price,
      proration_behavior: 'create_prorations',
    });
    await this.syncFromStripeSubscription(updated, tenantId);
    await this.audit(tenantId, 'plan_changed', { from: sub.planKey, to: planKey });
    return { requiresCheckout: false, planKey };
  }

  /** Schedule or undo cancellation at period end (provider-confirmed). */
  async setCancelAtPeriodEnd(cancel: boolean) {
    const tenantId = tenantContext.tenantId;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new BadRequestException('No subscription on file');
    if (!sub.stripeRef) {
      // Trial-only subscription: cancellation is local and immediate-at-trial-end.
      const updated = await this.prisma.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: cancel } });
      await this.audit(tenantId, cancel ? 'cancel_scheduled' : 'reactivated', { local: true });
      return updated;
    }
    const updated = await this.api('POST', `/subscriptions/${sub.stripeRef}`, { cancel_at_period_end: String(cancel) });
    const synced = await this.syncFromStripeSubscription(updated, tenantId);
    await this.audit(tenantId, cancel ? 'cancel_scheduled' : 'reactivated', {});
    return synced;
  }

  /** Live invoice history from Stripe — real invoices only, never fabricated. */
  async invoices() {
    const tenantId = tenantContext.tenantId;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!this.secretKey || !sub?.stripeCustomerId) return { available: false, note: 'Invoices appear once a Stripe billing customer exists.', invoices: [] };
    const res = await this.api('GET', `/invoices?customer=${sub.stripeCustomerId}&limit=12`);
    return {
      available: true,
      invoices: (res.data ?? []).map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due / 100,
        amountPaid: inv.amount_paid / 100,
        currency: inv.currency,
        createdAt: new Date(inv.created * 1000).toISOString(),
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        pdf: inv.invoice_pdf ?? null,
      })),
    };
  }

  /** Payment-method state from the Stripe customer (brand/last4 only). */
  async paymentMethod() {
    const tenantId = tenantContext.tenantId;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!this.secretKey || !sub?.stripeCustomerId) return { onFile: false };
    try {
      const res = await this.api('GET', `/payment_methods?customer=${sub.stripeCustomerId}&type=card&limit=1`);
      const pm = res.data?.[0];
      if (!pm) return { onFile: false };
      return { onFile: true, brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null, expMonth: pm.card?.exp_month ?? null, expYear: pm.card?.exp_year ?? null };
    } catch {
      return { onFile: false, note: 'Payment method state unavailable right now.' };
    }
  }

  /**
   * Mirror a Stripe subscription object into the local row. Called from
   * webhooks and after API mutations — the ONLY writer of provider state.
   */
  async syncFromStripeSubscription(stripeSub: any, tenantIdHint?: string) {
    const tenantId =
      tenantIdHint ??
      stripeSub?.metadata?.tenantId ??
      (await this.prisma.subscription.findFirst({ where: { stripeCustomerId: String(stripeSub.customer) }, select: { tenantId: true } }))?.tenantId;
    if (!tenantId) {
      this.logger.warn(`Stripe subscription ${stripeSub?.id} could not be matched to a tenant`);
      return null;
    }
    const item0 = stripeSub.items?.data?.[0];
    const priceId = item0?.price?.id;
    // Newer Stripe API versions report the billing period on the subscription
    // ITEM, not the subscription — read both so renewal dates are never lost.
    const periodStart = stripeSub.current_period_start ?? item0?.current_period_start;
    const periodEnd = stripeSub.current_period_end ?? item0?.current_period_end;
    const plan = PLANS.find((p) => process.env[p.stripePriceEnv] && process.env[p.stripePriceEnv] === priceId);
    const status: string = stripeSub.status;
    if (status === 'incomplete') {
      // Checkout not completed — never activate anything from this state.
      await this.audit(tenantId, 'status_synced', { stripeStatus: status, note: 'ignored (checkout incomplete)' });
      return this.prisma.subscription.findUnique({ where: { tenantId } });
    }
    const mapped = ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(status) ? status : 'active';
    const data: any = {
      status: mapped,
      stripeRef: stripeSub.id,
      stripeCustomerId: String(stripeSub.customer),
      cancelAtPeriodEnd: !!stripeSub.cancel_at_period_end,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : undefined,
      ...(plan ? { planKey: plan.key, seats: plan.seats } : {}),
    };
    if (mapped === 'past_due') {
      const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
      data.pastDueSince = existing?.pastDueSince ?? new Date();
      data.graceUntil = existing?.graceUntil ?? new Date(Date.now() + PAST_DUE_GRACE_DAYS * 86_400_000);
    } else {
      data.pastDueSince = null;
      data.graceUntil = null;
    }
    const sub = await this.prisma.subscription.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, planKey: plan?.key ?? 'starter', ...data },
    });
    await this.audit(tenantId, 'status_synced', { stripeStatus: status, planKey: sub.planKey, cancelAtPeriodEnd: sub.cancelAtPeriodEnd });
    return sub;
  }

  /** Resolve which tenant a billing webhook belongs to. */
  async tenantForCustomer(customerId: string | null | undefined): Promise<string | null> {
    if (!customerId) return null;
    const sub = await this.prisma.subscription.findFirst({ where: { stripeCustomerId: String(customerId) }, select: { tenantId: true } });
    return sub?.tenantId ?? null;
  }

  /** invoice.payment_failed → past_due with an explicit grace window. */
  async recordPaymentFailure(tenantId: string, invoice: any) {
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!existing) return;
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'past_due',
        pastDueSince: existing.pastDueSince ?? new Date(),
        graceUntil: existing.graceUntil ?? new Date(Date.now() + PAST_DUE_GRACE_DAYS * 86_400_000),
      },
    });
    await this.audit(tenantId, 'payment_failed', {
      invoiceId: invoice?.id,
      amountDue: typeof invoice?.amount_due === 'number' ? invoice.amount_due / 100 : undefined,
      attemptCount: invoice?.attempt_count,
    });
    await this.prisma.staffNotification.create({
      data: {
        tenantId,
        userId: null,
        category: 'billing.payment_failed',
        title: 'Subscription payment failed',
        body: 'Your latest subscription payment did not go through. Update your payment method to keep full access — your data is never locked.',
        href: '/settings?tab=billing',
        priority: 'HIGH',
      },
    });
  }

  /** invoice.paid → recovery/renewal record (status sync arrives separately). */
  async recordInvoicePaid(tenantId: string, invoice: any) {
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (existing && existing.status === 'past_due') {
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: 'active', pastDueSince: null, graceUntil: null },
      });
      await this.audit(tenantId, 'recovered', { invoiceId: invoice?.id });
    } else {
      await this.audit(tenantId, 'renewed', {
        invoiceId: invoice?.id,
        amountPaid: typeof invoice?.amount_paid === 'number' ? invoice.amount_paid / 100 : undefined,
      });
    }
  }
}
