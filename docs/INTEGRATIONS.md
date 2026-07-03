# Integrations — Ports & Adapters

The core depends only on **ports** (interfaces in
[ports.ts](../apps/api/src/integrations/ports.ts)). Concrete **adapters** live in
[adapters/](../apps/api/src/integrations/adapters) and are selected per-tenant by
[provider-factory.service.ts](../apps/api/src/integrations/provider-factory.service.ts).
Swapping a provider is a one-line change, never a core refactor.

| Capability | Port | Reference adapter | Swap-ins |
|---|---|---|---|
| Inbound/outbound voice | `VoicePort` | Vapi | Retell, Bland |
| SMS / WhatsApp | `SmsPort` | Twilio | MessageBird, Telnyx |
| Email | `EmailPort` | SendGrid | Postmark, SES |
| Calendar | `CalendarPort` | Google Calendar | Outlook, Cal.com |
| Payments (future) | `PaymentPort` | Stripe | Square |
| LLM (agent brain) | `LlmPort` | Anthropic (Opus) | any chat model |

## Credential model

- Each tenant stores its own provider credentials in the `Integration` table,
  **AES-256-GCM encrypted at rest** ([crypto.service.ts](../apps/api/src/common/crypto/crypto.service.ts)).
- `ProviderFactory` decrypts them, falls back to platform-level env vars, and if
  neither is present the adapter runs in safe **`[stub]` mode** (logs instead of
  calling out) so the scaffold runs offline and tests stay hermetic.

## Inbound webhooks

Registered with the tenant id in the path so tenancy resolves without a JWT:

```
POST /api/webhooks/voice/:tenantId      # Vapi/Retell end-of-call + tool calls
POST /api/webhooks/chat/:tenantId       # Twilio SMS/WhatsApp + web chat widget
POST /api/webhooks/payment/:tenantId    # Stripe (verify signature)  [wire-up point]
```

Each adapter's `parseWebhook` normalizes the provider payload into a domain
event; `EventLog` dedupes provider retries.

## Outbound

Agents and automation actions call the **`CommsService`** facade
([comms.service.ts](../apps/api/src/integrations/comms.service.ts)), which picks
the tenant's adapter, sends, and records the outbound `Message` on the
conversation timeline.

## Wiring a real provider (example: Twilio)

1. Owner pastes Account SID / Auth Token / number in the dashboard → stored
   encrypted in `Integration`.
2. Point Twilio's inbound webhook to `/api/webhooks/chat/<tenantId>`.
3. Done. `TwilioAdapter` leaves `[stub]` mode automatically once creds exist.

The same three steps apply to Vapi (voice), SendGrid (email), Google Calendar
(OAuth), and Stripe (payments).
