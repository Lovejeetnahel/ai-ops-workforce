import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CallStatus, VoiceAgentMode } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents, DomainEvent } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ScheduleService } from '../operations/scheduling/schedule.service';

/**
 * Voice AI V1 (Sprint 3). Productizes the EXISTING voice foundations (Vapi
 * webhook → EventBus → Conversation transcripts) without a second pipeline.
 *
 * HONESTY: phone connectivity is derived from the real provider configuration
 * at read time; CallRecord rows are created ONLY from provider webhook events
 * (call.completed / call.missed) or explicit staff entry — duration, outcome
 * and cost are never invented. Recording-consent is configuration the agent
 * must satisfy; we never claim recordings exist without a real URL.
 */
@Injectable()
export class VoiceAiService implements OnModuleInit {
  private readonly logger = new Logger(VoiceAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
    private readonly schedule: ScheduleService,
  ) {}

  onModuleInit() {
    // Real provider events → real call records (idempotent on externalRef).
    this.bus.on(DomainEvents.CALL_COMPLETED, (e) => this.recordFromEvent(e, 'COMPLETED'));
    this.bus.on(DomainEvents.CALL_MISSED, (e) => this.recordFromEvent(e, 'NO_ANSWER'));
  }

  private async recordFromEvent(e: DomainEvent, status: CallStatus) {
    try {
      const p: any = e.payload ?? {};
      const externalRef = p.callId ?? e.externalId ?? null;
      if (!externalRef) return; // nothing verifiable to record
      const existing = await this.prisma.db.callRecord.findFirst({
        where: { externalRef },
        select: { id: true, tenantId: true },
      });
      // Prefer the agent that answers this specific number (Sprint 4 phone
      // assignment), falling back to any enabled agent.
      const agent =
        (p.to ? await this.prisma.db.voiceAgent.findFirst({ where: { enabled: true, phoneNumber: p.to }, select: { id: true, tenantId: true } }) : null) ??
        (await this.prisma.db.voiceAgent.findFirst({ where: { enabled: true }, select: { id: true, tenantId: true } }));
      // Sprint 4 CRM matching: link the REAL caller to a contact. Existing
      // contact matched by phone; otherwise a contact is created from the
      // call's own facts (collected name if the assistant captured one).
      let contactId: string | null = null;
      if (p.from && typeof p.from === 'string') {
        const found = await this.prisma.db.contact.findFirst({ where: { phone: p.from }, select: { id: true, tenantId: true } });
        if (found) contactId = found.id;
        else {
          const collectedName = typeof p.collected?.name === 'string' && p.collected.name.trim() ? p.collected.name.trim() : null;
          const created = await this.prisma.db.contact.create({
            data: { name: collectedName ?? `Caller ${p.from}`, phone: p.from, tags: ['voice-caller'] } as any,
          });
          contactId = created.id;
        }
      }
      const data: any = {
        status,
        endedAt: new Date(),
        summary: typeof p.transcript === 'string' ? p.transcript.slice(0, 500) : null,
        // Provider-reported facts only — null when the provider didn't say.
        durationSec: typeof p.durationSec === 'number' ? p.durationSec : undefined,
        costUsd: typeof p.costUsd === 'number' ? p.costUsd : undefined,
        recordingUrl: typeof p.recordingUrl === 'string' ? p.recordingUrl : undefined,
        ...(contactId ? { contactId } : {}),
        meta: { from: p.from ?? null, to: p.to ?? null, collected: p.collected ?? null },
      };
      if (existing) await this.prisma.db.callRecord.update({ where: { id: existing.id }, data });
      else
        await this.prisma.db.callRecord.create({
          data: { ...data, externalRef, voiceAgentId: agent?.id ?? null, direction: 'INBOUND', startedAt: new Date() } as any,
        });
    } catch (err) {
      this.logger.warn(`call record from event failed: ${(err as Error).message}`);
    }
  }

