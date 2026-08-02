import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Channel, ConversationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { CommsService } from '../integrations/comms.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { BrainContextService } from '../brain/brain-context.service';

const REPLYABLE: Channel[] = ['SMS', 'WHATSAPP', 'EMAIL', 'WEBCHAT', 'PORTAL'];

/**
 * Unified Inbox V1 (Sprint 2). One tenant-scoped queue over the EXISTING
 * Conversation/Message models — webhooks (voice/chat) and agents already write
 * here; this service adds the staff-facing operations: list/filter/search,
 * assignment (human or AI employee), unread state, status transitions,
 * internal notes, replies, and an AI reply SUGGESTION (approval-first: the
 * suggestion is returned to the human, never auto-sent).
 *
 * HONESTY: replies on SMS/WhatsApp/Email require a really-configured provider
 * (ProviderFactory.commsStatus) — otherwise a clear 503 "setup required", never
 * a silent stub send. WEBCHAT/PORTAL replies are recorded on the thread itself
 * (that IS the transport the portal reads). VOICE threads are transcripts —
 * replying in-thread is not supported and says so.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly comms: CommsService,
    private readonly bus: EventBus,
    private readonly brainContext: BrainContextService,
  ) {}

  async list(filter: {
    status?: string;
    channel?: string;
    assignedToId?: string;
    unread?: boolean;
    q?: string;
  }) {
    const where: any = {};
    if (filter.status) where.status = filter.status as ConversationStatus;
    if (filter.channel) where.channel = filter.channel as Channel;
    if (filter.assignedToId === 'me') where.assignedToId = tenantContext.get()?.userId;
    else if (filter.assignedToId === 'unassigned') where.assignedToId = null;
    else if (filter.assignedToId) where.assignedToId = filter.assignedToId;
    if (filter.unread) where.unread = true;
    if (filter.q) {
      where.OR = [
        { subject: { contains: filter.q, mode: 'insensitive' } },
        { contact: { is: { name: { contains: filter.q, mode: 'insensitive' } } } },
        { messages: { some: { body: { contains: filter.q, mode: 'insensitive' }, isInternal: false } } },
      ];
    }
    const rows = await this.prisma.db.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        lead: { select: { id: true, stage: true, serviceType: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: 200,
    });
    return rows.map((c) => ({ ...c, lastMessage: c.messages[0] ?? null, messages: undefined }));
  }

  async get(id: string) {
    const convo = await this.prisma.db.conversation.findFirst({
      where: { id },
      include: {
        contact: true,
        lead: { select: { id: true, stage: true, serviceType: true, estimatedValue: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 500 },
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  /** Manually start a thread with an existing contact (or a brand-new one). */
  async create(input: {
    contactId?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    channel: string;
    subject?: string;
    body?: string;
  }) {
    if (!REPLYABLE.includes(input.channel as Channel) && input.channel !== 'INTERNAL')
      throw new BadRequestException(`Conversations can be started on: ${[...REPLYABLE, 'INTERNAL'].join(', ')}`);

    let contactId = input.contactId ?? null;
    if (!contactId) {
      if (!input.contactName) throw new BadRequestException('contactId or contactName is required');
      const contact = await this.prisma.db.contact.create({
        data: { name: input.contactName, phone: input.phone ?? null, email: input.email ?? null } as any,
      });
      contactId = contact.id;
    }

    const convo = await this.prisma.db.conversation.create({
      data: {
        contactId,
        channel: input.channel as Channel,
        status: 'OPEN',
        handledBy: 'STAFF',
        subject: input.subject ?? null,
        assignedToId: tenantContext.get()?.userId ?? null,
        lastMessageAt: input.body ? new Date() : null,
      } as any,
    });
    if (input.body) await this.reply(convo.id, { body: input.body });
    return this.get(convo.id);
  }

  /** Outbound reply from a human. Provider-honest per channel (see class doc). */
  async reply(id: string, input: { body: string }) {
    if (!input.body?.trim()) throw new BadRequestException('Reply body is required');
    const convo = await this.get(id);

    if (convo.channel === 'VOICE')
      throw new BadRequestException(
        'This is a voice-call transcript — in-thread replies are not supported. Call the customer back or start an SMS thread.',
      );

    if (convo.channel === 'SMS' || convo.channel === 'WHATSAPP' || convo.channel === 'EMAIL') {
      const status = await this.providers.commsStatus(tenantContext.tenantId);
      if ((convo.channel === 'EMAIL' && !status.email.configured) || (convo.channel !== 'EMAIL' && !status.sms.configured))
        throw new ServiceUnavailableException(
          `Sending on ${convo.channel} requires a connected ${convo.channel === 'EMAIL' ? 'email (SendGrid)' : 'SMS (Twilio)'} integration — set it up in Settings → Integrations.`,
        );
      const to = convo.channel === 'EMAIL' ? convo.contact?.email : convo.contact?.phone;
      if (!to)
        throw new BadRequestException(`This contact has no ${convo.channel === 'EMAIL' ? 'email address' : 'phone number'} on file.`);
      if (convo.channel === 'EMAIL')
        await this.comms.sendEmail(tenantContext.tenantId, { to, subject: convo.subject ?? 'Re: your conversation', body: input.body });
      else
        await this.comms.sendSms(tenantContext.tenantId, { to, body: input.body, channel: convo.channel as 'SMS' | 'WHATSAPP' });
    }

    // WEBCHAT / PORTAL / INTERNAL: the thread itself is the transport.
    const message = await this.prisma.db.message.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        author: 'STAFF',
        body: input.body,
        meta: { sentByUserId: tenantContext.get()?.userId ?? null },
      } as any,
    });
    await this.touch(id, { unread: false, status: 'OPEN' });
    return message;
  }

  /** Internal note — staff-only, never delivered to the contact. */
  async addNote(id: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('Note body is required');
    await this.assertExists(id);
    const note = await this.prisma.db.message.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        author: 'STAFF',
        body,
        isInternal: true,
        meta: { noteByUserId: tenantContext.get()?.userId ?? null },
      } as any,
    });
    await this.touch(id, {});
    return note;
  }

  /** Assign to a staff member, an AI employee, or clear both. */
  async assign(id: string, input: { userId?: string | null; agentKey?: string | null }) {
    await this.assertExists(id);
    const data: any = {};
    if (input.userId !== undefined) {
      if (input.userId) {
        const user = await this.prisma.db.user.findFirst({ where: { id: input.userId }, select: { id: true, tenantId: true } });
        if (!user) throw new BadRequestException('Unknown team member');
      }
      data.assignedToId = input.userId;
    }
    if (input.agentKey !== undefined) {
      if (input.agentKey) {
        const install = await this.prisma.db.agentInstallation.findFirst({
          where: { agentKey: input.agentKey },
          select: { id: true, enabled: true, tenantId: true },
        });
        if (!install?.enabled)
          throw new BadRequestException('That AI employee is not installed/enabled for this workspace.');
      }
      data.agentKey = input.agentKey;
      data.handledBy = input.agentKey ? 'CHAT_AGENT' : 'STAFF';
    }
    const convo = await this.prisma.db.conversation.update({ where: { id }, data });
    await this.bus.emit({
      name: DomainEvents.CONVERSATION_ASSIGNED,
      tenantId: tenantContext.tenantId,
      payload: { conversation: { id, assignedToId: convo.assignedToId, agentKey: convo.agentKey } },
    });
    return convo;
  }

  async setStatus(id: string, status: string) {
    if (!['OPEN', 'WAITING', 'CLOSED'].includes(status)) throw new BadRequestException('status must be OPEN, WAITING or CLOSED');
    await this.assertExists(id);
    const convo = await this.prisma.db.conversation.update({
      where: { id },
      data: { status: status as ConversationStatus, closedAt: status === 'CLOSED' ? new Date() : null },
    });
    if (status === 'CLOSED')
      await this.bus.emit({ name: DomainEvents.CONVERSATION_CLOSED, tenantId: tenantContext.tenantId, payload: { conversation: { id } } });
    return convo;
  }

  async markRead(id: string) {
    await this.assertExists(id);
    return this.prisma.db.conversation.update({ where: { id }, data: { unread: false } });
  }

  /**
   * AI reply suggestion — grounded in the Business Brain (company facts, RAG,
   * contact memory) plus the visible thread. Returned as a DRAFT for the human
   * to edit/approve/send; this method never sends anything. Honest when the
   * platform LLM is not configured.
   */
  async suggestReply(id: string) {
    const llm = this.providers.llm();
    if (llm.provider === 'stub')
      return { available: false, reason: 'AI drafting requires the platform AI to be configured (ANTHROPIC_API_KEY).', suggestion: null };

    const convo = await this.get(id);
    const thread = convo.messages
      .filter((m: any) => !m.isInternal)
      .slice(-12)
      .map((m: any) => `${m.direction === 'INBOUND' ? (convo.contact?.name ?? 'Customer') : 'Us'}: ${m.body}`)
      .join('\n');
    const grounded = await this.brainContext.composeAgentContext({
      persona: 'You are the business\'s customer-communication assistant.',
      query: thread.slice(-800) || (convo.subject ?? 'customer conversation'),
      role: tenantContext.get()?.role ?? 'STAFF',
      subject: convo.contact ? { type: 'CUSTOMER' as any, id: convo.contact.id, label: convo.contact.name } : undefined,
      agent: { key: 'chat' },
    });
    const { text } = await llm.complete({
      system: `You draft ONE reply for a staff member to review before sending. Write in the company's voice, be concise and concrete, never invent prices/availability not present in the context, and never promise actions the business hasn't confirmed.\n\n${grounded}`,
      messages: [{ role: 'user', content: `Conversation so far:\n${thread || '(no visible messages yet)'}\n\nDraft the next reply from us.` }],
      maxTokens: 400,
    });
    return { available: true, suggestion: text.trim(), note: 'Draft only — review and send it yourself.' };
  }

  /** Channel availability for the inbox UI — configured vs setup-required. */
  async channels() {
    const status = await this.providers.commsStatus(tenantContext.tenantId);
    return [
      { channel: 'SMS', configured: status.sms.configured, requires: 'Twilio' },
      { channel: 'WHATSAPP', configured: status.sms.configured, requires: 'Twilio' },
      { channel: 'EMAIL', configured: status.email.configured, requires: 'SendGrid' },
      { channel: 'VOICE', configured: status.voice.configured, requires: 'Vapi', note: 'Inbound transcripts; no in-thread replies' },
      { channel: 'WEBCHAT', configured: true, requires: null },
      { channel: 'PORTAL', configured: true, requires: null },
    ];
  }

  private async assertExists(id: string) {
    const row = await this.prisma.db.conversation.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!row) throw new NotFoundException('Conversation not found');
  }

  private touch(id: string, extra: { unread?: boolean; status?: ConversationStatus | string }) {
    return this.prisma.db.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), ...(extra.unread !== undefined ? { unread: extra.unread } : {}), ...(extra.status ? { status: extra.status as ConversationStatus } : {}) },
    });
  }
}
