/**
 * Hexagonal PORTS. The core depends only on these interfaces; concrete adapters
 * (Twilio, Vapi, SendGrid, Google Calendar, Stripe, Anthropic) implement them
 * and are selected per-tenant from the Integration table. Swapping Vapi → Retell
 * is a one-line provider change, never a core refactor.
 */

export interface SmsPort {
  send(input: { to: string; body: string; from?: string; whatsapp?: boolean }): Promise<{ externalId: string }>;
}

export interface EmailPort {
  send(input: { to: string; subject: string; html: string; from?: string }): Promise<{ externalId: string }>;
}

export interface VoicePort {
  /** Place/host an outbound or inbound AI voice call. */
  startCall(input: { to: string; from?: string; assistantId?: string; context?: Record<string, unknown> }): Promise<{ callId: string }>;
  /** Normalize a provider webhook into our shape. */
  parseWebhook(body: unknown, headers: Record<string, string>): VoiceWebhookEvent;
}

export interface VoiceWebhookEvent {
  type: 'call.started' | 'call.completed' | 'call.missed' | 'transcript' | 'tool_call';
  callId: string;
  from?: string;
  to?: string;
  transcript?: string;
  /** Structured fields the assistant extracted (name, serviceType, urgency...). */
  collected?: Record<string, unknown>;
  externalId: string;
}

export interface CalendarPort {
  createEvent(input: { start: Date; end: Date; summary: string; attendees?: string[] }): Promise<{ eventId: string }>;
  freeBusy(input: { start: Date; end: Date; calendarId?: string }): Promise<{ busy: { start: Date; end: Date }[] }>;
}

export interface PaymentPort {
  createInvoice(input: { amount: number; currency: string; description: string; customerEmail?: string }): Promise<{ id: string; url: string }>;
  /**
   * Verify + normalize a provider webhook. Takes the RAW request body
   * (string, not pre-parsed JSON) because signature verification requires the
   * exact bytes the provider signed — re-serializing a parsed object is not
   * guaranteed to match byte-for-byte. Throws if a webhook secret is
   * configured and the signature is missing/invalid/expired (found via live
   * verification: an earlier version accepted any payload with ANY signature
   * value, including none — a forged webhook genuinely settled a real $9,999
   * invoice). `externalId` is the provider EVENT id (idempotency); `reference`
   * is the id of the object we created (payment link/intent) used to match
   * back to our pending Payment row.
   */
  parseWebhook(rawBody: string, signature: string): { type: string; externalId: string; reference?: string; amount?: number; succeeded: boolean };
}

export interface LlmPort {
  /** Provider identifier for usage auditing (e.g. "anthropic"; "stub" offline). */
  readonly provider: string;
  /** Exact model id calls are made with (usage rows must never merge models). */
  readonly model: string;
  /** Single-shot completion with optional tool definitions for agent reasoning. */
  complete(input: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    tools?: { name: string; description: string; input_schema: object }[];
    maxTokens?: number;
  }): Promise<{
    text: string;
    toolCalls?: { name: string; input: Record<string, unknown> }[];
    /** Real token counts from the provider response; absent in stub mode. */
    usage?: { inputTokens: number; outputTokens: number };
  }>;
}

/**
 * Embeddings for the Business Brain's RAG/semantic memory. Default adapter is
 * Voyage AI (Anthropic's recommended embeddings); the dimension MUST match the
 * pgvector column width (vector(1024)). Swap the model by swapping the adapter.
 */
export interface EmbeddingPort {
  readonly dimensions: number;
  embed(texts: string[], kind?: 'document' | 'query'): Promise<number[][]>;
}

/**
 * Vision/OCR for field photo understanding (before/after photos, scanned docs,
 * damage detection). The default adapter runs in stub mode until a provider key
 * is configured; swap in a real vision model without touching field services.
 */
export interface VisionPort {
  analyze(input: { url: string; hint?: string }): Promise<{ ocrText?: string; labels: string[]; summary?: string }>;
}
