import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { WebsitesService } from './websites.service';
import { WebsitesController, PublicSitesController } from './websites.controller';
import { SeoService } from './seo.service';
import { SeoController } from './seo.controller';

/** Websites + SEO V1 (Sprint 3). */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule],
  providers: [WebsitesService, SeoService],
  controllers: [WebsitesController, PublicSitesController, SeoController],
  exports: [WebsitesService, SeoService],
})
export class WebsitesModule {}
