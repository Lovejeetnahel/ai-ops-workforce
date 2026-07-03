import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Field communications: emergency SOS alerts and internal team chat. SOS emits a
 * high-priority event (which automations/supervisors react to) and records a
 * SYSTEM activity. Internal chat reuses the existing Conversation/Message system
 * on the INTERNAL channel — no separate messaging stack.
 */
@Injectable()
export class FieldCommsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async sos(userId: string, input: { lat?: number; lng?: number; note?: string }) {
    await this.prisma.db.activity.create({
      data: { type: 'SYSTEM', actor: 'STAFF', title: '🚨 SOS Alert', body: input.note ?? 'Emergency assistance requested', metadata: { userId, lat: input.lat, lng: input.lng } } as any,
    });
    await this.bus.emit({
      name: DomainEvents.FIELD_SOS,
      tenantId: tenantContext.tenantId,
      payload: { user: { id: userId }, lat: input.lat, lng: input.lng, note: input.note },
    });
    return { ok: true };
  }

  async postInternal(userId: string, text: string, conversationId?: string) {
    let convo = conversationId
      ? await this.prisma.db.conversation.findFirst({ where: { id: conversationId, channel: 'INTERNAL' } })
      : await this.prisma.db.conversation.findFirst({ where: { channel: 'INTERNAL', status: { not: 'CLOSED' } }, orderBy: { updatedAt: 'desc' } });
    if (!convo) convo = await this.prisma.db.conversation.create({ data: { channel: 'INTERNAL', handledBy: 'STAFF' } as any });

    return this.prisma.db.message.create({
      data: { conversationId: convo.id, direction: 'OUTBOUND', author: 'STAFF', body: text, meta: { userId } } as any,
    });
  }

  async listInternal() {
    return this.prisma.db.conversation.findMany({
      where: { channel: 'INTERNAL' },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
    });
  }
}
