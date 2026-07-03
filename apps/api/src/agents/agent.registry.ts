import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Agent, AgentContext, AgentResult } from './agent.interface';
import { CrmAgent } from './crm/crm.agent';
import { DispatchAgent } from './dispatch/dispatch.agent';
import { FollowupAgent } from './followup/followup.agent';
import { VoiceAgent } from './voice/voice.agent';
import { ChatAgent } from './chat/chat.agent';
import { DocumentAgent } from './document/document.agent';

/**
 * Resolves an agent by name and runs it. This is the single dispatch point used
 * by TRIGGER_AGENT / ASSIGN_STAFF automation actions, so the automation engine
 * never hard-codes a concrete agent class.
 */
@Injectable()
export class AgentRegistry {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents = new Map<string, Agent>();

  constructor(
    crm: CrmAgent,
    dispatch: DispatchAgent,
    followup: FollowupAgent,
    voice: VoiceAgent,
    chat: ChatAgent,
    doc: DocumentAgent,
  ) {
    [crm, dispatch, followup, voice, chat, doc].forEach((a) => this.agents.set(a.name, a));
  }

  async run(name: string, ctx: AgentContext): Promise<AgentResult> {
    const agent = this.agents.get(name);
    if (!agent) {
      this.logger.warn(`No agent named "${name}"`);
      return { agent: name, ok: false, summary: 'unknown agent' };
    }
    this.logger.debug(`run agent "${name}"`);
    return agent.run(ctx);
  }
}
