import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantMiddleware } from './common/tenancy/tenant.middleware';
import { EventBusModule } from './automation/event-bus.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { BrainModule } from './brain/brain.module';
import { AgentsModule } from './agents/agents.module';
import { AutomationModule } from './automation/automation.module';
import { ControlModule } from './control/control.module';
import { CrmModule } from './crm/crm.module';
import { OperationsModule } from './operations/operations.module';
import { RevenueModule } from './revenue/revenue.module';
import { PortalModule } from './portal/portal.module';
import { FieldModule } from './field/field.module';
import { EmployeesModule } from './employees/employees.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { BusinessBrainModule } from './business-brain/business-brain.module';
import { LaunchModule } from './launch/launch.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { LeadsModule } from './leads/leads.module';
import { InboxModule } from './inbox/inbox.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MarketingModule } from './marketing/marketing.module';
import { SocialModule } from './social/social.module';
import { VoiceAiModule } from './voice/voice-ai.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WebsitesModule } from './websites/websites.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PublicModule } from './public/public.module';
import { HealthController } from './health.controller';

/**
 * Composition root.
 *
 * Module graph (acyclic):
 *   PrismaModule, EventBusModule, IntegrationsModule, AuthModule  → global
 *   AgentsModule → uses globals only
 *   AutomationModule → imports AgentsModule (actions trigger agents)
 *   TenantsModule → imports AutomationModule (seed presets on signup)
 *   LeadsModule → uses globals (EventBus)
 *
 * TenantMiddleware runs on every route to establish AsyncLocalStorage tenant
 * context from the JWT or webhook header before any handler executes.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventBusModule,
    IntegrationsModule,
    BrainModule,
    AgentsModule,
    AutomationModule,
    ControlModule,
    CrmModule,
    OperationsModule,
    RevenueModule,
    PortalModule,
    FieldModule,
    EmployeesModule,
    EnterpriseModule,
    BusinessBrainModule,
    LaunchModule,
    TenantsModule,
    LeadsModule,
    InboxModule,
    ReviewsModule,
    MarketingModule,
    SocialModule,
    VoiceAiModule,
    AppointmentsModule,
    WebsitesModule,
    WorkspaceModule,
    PublicModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
