import { Body, Controller, Headers, Param, Post, Get, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { VoiceAgent } from './voice.agent';
import { WebhookLedgerService } from '../../common/webhooks/webhook-ledger.service';

/**
 * Inbound webhook surface for the voice provider (Vapi/Retell/Bland). The tenant
 * id is embedded in the registered URL path so we resolve tenancy without a JWT.
 * Events are normalized by the adapter's parseWebhook and emitted onto the bus,
 * where idempotency (EventLog) dedupes provider retries. Sprint 4 records every
 * delivery in the webhook reliability ledger before processing.
 *
 * Register with provider as: POST /api/webhooks/voice/:tenantId
 */
@Controller('webhooks/voice')
export class VoiceController implements OnModuleInit {
  constructor(
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
    private readonly voiceAgent: VoiceAgent,
    private readonly ledger: WebhookLedgerService,
  ) {}

  onModuleInit() {
    // Ledger retries re-run the stored provider payload through the same
    // processing path; EventLog idempotency makes a duplicate emit a no-op.
    this.ledger.registerRetryHandler('vapi', (delivery) =>
      tenantContext.run({ tenantId: delivery.tenantId }, () => this.processEvent(delivery.tenantId, delivery.payload)),
    );
  }

  @Post(':tenantId')
  ingest(
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    // Establish tenant context for the whole handler (defense-in-depth: any
    // direct prisma.db.* call added here in future needs it to auto-stamp
    // tenantId — see chat.controller.ts for the bug this pattern prevents).
    return tenantContext.run({ tenantId }, async () => {
      const adapter = await this.providers.voice(tenantId);
      const evt = adapter.parseWebhook(body, headers);

      // Sprint 4 reliability center: record the delivery before processing.
      const recorded = await this.ledger.record({
        provider: 'vapi',
        eventType: evt.type,
        eventId: evt.externalId,
        tenantId,
        entity: 'call',
        entityId: evt.callId,
        payload: body,
      });
      if (recorded.duplicate) return { received: true, duplicate: true };

      try {
        await this.processEvent(tenantId, body, headers);
        await this.ledger.markProcessed(recorded.delivery!.id);
      } catch (err) {
        await this.ledger.markFailed(recorded.delivery!.id, err as Error);
        throw err;
      }

      return { received: true };
    });
  }

  /** Parse + emit (shared by live ingest and ledger retries). */
  private async processEvent(tenantId: string, body: unknown, headers: Record<string, string> = {}) {
    const adapter = await this.providers.voice(tenantId);
    const evt = adapter.parseWebhook(body, headers);
    const nameMap: Record<string, string> = {
      'call.missed': DomainEvents.CALL_MISSED,
      'call.completed': DomainEvents.CALL_COMPLETED,
    };
    await this.bus.emit({
      name: nameMap[evt.type] ?? `voice.${evt.type}`,
      tenantId,
      source: 'vapi',
      externalId: evt.externalId,
      payload: {
        callId: evt.callId,
        from: evt.from,
        to: evt.to,
        collected: evt.collected,
        transcript: evt.transcript,
        durationSec: evt.durationSec,
        costUsd: evt.costUsd,
        recordingUrl: evt.recordingUrl,
      },
    });
  }

  /** Exposes the per-tenant assistant config to provision the voice assistant. */
  @Get(':tenantId/assistant-config')
  assistantConfig(@Param('tenantId') tenantId: string) {
    return this.voiceAgent.buildAssistantConfig(tenantId);
  }
}
