import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { CommerceService } from './commerce.service';
import { DocumentsService } from '../revenue/documents.service';

/**
 * COMMERCE core V1 — the estimate→invoice→payment chain over the existing
 * Documents/Payments engines. Acceptance, conversion and sending reuse the
 * proven DocumentsService paths (idempotent conversion, payment-link dedupe).
 */
@Controller('commerce')
@UseGuards(RolesGuard)
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly documents: DocumentsService,
  ) {}

  @Get('catalog')
  @Roles('STAFF')
  catalog() {
    return this.commerce.catalog();
  }

  @Post('estimates')
  @Roles('STAFF')
  createEstimate(@Body() body: { leadId?: string; contactId?: string; title?: string; items: Array<{ serviceId?: string; description?: string; quantity?: number; unitPrice?: number }> }) {
    return this.commerce.createEstimate(body);
  }

  /** Send the estimate to the customer (marks SENT, emits document.sent). */
  @Post('estimates/:id/send')
  @Roles('STAFF')
  sendEstimate(@Param('id') id: string) {
    return this.documents.send(id);
  }

  /** Record the customer's acceptance (SIGNED, emits quote.accepted). */
  @Post('estimates/:id/accept')
  @Roles('STAFF')
  acceptEstimate(@Param('id') id: string) {
    return this.documents.acceptQuote(id);
  }

  @Post('estimates/:id/decline')
  @Roles('STAFF')
  declineEstimate(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.commerce.declineEstimate(id, reason);
  }

  /** Accepted estimate → invoice (idempotent — never double-bills). */
  @Post('estimates/:id/convert')
  @Roles('STAFF')
  convert(@Param('id') id: string) {
    return this.documents.convertQuoteToInvoice(id);
  }

  /** Full commerce chain for one opportunity. */
  @Get('flow/:leadId')
  @Roles('STAFF')
  flow(@Param('leadId') leadId: string) {
    return this.commerce.flow(leadId);
  }

  @Get('stats')
  @Roles('STAFF')
  stats() {
    return this.commerce.stats();
  }
}
