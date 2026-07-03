import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentPort } from '../ports';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60; // Stripe's own default replay-protection window

/**
 * Stripe adapter (PaymentPort). Creates hosted payment links and verifies
 * webhook signatures using Stripe's documented HMAC-SHA256 scheme (no SDK
 * dependency required): header is `t=<unix_ts>,v1=<hex_hmac>[,v0=...]`, the
 * signed payload is `${timestamp}.${rawBody}`, and the expected signature is
 * `HMAC_SHA256(webhookSecret, signedPayload)`.
 *
 * Found via live verification: a previous version ignored the signature
 * parameter entirely, so ANY POST to the webhook endpoint — with no signature,
 * a garbage signature, or any other value — was accepted as a genuine
 * Stripe event. A forged "checkout.session.completed" webhook settled a real
 * $9,999 invoice with zero authentication. This is now enforced WHENEVER a
 * webhookSecret is configured; only in stub mode (no secret, no real Stripe
 * account connected) does it fall back to trusting the payload, exactly like
 * createInvoice already does for the same reason.
 */
export class StripeAdapter implements PaymentPort {
  private readonly logger = new Logger(StripeAdapter.name);

  constructor(private readonly creds: { secretKey: string; webhookSecret?: string }) {}

  async createInvoice(input: { amount: number; currency: string; description: string; customerEmail?: string }) {
    if (!this.creds.secretKey) {
      this.logger.warn(`[stub] STRIPE invoice ${input.amount} ${input.currency}`);
      return { id: `stub_${Date.now()}`, url: 'https://pay.example.com/stub' };
    }
    // Reference: create a PaymentIntent / Invoice via the Stripe SDK here.
    const res = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.creds.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price_data][currency]': input.currency,
        'line_items[0][price_data][product_data][name]': input.description,
        'line_items[0][price_data][unit_amount]': String(Math.round(input.amount * 100)),
        'line_items[0][quantity]': '1',
      }),
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return { id: data.id, url: data.url };
  }

  parseWebhook(rawBody: string, signature: string) {
    if (this.creds.webhookSecret) {
      this.verifySignature(rawBody, signature, this.creds.webhookSecret);
    } else {
      this.logger.warn('[stub] STRIPE webhook accepted WITHOUT signature verification — no webhookSecret configured (dev/stub mode only)');
    }

    let evt: any;
    try { evt = JSON.parse(rawBody); } catch { throw new BadRequestException('Webhook payload is not valid JSON'); }
    const obj = evt?.data?.object ?? {};
    const type: string = evt?.type ?? 'unknown';
    const succeeded = /(checkout\.session\.completed|payment_intent\.succeeded|invoice\.paid|charge\.succeeded)/.test(type);
    const cents = obj.amount_total ?? obj.amount_received ?? obj.amount_paid ?? obj.amount;
    return {
      type,
      externalId: evt?.id ?? `stub_${Date.now()}`,
      // The object we created when issuing the link (payment link / intent / session).
      reference: obj.payment_link ?? obj.payment_intent ?? obj.id,
      amount: typeof cents === 'number' ? cents / 100 : undefined,
      succeeded,
    };
  }

  /** Stripe's documented webhook signature scheme. Throws on any mismatch. */
  private verifySignature(rawBody: string, header: string, secret: string): void {
    if (!header) throw new UnauthorizedException('Missing Stripe-Signature header');

    const parts = Object.fromEntries(
      header.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k, v];
      }),
    );
    const timestamp = parts['t'];
    const candidateSig = parts['v1'];
    if (!timestamp || !candidateSig) throw new UnauthorizedException('Malformed Stripe-Signature header');

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Stripe webhook timestamp outside tolerance (possible replay)');
    }

    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const candidateBuf = Buffer.from(candidateSig, 'hex');
    if (expectedBuf.length !== candidateBuf.length || !timingSafeEqual(expectedBuf, candidateBuf)) {
      throw new UnauthorizedException('Stripe webhook signature mismatch');
    }
  }
}
