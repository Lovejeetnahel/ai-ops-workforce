import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

/** Reviews V1 (Sprint 2) — reputation workflow with honest provider boundaries. */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
