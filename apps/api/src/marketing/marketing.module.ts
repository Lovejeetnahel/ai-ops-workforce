import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CampaignsService } from './campaigns.service';
import { MarketingController } from './marketing.controller';

/** Marketing V1 (Sprint 2) — real-audience campaigns with honest send truth. */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule],
  providers: [CampaignsService],
  controllers: [MarketingController],
  exports: [CampaignsService],
})
export class MarketingModule {}
