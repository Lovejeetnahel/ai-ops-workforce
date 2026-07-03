import { Body, Controller, Headers, Param, Post, Get } from '@nestjs/common';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { VoiceAgent } from './voice.agent';

/**
 * Inbound webhook surface for the voice provider (Vapi/Retell/Bland). The tenant
 * id is embedded in the registered URL path so we resolve tenancy without a JWT.
 * Events are normalized by the adapter's parseWebhook and emitted onto the bus,
 * where idempotency (EventLog) dedupes provider retries.
 *
 * Register with provider as: POST /api/webhooks/voice/:tenantId
 */
@Controller('webhooks/voice')
export class VoiceController {
  constructor(
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
    private readonly voiceAgent: VoiceAgent,
  ) {}

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

      const nameMap: Record<string, string> = {
        'call.missed': DomainEvents.CALL_MISSED,
        'call.completed': DomainEvents.CALL_COMPLETED,
      };

      await this.bus.emit({
        name: nameMap[evt.type] ?? `voice.${evt.type}`,
        tenantId,
        source: 'vapi',
        externalId: evt.externalId,
        payload: { callId: evt.callId, from: evt.from, to: evt.to, collected: evt.collected, transcript: evt.transcript },
      });

      return { received: true };
    });
  }

  /** Exposes the per-tenant assistant config to provision the voice assistant. */
  @Get(':tenantId/assistant-config')
  assistantConfig(@Param('tenantId') tenantId: string) {
    return this.voiceAgent.buildAssistantConfig(tenantId);
  }
}
