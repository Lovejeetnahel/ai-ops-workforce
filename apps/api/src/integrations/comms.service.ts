import { Injectable } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from './provider-factory.service';

/**
 * Outbound communications facade used by automation actions and agents. Picks
 * the tenant's SMS/email adapter, sends, and records the outbound Message on the
 * relevant Conversation so the dashboard timeline stays complete.
 */
@Injectable()
export class CommsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
  ) {}

  async sendSms(
    tenantId: string,
    input: { to: string; body: string; channel?: 'SMS' | 'WHATSAPP'; conversationId?: string },
  ) {
    const adapter = await this.providers.sms(tenantId);
    const result = await adapter.send({ to: input.to, body: input.body, whatsapp: input.channel === 'WHATSAPP' });
    await this.logOutbound(input.conversationId, (input.channel ?? 'SMS') as Channel, input.body, result.externalId);
    return result;
  }

  async sendEmail(
    tenantId: string,
    input: { to: string; subject: string; body: string; conversationId?: string },
  ) {
    const adapter = await this.providers.email(tenantId);
    const html = `<div style="font-family:system-ui">${input.body.replace(/\n/g, '<br/>')}</div>`;
    const result = await adapter.send({ to: input.to, subject: input.subject, html });
    await this.logOutbound(input.conversationId, 'EMAIL', input.body, result.externalId);
    return result;
  }

  private async logOutbound(conversationId: string | undefined, channel: Channel, body: string, externalId: string) {
    if (!conversationId) return;
    await this.prisma.db.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        author: 'SYSTEM',
        body,
        meta: { externalId, channel },
      } as any,
    });
  }
}
