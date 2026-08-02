import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';

/** Social Media V1 (Sprint 2) — content planning/approval with honest publishing. */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService],
})
export class SocialModule {}
