import { Injectable, Logger } from '@nestjs/common';
import { AutomationAction } from '@aiow/config';
import { DomainEvent } from './events';
import { interpolate } from './rule-engine';
import { PrismaService } from '../common/prisma/prisma.service';
import { CommsService } from '../integrations/comms.service';
import { AgentRegistry } from '../agents/agent.registry';

/**
 * Executes a single resolved automation action. New action types are added here
 * and immediately become available to every industry's automation presets and
 * to tenant-authored rules. WAIT is handled by the worker (re-enqueue w/ delay),
 * so it is a no-op here.
 */
@Injectable()
export class ActionHandlers {
  private readonly logger = new Logger(ActionHandlers.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommsService,
    private readonly agents: AgentRegistry,
  ) {}

  async execute(action: AutomationAction, event: DomainEvent): Promise<void> {
    const p: any = action.params ?? {};
    const ctx = event.payload as any;

    switch (action.type) {
      case 'SEND_SMS':
      case 'SEND_WHATSAPP': {
        const body = interpolate(String(p.template ?? ''), ctx);
        await this.comms.sendSms(event.tenantId, {
          to: this.resolveRecipient(p.to, ctx),
          body,
          channel: action.type === 'SEND_WHATSAPP' ? 'WHATSAPP' : 'SMS',
        });
        break;
      }

      case 'SEND_EMAIL': {
        const body = interpolate(String(p.template ?? ''), ctx);
        await this.comms.sendEmail(event.tenantId, {
          to: this.resolveRecipient(p.to, ctx),
          subject: interpolate(String(p.subject ?? 'Update from your service team'), ctx),
          body,
        });
        break;
      }

      case 'UPDATE_STAGE': {
        if (ctx.lead?.id) {
          await this.prisma.db.lead.update({
            where: { id: ctx.lead.id },
            data: { stage: p.stage },
          });
        }
        break;
      }

      case 'CREATE_TASK': {
        await this.prisma.db.job.create({
          data: {
            leadId: ctx.lead?.id ?? null,
            contactId: ctx.contact?.id ?? null,
            entityType: p.entityType ?? 'task',
            title: interpolate(String(p.title ?? 'Follow up'), ctx),
            description: p.description ?? null,
          } as any,
        });
        break;
      }

      case 'ASSIGN_STAFF':
      case 'TRIGGER_AGENT': {
        const agentName = action.type === 'ASSIGN_STAFF' ? 'dispatch' : p.agent;
        await this.agents.run(agentName, { event, params: p });
        break;
      }

      case 'CREATE_BOOKING': {
        await this.agents.run('dispatch', { event, params: { ...p, intent: 'book' } });
        break;
      }

      case 'GENERATE_DOCUMENT': {
        await this.agents.run('document', { event, params: p });
        break;
      }

      case 'WAIT':
        // Handled by the worker (delayed re-enqueue); nothing to do inline.
        break;

      default:
        this.logger.warn(`Unknown action type: ${(action as any).type}`);
    }
  }

  /** "owner"/"manager"/"contact" → a concrete address; otherwise literal. */
  private resolveRecipient(to: unknown, ctx: any): string {
    if (!to || to === 'contact') return ctx.contact?.phone ?? ctx.contact?.email ?? '';
    if (to === 'owner' || to === 'manager') return ctx.tenant?.[to + 'Contact'] ?? '';
    return String(to);
  }
}
