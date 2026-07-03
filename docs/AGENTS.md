# The AI Workforce — Six Agents

Each agent is a stateless NestJS service implementing the `Agent` contract
([agent.interface.ts](../apps/api/src/agents/agent.interface.ts)). Agents never
call each other directly — they **react to and emit domain events**, which keeps
the workforce decoupled, independently testable, and horizontally scalable.

```
 Inbound call ─▶ Voice ─┐
 SMS/chat ─────▶ Chat ──┼─▶ (lead.created) ─▶ CRM ─▶ (lead.qualified)
                         │                              │
                         │                              ▼
                         │                          Dispatch ─▶ (job.assigned)
                         │                              │
 job.completed ──────────┼────────────▶ Follow-up ◀────┘
                         │
 invoice/quote needed ───┴────────────▶ Document
```

## A. Voice Agent — `voice`
[voice.agent.ts](../apps/api/src/agents/voice/voice.agent.ts) ·
[voice.controller.ts](../apps/api/src/agents/voice/voice.controller.ts)

- The AI receptionist. The audio runs on Vapi/Retell/Bland, **configured from the
  tenant's module** (`buildAssistantConfig` → persona + intake schema + a
  `submit_intake` tool).
- Ingests provider webhooks at `POST /api/webhooks/voice/:tenantId`; the adapter
  normalizes "end-of-call report" / "tool call" into our events.
- Collects name, service type, urgency, location → emits `call.completed` with
  structured data; **missed** calls emit `call.missed` (→ instant text-back).

## B. Chat Agent — `chat`
[chat.agent.ts](../apps/api/src/agents/chat/chat.agent.ts)

- The text twin of Voice: SMS / WhatsApp / web chat at
  `POST /api/webhooks/chat/:tenantId`.
- Uses the LLM (tenant persona + intake schema) for instant replies + lead
  qualification, sends booking links, and emits a qualification event when it has
  enough to create a lead.

## C. CRM Agent — `crm`
[crm.agent.ts](../apps/api/src/agents/crm/crm.agent.ts)

- Owns the lead lifecycle: de-dupes contacts (by phone/email), creates leads from
  any inbound channel, normalizes urgency, and advances pipeline stages
  (`new → contacted → qualified → booked → completed → lost`).
- Emits `lead.created` / `lead.stage_changed` — the spine other agents hang off.

## D. Dispatch Agent — `dispatch`
[dispatch.agent.ts](../apps/api/src/agents/dispatch/dispatch.agent.ts)

- Turns a qualified lead into an assigned, scheduled job. Scores staff by
  **skill + service zone**, checks **calendar free/busy** to avoid conflicts,
  creates the `Job` + `Booking`, books the slot (emergencies get the soonest),
  and emits `job.assigned`.

## E. Follow-up Agent — `followup`
[followup.agent.ts](../apps/api/src/agents/followup/followup.agent.ts)

- Reminders before appointments, review requests after `job.completed`, and
  re-engagement of cold leads. Most cadence is driven by `WAIT` actions in the
  automation engine; the agent performs the concrete outreach.

## F. Document & Admin Agent — `document`
[document.agent.ts](../apps/api/src/agents/document/document.agent.ts)

- Generates invoices, quotes, forms, contracts from the **module templates**,
  renders them (Handlebars-style), stores a `Document`, and attaches a Stripe pay
  link for invoices. Replaces the admin assistant's paperwork.

## Cooperation example — "missed call to booked job"

1. Vapi posts a missed call → `call.missed`.
2. Preset automation fires: SMS booking link + `TRIGGER_AGENT crm`.
3. Caller replies → Chat agent qualifies → emits qualification.
4. CRM agent creates `Lead` → `lead.created`.
5. Emergency preset: `TRIGGER_AGENT dispatch`.
6. Dispatch assigns nearest on-call tech, books slot → `job.assigned`.
7. After the visit → `job.completed` → Follow-up requests a review; Document
   issues the invoice.

No human touched any step.
