import { Injectable } from '@nestjs/common';
import { MemorySubject } from '@prisma/client';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { ModuleConfigService } from '../../common/module-config/module-config.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { CommsService } from '../../integrations/comms.service';
import { BrainContextService } from '../../brain/brain-context.service';

/**
 * CHAT AGENT — the AI handling SMS / WhatsApp / web chat. It maintains the
 * conversation, uses the LLM (with the tenant's persona + intake schema) to
 * reply and qualify the lead, and when it has enough information emits an event
 * so the CRM agent creates the lead and the Dispatch agent books a visit. It is
 * the text-channel twin of the Voice agent.
 */
@Injectable()
export class ChatAgent implements Agent {
  readonly name = 'chat';

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly moduleConfig: ModuleConfigService,
    private readonly providers: ProviderFactory,
    private readonly comms: CommsService,
    private readonly brainContext: BrainContextService,
  ) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const event = ctx.event!;
    const tenantId = event.tenantId;
    const { conversationId, text, from, channel } = event.payload as any;

    const config = await this.moduleConfig.forTenant(tenantId);
    const [history, conversation] = await Promise.all([
      this.prisma.db.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 20 }),
      this.prisma.db.conversation.findUnique({ where: { id: conversationId }, select: { contactId: true } }),
    ]);

    const llm = this.providers.llm();

    // Ground the persona in the Business Brain (RAG + this customer's memory).
    // Customer-facing → only PUBLIC knowledge. Fails open to the bare persona.
    const basePersona =
      `${config.agentPersona}\n\nCollect these fields, one or two at a time, then ` +
      `confirm a booking: ${config.intakeFields.map((f) => f.label).join(', ')}. ` +
      `Keep replies under 320 characters.`;
    const system = await this.brainContext.composeAgentContext({
      persona: basePersona,
      query: text,
      role: 'CUSTOMER',
      subject: conversation?.contactId
        ? { type: MemorySubject.CUSTOMER, id: conversation.contactId }
        : undefined,
    });

    const reply = await llm.complete({
      system,
      messages: [
        ...history.map((m) => ({
          role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.body,
        })),
        { role: 'user', content: text },
      ],
      maxTokens: 300,
    });

    // Persist inbound + outbound, send the reply on the originating channel.
    await this.prisma.db.message.create({
      data: { conversationId, direction: 'INBOUND', author: 'CONTACT', body: text } as any,
    });
    await this.prisma.db.message.create({
      data: { conversationId, direction: 'OUTBOUND', author: 'CHAT_AGENT', body: reply.text } as any,
    });
    await this.comms.sendSms(tenantId, { to: from, body: reply.text, channel, conversationId });

    // Heuristic: once we have a contact + service type, qualify the lead.
    const collected = this.extractCollected(history, text, config);
    if (collected.serviceType && (collected.phone || from)) {
      await this.bus.emit({
        name: DomainEvents.MESSAGE_RECEIVED,
        tenantId,
        payload: { collected: { ...collected, phone: collected.phone ?? from }, source: channel?.toLowerCase() ?? 'chat' },
      });
    }

    return { agent: this.name, ok: true, summary: 'replied + qualified' };
  }

  /** Lightweight slot-filling; the LLM tool-call path is the production route. */
  private extractCollected(history: any[], latest: string, config: any) {
    const blob = [...history.map((m) => m.body), latest].join(' ').toLowerCase();
    const collected: Record<string, unknown> = {};
    for (const f of config.intakeFields) {
      if (f.type === 'select' && f.options) {
        const hit = f.options.find((o: string) => blob.includes(o.toLowerCase()));
        if (hit) collected[f.key] = hit;
      }
    }
    return collected;
  }
}
