import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const VALID_CHANNELS = Object.values(Channel);
import { EventBus } from '../../automation/event-bus';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ChatAgent } from './chat.agent';

/**
 * Inbound webhook for text channels (Twilio SMS/WhatsApp, web-chat widget).
 * Resolves/creates the Conversation, then runs the Chat agent. Tenant id is in
 * the path (same pattern as the voice/payment webhooks) — the whole handler
 * MUST run inside `tenantContext.run()` so the tenant-scoping Prisma extension
 * can stamp `tenantId` on writes; without it every create() here throws a
 * Prisma validation error ("Argument `tenant` is missing"), found via live
 * end-to-end verification of the message.inbound → Control Layer outcome path.
 *
 * Register: POST /api/webhooks/chat/:tenantId
 */
@Controller('webhooks/chat')
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly chat: ChatAgent,
  ) {}

  @Post(':tenantId')
  ingest(@Param('tenantId') tenantId: string, @Body() body: any) {
    return tenantContext.run({ tenantId }, async () => {
      // Twilio: From/Body/MessageSid; web widget: from/text/channel.
      const from = body.From ?? body.from;
      const text = body.Body ?? body.text ?? '';
      const rawChannel = (body.channel ?? (String(from).startsWith('whatsapp:') ? 'WHATSAPP' : 'SMS')).toUpperCase();
      if (!VALID_CHANNELS.includes(rawChannel as Channel))
        throw new BadRequestException(`Invalid channel: ${rawChannel}`);
      const channel = rawChannel as Channel;
      const externalId = body.MessageSid ?? body.messageId;

      const contact = await this.prisma.db.contact.findFirst({ where: { phone: from } });
      let conversation = await this.prisma.db.conversation.findFirst({
        where: { contactId: contact?.id ?? undefined, channel, status: { not: 'CLOSED' } },
        orderBy: { updatedAt: 'desc' },
      });
      if (!conversation) {
        conversation = await this.prisma.db.conversation.create({
          data: { contactId: contact?.id ?? null, channel, handledBy: 'CHAT_AGENT', externalRef: from } as any,
        });
      }

      await this.bus.emit({
        name: 'message.inbound',
        tenantId,
        source: 'twilio',
        externalId,
        payload: { conversationId: conversation.id, text, from, channel },
      });

      // Run the agent synchronously so the channel gets a fast reply.
      await this.chat.run({
        event: { name: 'message.inbound', tenantId, payload: { conversationId: conversation.id, text, from, channel } },
      });

      return { received: true };
    });
  }
}
