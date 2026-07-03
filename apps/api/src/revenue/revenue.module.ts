import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';

/**
 * Revenue system (Phase 3): quotes, invoices, line items, and end-to-end
 * payments. Depends only on global modules (Prisma, EventBus, Integrations), so
 * it adds no coupling. Exports PaymentsService so the Document agent reuses the
 * single payment-link implementation (no duplication).
 */
@Module({
  controllers: [DocumentsController, PaymentsController, PaymentWebhookController],
  providers: [DocumentsService, PaymentsService],
  exports: [DocumentsService, PaymentsService],
})
export class RevenueModule {}
