import { Injectable } from '@nestjs/common';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CommsService } from '../../integrations/comms.service';

/**
 * FOLLOW-UP AGENT — the persistence layer of the sales/ops loop. Sends reminders
 * before appointments, requests reviews after completed jobs, and re-engages
 * leads that went cold. Most follow-ups are scheduled via WAIT actions in the
 * automation engine; this agent performs the concrete outreach when invoked.
 */
@Injectable()
export class FollowupAgent implements Agent {
  readonly name = 'followup';

  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommsService,
  ) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const tenantId = ctx.event!.tenantId;
    const kind = (ctx.params?.kind as string) ?? 'reminder';
    const contactId = (ctx.event!.payload as any).contact?.id ?? (ctx.params?.contactId as string);
    if (!contactId) return { agent: this.name, ok: false, summary: 'no contact' };

    const contact = await this.prisma.db.contact.findUniqueOrThrow({ where: { id: contactId } });
    const messages: Record<string, string> = {
      reminder: `Hi ${contact.name}, this is a reminder about your upcoming appointment. Reply C to confirm.`,
      review: `Thanks for choosing us, ${contact.name}! Mind leaving a quick review? ${ctx.params?.reviewUrl ?? ''}`,
      reengage: `Hi ${contact.name}, just checking in — still need help? We're ready when you are.`,
    };

    if (contact.phone) {
      await this.comms.sendSms(tenantId, { to: contact.phone, body: messages[kind] ?? messages.reminder });
    } else if (contact.email) {
      await this.comms.sendEmail(tenantId, { to: contact.email, subject: 'Following up', body: messages[kind] ?? messages.reminder });
    }

    return { agent: this.name, ok: true, summary: `${kind} sent to ${contact.name}` };
  }
}
