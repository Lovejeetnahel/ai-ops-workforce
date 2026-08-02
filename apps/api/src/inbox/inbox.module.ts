import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BrainModule } from '../brain/brain.module';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

/** Unified Inbox V1 (Sprint 2) — staff operations over existing conversations. */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule, BrainModule],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class InboxModule {}