  // ── Agents ─────────────────────────────────────────────────────────────
  async listAgents() {
    const [agents, comms] = await Promise.all([
      this.prisma.db.voiceAgent.findMany({ orderBy: { createdAt: 'asc' } }),
      this.providers.commsStatus(tenantContext.tenantId),
    ]);
    return agents.map((a) => ({
      ...a,
      // Derived, never stored: is a real voice provider configured?
      phoneConnected: comms.voice.configured,
      phoneNote: comms.voice.configured ? `Provider configured (${comms.voice.source})` : 'Setup required — connect Vapi in Settings → Integrations',
    }));
  }

  createAgent(input: { name: string; purpose?: string; mode?: string; greeting?: string; instructions?: string; businessHours?: any; recordingConsentRequired?: boolean; consentScript?: string }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.db.voiceAgent.create({
      data: {
        name: input.name.trim(),
        purpose: input.purpose ?? null,
        mode: (input.mode as VoiceAgentMode) ?? 'INBOUND',
        greeting: input.greeting ?? null,
        instructions: input.instructions ?? null,
        businessHours: input.businessHours ?? {},
        recordingConsentRequired: input.recordingConsentRequired ?? true,
        consentScript: input.consentScript ?? null,
      } as any,
    });
  }

  async updateAgent(id: string, input: Partial<{ name: string; purpose: string; mode: string; greeting: string; instructions: string; businessHours: any; recordingConsentRequired: boolean; consentScript: string; enabled: boolean; phoneNumber: string | null; providerRef: string | null; routing: any; outboundAuthorized: boolean }>) {
    await this.getAgent(id);
    const data: any = {};
    for (const k of ['name', 'purpose', 'greeting', 'instructions', 'consentScript'] as const) if (input[k] !== undefined) data[k] = input[k];
    if (input.mode !== undefined) data.mode = input.mode as VoiceAgentMode;
    if (input.businessHours !== undefined) data.businessHours = input.businessHours;
    if (input.recordingConsentRequired !== undefined) data.recordingConsentRequired = input.recordingConsentRequired;
    if (input.phoneNumber !== undefined || input.providerRef !== undefined) {
      // Assigning a phone number requires a genuinely configured provider —
      // a number string with nothing behind it would be a fake connection.
      if (input.phoneNumber) {
        const comms = await this.providers.commsStatus(tenantContext.tenantId);
        if (!comms.voice.configured)
          throw new BadRequestException('Assigning a phone number requires a connected voice provider (Vapi) first.');
      }
      if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
      if (input.providerRef !== undefined) data.providerRef = input.providerRef;
    }
    if (input.routing !== undefined) data.routing = input.routing;
    if (input.outboundAuthorized !== undefined) data.outboundAuthorized = input.outboundAuthorized;
    if (input.enabled !== undefined) {
      if (input.enabled) {
        const comms = await this.providers.commsStatus(tenantContext.tenantId);
        if (!comms.voice.configured)
          throw new BadRequestException('Enable requires a connected voice provider (Vapi) — Settings → Integrations. The agent stays honestly off until then.');
      }
      data.enabled = input.enabled;
    }
    return this.prisma.db.voiceAgent.update({ where: { id }, data });
  }

  private async getAgent(id: string) {
    const agent = await this.prisma.db.voiceAgent.findFirst({ where: { id } });
    if (!agent) throw new NotFoundException('Voice agent not found');
    return agent;
  }

