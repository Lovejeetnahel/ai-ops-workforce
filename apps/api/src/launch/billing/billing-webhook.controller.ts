import { Controller, Logger, OnModuleInit, Post, Headers, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { verifyStripeSignature } from '../../integrations/adapters/stripe.adapter';
import { StripeBillingService } from './stripe-billing.service';
import { WebhookLedgerService } from '../../common/webhooks/webhook-ledger.service';

/**
 * Platform Stripe billing webhook (SaaS subscriptions) — separate from the
 * per-tenant payment webhook (/webhooks/payment/:tenantId), which settles a
 * tenant's OWN customer invoices. Register with Stripe as:
 *   POST /api/webhooks/billing
 * Signature verification is MANDATORY here (billing state changes money
 * access): without STRIPE_BILLING_WEBHOOK_SECRET the endpoint refuses.
 */
@Controller('webhooks/billing')
export class BillingWebhookController implements OnModuleInit {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly billing: StripeBillingService,
    private readonly ledger: WebhookLedgerService,
  ) {}

  onModuleInit() {
    this.ledger.registerRetryHandler('stripe-billing', (delivery) => this.process(delivery.payload));
  }

  @Post()
  async ingest(@Req() req: Request & { rawBody?: Buffer }, @Headers('stripe-signature') signature = '') {
    const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    const secret = this.billing.webhookSecret;
    if (!secret) throw new UnauthorizedException('Billing webhook is not configured (STRIPE_BILLING_WEBHOOK_SECRET missing)');
    verifyStripeSignature(rawBody, signature, secret);

    let evt: any;
    try {
      evt = JSON.parse(rawBody);
    } catch {
      throw new UnauthorizedException('Webhook payload is not valid JSON');
    }

    const obj = evt?.data?.object ?? {};
    const tenantId =
      obj?.metadata?.tenantId ?? obj?.subscription_details?.metadata?.tenantId ?? (await this.billing.tenantForCustomer(obj?.customer));
    const recorded = await this.ledger.record({
      provider: 'stripe-billing',
      eventType: evt?.type ?? 'unknown',
      eventId: evt?.id ?? `missing_${Date.now()}`,
      tenantId,
      entity: 'subscription',
      entityId: obj?.subscription ?? obj?.id ?? null,
      payload: evt,
    });
    if (recorded.duplicate) return { received: true, duplicate: true };

    try {
      const outcome = await this.process(evt);
      if (outcome === 'skipped') await this.ledger.markSkipped(recorded.delivery!.id, 'Event type not handled — no action required');
      else await this.ledger.markProcessed(recorded.delivery!.id, { tenantId: outcome ?? tenantId });
      return { received: true };
    } catch (err) {
      await this.ledger.markFailed(recorded.delivery!.id, err as Error);
      this.logger.error(`Billing webhook ${evt?.type} failed: ${(err as Error).message}`);
      // 200 so Stripe doesn't hammer retries — our own ledger drives retry.
      return { received: true, deferred: true };
    }
  }

  /** Pure event processing (also the ledger's retry handler). */
  private async process(evt: any): Promise<string | 'skipped' | null> {
    const obj = evt?.data?.object ?? {};
    switch (evt?.type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription' || !obj.subscription) return 'skipped';
        const sub = await this.billing.api('GET', `/subscriptions/${obj.subscription}`);
        const synced = await this.billing.syncFromStripeSubscription(sub);
        return synced?.tenantId ?? null;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const synced = await this.billing.syncFromStripeSubscription(obj);
        return synced?.tenantId ?? null;
      }
      case 'invoice.paid': {
        const tenantId = await this.billing.tenantForCustomer(obj.customer);
        if (!tenantId) return 'skipped';
        await this.billing.recordInvoicePaid(tenantId, obj);
        return tenantId;
      }
      case 'invoice.payment_failed': {
        const tenantId = await this.billing.tenantForCustomer(obj.customer);
        if (!tenantId) return 'skipped';
        await this.billing.recordPaymentFailure(tenantId, obj);
        return tenantId;
      }
      default:
        return 'skipped';
    }
  }
}
