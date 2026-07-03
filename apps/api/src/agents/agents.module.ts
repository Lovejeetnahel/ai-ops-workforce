import { Module } from '@nestjs/common';
import { ModuleConfigService } from '../common/module-config/module-config.service';
import { OperationsModule } from '../operations/operations.module';
import { RevenueModule } from '../revenue/revenue.module';
import { AgentRegistry } from './agent.registry';
import { CrmAgent } from './crm/crm.agent';
import { DispatchAgent } from './dispatch/dispatch.agent';
import { FollowupAgent } from './followup/followup.agent';
import { VoiceAgent } from './voice/voice.agent';
import { ChatAgent } from './chat/chat.agent';
import { DocumentAgent } from './document/document.agent';
import { VoiceController } from './voice/voice.controller';
import { ChatController } from './chat/chat.controller';

/**
 * The AI workforce. Each agent is a stateless, injectable service; AgentRegistry
 * is the dispatch point used by automation actions. Voice/Chat also expose
 * inbound webhook controllers. EventBus + integrations are global, so this
 * module imports nothing and can be safely imported by AutomationModule.
 */
@Module({
  imports: [OperationsModule, RevenueModule],
  controllers: [VoiceController, ChatController],
  providers: [
    ModuleConfigService,
    AgentRegistry,
    CrmAgent,
    DispatchAgent,
    FollowupAgent,
    VoiceAgent,
    ChatAgent,
    DocumentAgent,
  ],
  exports: [AgentRegistry, ModuleConfigService],
})
export class AgentsModule {}
