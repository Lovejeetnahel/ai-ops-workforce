import { Logger } from '@nestjs/common';
import { VoicePort, VoiceWebhookEvent } from '../ports';

/**
 * Vapi voice adapter. Implements VoicePort so the Voice agent is provider-
 * agnostic — a RetellAdapter / BlandAdapter with the same interface drops in
 * without touching the agent. `parseWebhook` normalizes Vapi's end-of-call and
 * tool-call events (where the assistant returns collected intake fields) into
 * our VoiceWebhookEvent.
 */
export class VapiAdapter implements VoicePort {
  private readonly logger = new Logger(VapiAdapter.name);

  constructor(private readonly creds: { apiKey: string; phoneNumberId?: string; assistantId?: string }) {}

  async startCall(input: { to: string; from?: string; assistantId?: string; context?: Record<string, unknown> }) {
    if (!this.creds.apiKey) {
      this.logger.warn(`[stub] VOICE call → ${input.to}`);
      return { callId: `stub_${Date.now()}` };
    }
    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId: this.creds.phoneNumberId,
        assistantId: input.assistantId ?? this.creds.assistantId,
        customer: { number: input.to },
        assistantOverrides: { variableValues: input.context ?? {} },
      }),
    });
    if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return { callId: data.id };
  }

  parseWebhook(body: unknown, _headers: Record<string, string>): VoiceWebhookEvent {
    const msg: any = (body as any)?.message ?? body;
    const callId = msg?.call?.id ?? msg?.callId ?? 'unknown';
    const externalId = msg?.id ?? `${callId}:${msg?.type}`;

    switch (msg?.type) {
      case 'end-of-call-report': {
        const ended = msg?.endedReason ?? '';
        const missed = ['customer-did-not-answer', 'no-answer', 'voicemail'].includes(ended);
        return {
          type: missed ? 'call.missed' : 'call.completed',
          callId,
          from: msg?.call?.customer?.number,
          to: msg?.call?.phoneNumber?.number,
          transcript: msg?.artifact?.transcript ?? msg?.transcript,
          collected: msg?.analysis?.structuredData ?? {},
          externalId,
        };
      }
      case 'tool-calls':
      case 'function-call':
        return {
          type: 'tool_call',
          callId,
          collected: msg?.functionCall?.parameters ?? msg?.toolCalls?.[0]?.function?.arguments ?? {},
          externalId,
        };
      default:
        return { type: 'transcript', callId, transcript: msg?.transcript, externalId };
    }
  }
}
