import { Global, Module } from '@nestjs/common';
import { WebhookLedgerService } from './webhook-ledger.service';

/** Global: every webhook ingress (billing, payments, voice) records here. */
@Global()
@Module({
  providers: [WebhookLedgerService],
  exports: [WebhookLedgerService],
})
export class WebhookLedgerModule {}
