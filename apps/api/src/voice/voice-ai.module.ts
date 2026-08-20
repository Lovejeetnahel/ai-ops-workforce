import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OperationsModule } from '../operations/operations.module';
import { VoiceAiService } from './voice-ai.service';
import { VoiceAiController } from './voice-ai.controller';

/** Voice AI V1 (Sprint 3) — productizes the existing Vapi webhook pipeline. */
@Module({
  imports: [PrismaModule, EventBusModule, IntegrationsModule, OperationsModule],
  providers: [VoiceAiService],
  controllers: [VoiceAiController],
  exports: [VoiceAiService],
})
export class VoiceAiModule {}
