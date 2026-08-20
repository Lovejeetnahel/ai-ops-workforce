import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AgentsModule } from '../agents/agents.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { IntegrationCenterService } from './integration-center.service';
import { ConfigController } from './config.controller';

// AgentsModule is imported directly because it OWNS and exports
// ModuleConfigService (ConfigController's dependency). AutomationModule also
// imports AgentsModule but does not re-export it, so it does not satisfy this
// on its own — Nest does not propagate providers through unexported imports.
@Module({
  imports: [AutomationModule, AgentsModule, IntegrationsModule],
  controllers: [TenantsController, ConfigController],
  providers: [TenantsService, IntegrationCenterService],
})
export class TenantsModule {}
