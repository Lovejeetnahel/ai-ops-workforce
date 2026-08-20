import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { BillingService } from './billing.service';
import { StripeBillingService } from './stripe-billing.service';
import { WebhookLedgerService } from '../../common/webhooks/webhook-ledger.service';
import { tenantContext } from '../../common/tenancy/tenant-context';

@Controller('billing')
@UseGuards(RolesGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripeBilling: StripeBillingService,
    private readonly webhooks: WebhookLedgerService,
  ) {}

  @Get('plans')
  @Roles('STAFF')
  plans() {
    return this.billing.plans();
  }

  @Get('subscription')
  @Roles('ADMIN')
  subscription() {
    return this.billing.current();
  }

  @Post('subscribe')
  @Roles('OWNER')
  subscribe(@Body() body: { planKey: string; seats?: number }) {
    return this.billing.subscribe(body.planKey, body.seats);
  }

  @Get('summary')
  @Roles('ADMIN')
  summary() {
    return this.billing.summary();
  }

  /** Sprint 3: live usage vs plan limits (all real counts). */
  @Get('usage')
  @Roles('ADMIN')
  usage() {
    return this.billing.usage();
  }

  /** Sprint 3: feature-gate check (honest warnings, never silent). */
  @Get('gate/:feature')
  @Roles('STAFF')
  gate(@Param('feature') feature: string) {
    if (feature !== 'staff_seat' && feature !== 'ai_task') throw new BadRequestException('Unknown feature gate');
    return this.billing.gate(feature);
  }

  // ── Sprint 4: full customer billing experience ───────────────────────────

  /** Everything the billing UI needs in one call (all real provider state). */
  @Get('overview')
  @Roles('ADMIN')
  overview() {
    return this.billing.overview();
  }

  /** Live Stripe invoice history — real invoices only. */
  @Get('invoices')
  @Roles('ADMIN')
  invoices() {
    return this.stripeBilling.invoices();
  }

  /** Billing lifecycle audit history. */
  @Get('events')
  @Roles('ADMIN')
  events() {
    return this.billing.billingEvents();
  }

  /** Start the free trial (existing tenants without a subscription). */
  @Post('start-trial')
  @Roles('OWNER')
  startTrial(@Body() body: { planKey?: string }) {
    return this.stripeBilling.startTrial(tenantContext.tenantId, body?.planKey ?? 'pro');
  }

  /** Hosted Stripe Checkout for a paid plan (503 when not configured). */
  @Post('checkout')
  @Roles('OWNER')
  checkout(@Body() body: { planKey: string }) {
    if (!body?.planKey) throw new BadRequestException('planKey is required');
    return this.stripeBilling.checkout(body.planKey);
  }

  /** Stripe Billing Portal session. */
  @Post('portal')
  @Roles('OWNER')
  portal() {
    return this.stripeBilling.portalSession();
  }

  /** Upgrade/downgrade in place (prorated) or route to checkout. */
  @Post('change-plan')
  @Roles('OWNER')
  changePlan(@Body() body: { planKey: string }) {
    if (!body?.planKey) throw new BadRequestException('planKey is required');
    return this.stripeBilling.changePlan(body.planKey);
  }

  /** Cancel at period end (provider-confirmed; reversible). */
  @Post('cancel')
  @Roles('OWNER')
  cancel() {
    return this.stripeBilling.setCancelAtPeriodEnd(true);
  }

  /** Undo a scheduled cancellation. */
  @Post('reactivate')
  @Roles('OWNER')
  reactivate() {
    return this.stripeBilling.setCancelAtPeriodEnd(false);
  }

  /** This tenant's provider webhook deliveries (reliability view, no secrets). */
  @Get('webhook-deliveries')
  @Roles('OWNER')
  webhookDeliveries(@Param() _p: unknown) {
    return this.webhooks.list({ tenantId: tenantContext.tenantId });
  }
}
