import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { MarketplaceService } from './marketplace/marketplace.service';
import { MarketplaceController } from './marketplace/marketplace.controller';
import { BillingService } from './billing/billing.service';
import { BillingController } from './billing/billing.controller';
import { StripeBillingService } from './billing/stripe-billing.service';
import { BillingWebhookController } from './billing/billing-webhook.controller';
import { SaasAdminController } from './billing/saas-admin.controller';
import { OpsController } from './ops/ops.controller';
import { DeveloperController } from './developer/developer.controller';

/**
 * V1.0 launch surface (Phase 8): marketplace, billing, observability, and the
 * developer portal/OpenAPI. Imports EmployeesModule so marketplace agent
 * installs reuse the AI-workforce registry; everything else is global.
 */
@Module({
  imports: [EmployeesModule],
  controllers: [MarketplaceController, BillingController, BillingWebhookController, SaasAdminController, OpsController, DeveloperController],
  providers: [MarketplaceService, BillingService, StripeBillingService],
  exports: [BillingService, StripeBillingService],
})
export class LaunchModule {}
