import { Injectable, Logger } from '@nestjs/common';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';

/** Intents that legitimately create a lead from call/chat-collected data. */
const CREATE_LEAD_INTENTS = new Set(['create_lead', 'create_lead_from_call']);

/**
 * CRM AGENT — owns the lead lifecycle. Creates leads from inbound calls/chats,
 * de-duplicates contacts, advances pipeline stages, and keeps the source of
 * truth consistent. Reacts to call/message events; emits lead.created /
 * lead.stage_changed which in turn drive other agents.
 *
 * IMPORTANT (found via live verification — a real, reproduced infinite loop):
 * intent dispatch is an explicit allow-list, not "anything unrecognized falls
 * through to lead-creation". The Property Management preset "route_request"
 * triggers on `lead.created` with `TRIGGER_AGENT crm intent=triage_maintenance`
 * — an intent this agent never implemented. The old code silently treated ANY
 * unrecognized intent as "create a lead from the current event's payload",
 * which for a `lead.created`-triggered call means creating a new lead FROM a
 * lead.created event and re-emitting `lead.created` — a self-sustaining
 * infinite loop (reproduced: 2128 leads created before the process was
 * killed). Unrecognized intents now log a warning and no-op instead.
 */
@Injectable()
export class CrmAgent implements Agent {
  readonly name = 'crm';
  private readonly logger = new Logger(CrmAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const tenantId = ctx.event!.tenantId;
    const intent = (ctx.params?.intent as string) ?? 'create_lead';

    if (intent === 'advance_stage') {
      const { leadId, stage } = ctx.params as any;
      await this.prisma.db.lead.update({ where: { id: leadId }, data: { stage } });
      await this.bus.emit({
        name: DomainEvents.LEAD_STAGE_CHANGED,
        tenantId,
        payload: { lead: { id: leadId, stage } },
      });
      return { agent: this.name, ok: true, summary: `lead ${leadId} → ${stage}`, emitted: [DomainEvents.LEAD_STAGE_CHANGED] };
    }

    if (!CREATE_LEAD_INTENTS.has(intent)) {
      this.logger.warn(`CrmAgent: unrecognized intent "${intent}" — no-op (not falling through to lead creation)`);
      return { agent: this.name, ok: false, summary: `unrecognized intent: ${intent}` };
    }

    // create_lead / create_lead_from_call: create (or attach to) a lead from
    // call/chat-collected data — never from an already-created lead's own payload.
    const collected = (ctx.event!.payload as any).collected ?? (ctx.event!.payload as any) ?? {};
    const contact = await this.upsertContact(collected);
    const entityType = (ctx.params?.entityType as string) ?? 'lead';

    const lead = await this.prisma.db.lead.create({
      data: {
        contactId: contact.id,
        entityType,
        source: (ctx.event!.payload as any).source ?? ctx.event!.name,
        serviceType: collected.serviceType ?? null,
        urgency: this.normalizeUrgency(collected.urgency),
        location: collected.location ?? collected.unit ?? null,
        intake: collected,
        stage: 'NEW',
      } as any,
    });

    await this.bus.emit({
      name: DomainEvents.LEAD_CREATED,
      tenantId,
      payload: {
        lead: { id: lead.id, urgency: lead.urgency, serviceType: lead.serviceType, location: lead.location },
        contact: { id: contact.id, name: contact.name, phone: contact.phone, email: contact.email },
      },
    });

    return { agent: this.name, ok: true, summary: `created lead ${lead.id}`, emitted: [DomainEvents.LEAD_CREATED] };
  }

  /** De-dupe contacts by phone/email within the tenant. */
  private async upsertContact(c: any) {
    const existing = await this.prisma.db.contact.findFirst({
      where: { OR: [c.phone ? { phone: c.phone } : undefined, c.email ? { email: c.email } : undefined].filter(Boolean) as any },
    });
    if (existing) return existing;
    return this.prisma.db.contact.create({
      data: { name: c.name ?? 'Unknown caller', phone: c.phone ?? null, email: c.email ?? null, attributes: c } as any,
    });
  }

  private normalizeUrgency(raw?: string): 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY' {
    const v = (raw ?? '').toLowerCase();
    if (v.includes('emergency') || v.includes('flood') || v.includes('no heat')) return 'EMERGENCY';
    if (v.includes('urgent') || v.includes('asap') || v.includes('as soon')) return 'HIGH';
    if (v.includes('flexible') || v.includes('exploring')) return 'LOW';
    return 'NORMAL';
  }
}