  // ── Calls ──────────────────────────────────────────────────────────────
  async listCalls(filter: { status?: string; limit?: number }) {
    // CallRecords (webhook-verified) plus VOICE conversations (transcripts).
    const [records, voiceConvos] = await Promise.all([
      this.prisma.db.callRecord.findMany({
        where: filter.status ? { status: filter.status as CallStatus } : undefined,
        orderBy: { startedAt: 'desc' },
        take: Math.min(filter.limit ?? 100, 200),
      }),
      this.prisma.db.conversation.findMany({
        where: { channel: 'VOICE' },
        include: { contact: { select: { id: true, name: true, phone: true } }, messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { records, transcriptThreads: voiceConvos };
  }

  async callFollowUp(id: string, title?: string) {
    const call = await this.prisma.db.callRecord.findFirst({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    return this.prisma.db.activity.create({
      data: {
        type: 'TASK',
        status: 'OPEN',
        title: title ?? `Follow up on call${call.outcome ? ` (${call.outcome})` : ''}`,
        body: call.summary?.slice(0, 500) ?? null,
        actor: 'STAFF',
        authorUserId: tenantContext.get()?.userId ?? null,
        contactId: call.contactId,
        metadata: { callRecordId: id },
      } as any,
    });
  }

  /** Staff marks the real outcome of a call (booked / handed off / etc.). */
  async setCallOutcome(id: string, input: { outcome?: string; status?: string; contactId?: string }) {
    const call = await this.prisma.db.callRecord.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!call) throw new NotFoundException('Call not found');
    const data: any = {};
    if (input.outcome !== undefined) data.outcome = input.outcome;
    if (input.status !== undefined) data.status = input.status as CallStatus;
    if (input.contactId !== undefined) data.contactId = input.contactId;
    return this.prisma.db.callRecord.update({ where: { id }, data });
  }

  // ── Sprint 4: tenant-facing activation workflow ────────────────────────

  /**
   * Setup state machine for Voice AI activation. Every status is derived from
   * real configuration and real provider data — nothing is fabricated.
   */
  async setup() {
    const tenantId = tenantContext.tenantId;
    const [comms, agents] = await Promise.all([
      this.providers.commsStatus(tenantId),
      this.prisma.db.voiceAgent.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    let phoneNumbers: { available: boolean; numbers: Array<{ id: string; number: string; name?: string }>; error?: string } = { available: false, numbers: [] };
    if (comms.voice.configured) {
      try {
        const adapter = await this.providers.voice(tenantId);
        if (adapter.listPhoneNumbers) phoneNumbers = await adapter.listPhoneNumbers();
      } catch (err) {
        phoneNumbers = { available: false, numbers: [], error: `Provider phone-number lookup failed: ${(err as Error).message.slice(0, 120)}` };
      }
    }
    const withPhone = agents.filter((a) => a.phoneNumber);
    const enabled = agents.filter((a) => a.enabled);
    const steps = [
      { key: 'provider', label: 'Connect a voice provider (Vapi)', done: comms.voice.configured, detail: comms.voice.configured ? `Configured (${comms.voice.source})` : 'Settings → Integrations' },
      { key: 'agent', label: 'Create a voice agent', done: agents.length > 0, detail: `${agents.length} agent(s)` },
      { key: 'phone', label: 'Assign a phone number to an agent', done: withPhone.length > 0, detail: withPhone.length ? withPhone.map((a) => a.phoneNumber).join(', ') : 'No number assigned yet' },
      { key: 'routing', label: 'Configure hours, consent and human handoff', done: agents.some((a) => Object.keys((a.routing as any) ?? {}).length > 0 || Object.keys((a.businessHours as any) ?? {}).length > 0), detail: 'Business hours + handoff number' },
      { key: 'enable', label: 'Enable the agent', done: enabled.length > 0, detail: enabled.length ? `${enabled.length} live` : 'Off until enabled' },
    ];
    return {
      provider: { ...comms.voice, name: 'Vapi' },
      webhookPath: `/api/webhooks/voice/${tenantId}`,
      webhookNote: 'Point the provider at this path so calls create real records. Errors and retries are visible in the webhook reliability view.',
      phoneNumbers,
      agents: agents.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled, phoneNumber: a.phoneNumber, mode: a.mode, outboundAuthorized: a.outboundAuthorized })),
      steps,
      complete: steps.every((s2) => s2.done),
      outbound: {
        note: 'Outbound calling requires explicit owner authorization per agent, and is never exercised by automated tests.',
        authorizedAgents: agents.filter((a) => a.outboundAuthorized).length,
      },
    };
  }

  /** Create a REAL sales opportunity from a call (contact linked or created). */
  async createLeadFromCall(id: string, input: { title?: string; estimatedValue?: number } = {}) {
    const call = await this.prisma.db.callRecord.findFirst({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    let contactId = call.contactId;
    if (!contactId) {
      const from = (call.meta as any)?.from;
      if (!from) throw new BadRequestException('Call has no contact and no caller number — link a contact first');
      const contact = await this.prisma.db.contact.create({ data: { name: `Caller ${from}`, phone: from, tags: ['voice-caller'] } as any });
      contactId = contact.id;
      await this.prisma.db.callRecord.update({ where: { id }, data: { contactId } });
    }
    const lead = await this.prisma.db.lead.create({
      data: {
        contactId,
        entityType: 'lead',
        stage: 'NEW',
        source: 'voice',
        estimatedValue: input.estimatedValue ?? null,
        intake: { callRecordId: id, title: input.title ?? null, summary: call.summary?.slice(0, 500) ?? null },
      } as any,
    });
    await this.prisma.db.callRecord.update({ where: { id }, data: { outcome: call.outcome ?? 'opportunity created', meta: { ...((call.meta as any) ?? {}), leadId: lead.id } as any } });
    await this.bus.emit({ name: DomainEvents.LEAD_CREATED, tenantId: tenantContext.tenantId, payload: { lead: { id: lead.id, source: 'voice' }, contact: { id: contactId } } });
    return lead;
  }

  /** Create a REAL appointment from a call via the existing schedule engine. */
  async createBookingFromCall(id: string, input: { userId: string; start: string; durationMin?: number; notes?: string }) {
    const call = await this.prisma.db.callRecord.findFirst({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (!input.userId || !input.start) throw new BadRequestException('userId and start are required');
    const start = new Date(input.start);
    if (isNaN(start.getTime())) throw new BadRequestException('Invalid start datetime');
    const end = new Date(start.getTime() + (input.durationMin ?? 60) * 60_000);
    const booking = await this.schedule.book({
      userId: input.userId,
      start,
      end,
      contactId: call.contactId ?? null,
      notes: input.notes ?? `Booked from call${call.summary ? `: ${call.summary.slice(0, 100)}` : ''}`,
    });
    await this.prisma.db.callRecord.update({
      where: { id },
      data: { outcome: 'booked', meta: { ...((call.meta as any) ?? {}), bookingId: booking.id } as any },
    });
    await this.bus.emit({ name: DomainEvents.BOOKING_REQUESTED, tenantId: tenantContext.tenantId, source: 'voice', payload: { booking: { id: booking.id }, contact: call.contactId ? { id: call.contactId } : undefined } });
    return booking;
  }

  /** Real usage: webhook-verified minutes + provider-reported cost only. */
  async usage(days = 30) {
    const from = new Date(Date.now() - days * 86_400_000);
    const [agg, byStatus, handoffs] = await Promise.all([
      this.prisma.db.callRecord.aggregate({ where: { startedAt: { gte: from } }, _sum: { durationSec: true, costUsd: true }, _count: true }),
      this.prisma.db.callRecord.groupBy({ by: ['status'], where: { startedAt: { gte: from } }, _count: true }),
      this.prisma.db.callRecord.count({ where: { startedAt: { gte: from }, status: 'HANDED_OFF' } }),
    ]);
    return {
      windowDays: days,
      calls: agg._count,
      minutes: agg._sum.durationSec != null ? Math.round(Number(agg._sum.durationSec) / 60) : null,
      costUsd: agg._sum.costUsd != null ? Number(agg._sum.costUsd) : null,
      byStatus: byStatus.map((b) => ({ status: b.status, count: b._count })),
      handoffs,
      note: 'Minutes/cost come from provider webhooks only; null means the provider has not reported them.',
    };
  }
}
