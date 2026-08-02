import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CallStatus, VoiceAgentMode } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents, DomainEvent } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

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
      const agent = await this.prisma.db.voiceAgent.findFirst({ where: { enabled: true }, select: { id: true, tenantId: true } });
      const data: any = {
        status,
        endedAt: new Date(),
        summary: typeof p.transcript === 'string' ? p.transcript.slice(0, 500) : null,
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

  async updateAgent(id: string, input: Partial<{ name: string; purpose: string; mode: string; greeting: string; instructions: string; businessHours: any; recordingConsentRequired: boolean; consentScript: string; enabled: boolean }>) {
    await this.getAgent(id);
    const data: any = {};
    for (const k of ['name', 'purpose', 'greeting', 'instructions', 'consentScript'] as const) if (input[k] !== undefined) data[k] = input[k];
    if (input.mode !== undefined) data.mode = input.mode as VoiceAgentMode;
    if (input.businessHours !== undefined) data.businessHours = input.businessHours;
    if (input.recordingConsentRequired !== undefined) data.recordingConsentRequired = input.recordingConsentRequired;
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
