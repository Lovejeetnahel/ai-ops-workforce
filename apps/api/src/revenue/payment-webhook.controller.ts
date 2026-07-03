import { Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { tenantContext } from '../common/tenancy/tenant-context';
import { PaymentsService } from './payments.service';

/**
 * Stripe webhook ingress. Tenant is taken from the registered URL path (same
 * pattern as the voice/chat webhooks), so we run the handler inside that
 * tenant's context for correct, scoped settlement. Idempotency is enforced by
 * the EventBus (source + event id) when emitting payment.succeeded.
 *
 * Uses the RAW request body (`req.rawBody`, captured by main.ts's
 * express.json `verify` hook) rather than the parsed `@Body()` — signature
 * verification requires the exact bytes Stripe signed, not a re-serialization.
 *
 * Register with Stripe as: POST /api/webhooks/payment/:tenantId
 */
@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':tenantId')
  ingest(
    @Param('tenantId') tenantId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature = '',
  ) {
    const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    return tenantContext.run({ tenantId }, () => this.payments.handleWebhook(rawBody, signature));
  }
}
