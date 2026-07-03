# System Architecture

## 1. Goals & constraints

| Goal | Design response |
|---|---|
| One platform, three industries | Generic core + **Industry Module Config** (`packages/config`) |
| Replace human ops roles | Six cooperating **AI agents** orchestrated by an **automation engine** |
| Multi-tenant SaaS | Shared DB, `tenantId` on every row, tenant context via `AsyncLocalStorage`, Postgres RLS-ready |
| Production-grade | Typed contracts, queue-backed async, idempotent webhooks, audit log, RBAC |
| Integration-ready | Hexagonal **ports & adapters** for every external provider |

## 2. High-level topology

```
                ┌────────────────────────────────────────────────────────┐
                │                     Clients                             │
                │  Owner dashboard · Staff app · Customer portal (Next.js) │
                └───────────────┬───────────────────────┬────────────────┘
                                │ REST/JSON (JWT)        │
            inbound webhooks    ▼                        ▼  SSE / polling
   ┌──────────────────┐   ┌──────────────────────────────────────────────┐
   │ Vapi / Twilio /  │──▶│                 NestJS API                     │
   │ Retell / Stripe  │   │  Auth · Tenancy · RBAC · REST modules          │
   └──────────────────┘   │  Agents (6) · Automation engine (producer)     │
                          └───────┬───────────────────────────┬───────────┘
                                  │ enqueue jobs               │ read/write
                                  ▼                            ▼
                          ┌───────────────┐            ┌───────────────┐
                          │  Redis +      │            │  PostgreSQL   │
                          │  BullMQ       │            │  (Prisma)     │
                          └──────┬────────┘            └───────────────┘
                                 │ consume
                          ┌──────▼────────┐
                          │ Worker process │  automation actions, follow-ups,
                          │ (same image)   │  doc generation, outbound comms
                          └──────┬─────────┘
                                 │ via adapters
                          ┌──────▼──────────────────────────────────────┐
                          │ Twilio · SendGrid · Google Calendar · Stripe │
                          │ Vapi · Anthropic (LLM)                       │
                          └──────────────────────────────────────────────┘
```

The **API process** handles synchronous request/response and webhook ingestion;
it emits domain events. The **worker process** (identical image, different entry
point) consumes queued work so slow outbound calls never block a web request.

## 3. Multi-tenancy

- **Isolation model:** shared database, shared schema, `tenantId` discriminator
  on every tenant-scoped table (cheapest to operate, scales to tens of thousands
  of SMBs). Path to per-tenant schema or DB exists if a large customer needs it.
- **Tenant resolution:** `TenantMiddleware` derives the tenant from the JWT
  (`tid` claim) or a subdomain/`X-Tenant` header for webhooks, then stores it in
  an `AsyncLocalStorage` store (`TenantContext`). Every Prisma query is wrapped
  by a tenant-scoped client extension that injects `tenantId` into `where` and
  `data`, so a developer cannot accidentally leak across tenants.
- **Defense in depth:** the schema is **Row-Level-Security ready** — enable
  Postgres RLS policies keyed on `current_setting('app.tenant_id')` for hard
  isolation in regulated verticals (immigration/legal).

See [tenant-context.ts](../apps/api/src/common/tenancy/tenant-context.ts) and
[prisma.service.ts](../apps/api/src/common/prisma/prisma.service.ts).

## 4. Role-based access control

Four roles, hierarchical:

| Role | Sees | Typical user |
|---|---|---|
| `OWNER` | Everything in the tenant + billing + settings | Business owner |
| `ADMIN` | Operations, all leads/jobs, staff management | Office manager |
| `STAFF` | Assigned jobs, own schedule, customer contact | Technician / contractor / caseworker |
| `CUSTOMER` | Own conversations, bookings, documents | The end customer / tenant / applicant |

Enforced by `@Roles()` decorator + `RolesGuard`, evaluated after the JWT auth
guard. Customers authenticate into the **Customer Portal** with scoped tokens
(`aud: "portal"`).

## 5. Domain modules (NestJS)

```
src/
├── common/            prisma, tenancy, rbac, config-loader, crypto
├── auth/              login, refresh, portal tokens
├── tenants/           tenant + industry-module management
├── users/             staff & customer accounts
├── contacts/          people (customers, tenants, applicants)
├── leads/             pipeline (new→contacted→booked→completed→lost)
├── conversations/     omnichannel threads + messages
├── jobs/              work items (service request / maintenance / case)
├── bookings/          calendar slots
├── documents/         invoices, quotes, forms, uploads
├── automation/        event bus + rule engine + action handlers
├── agents/            voice · chat · crm · dispatch · followup · document
└── integrations/      ports & adapters for external providers
```

Each module owns its controller (REST), service (business logic), and DTOs.
Cross-module communication is **event-first** (see §6) to keep agents decoupled.

## 6. Event-driven core

Everything interesting in the product is a domain event:

```
lead.created · lead.stage_changed · call.missed · call.completed
message.received · booking.requested · job.assigned · job.completed
document.generated · payment.succeeded
```

Agents and the automation engine are **producers and consumers** of these events
on a shared bus. The bus is an in-process emitter for low-latency reactions plus
a BullMQ queue for anything that touches the network or must be retried. This is
what lets "missed call → SMS in 10s → lead created → follow-up scheduled" happen
without a single human. Full design in
[AUTOMATION-ENGINE.md](AUTOMATION-ENGINE.md).

## 7. The six agents

Voice, Chat, CRM, Dispatch, Follow-up, Document — each a NestJS service
implementing a common `Agent` contract. They never call each other directly;
they react to events and emit new ones. Full design in [AGENTS.md](AGENTS.md).

## 8. Integrations — ports & adapters

The core depends only on **ports** (interfaces): `VoicePort`, `SmsPort`,
`EmailPort`, `CalendarPort`, `PaymentPort`, `LlmPort`. Concrete **adapters**
(Vapi, Twilio, SendGrid, Google Calendar, Stripe, Anthropic) are bound at module
config time and selected per-tenant from the `Integration` table. Swapping Vapi
for Retell is a one-line provider change, not a refactor. See
[INTEGRATIONS.md](INTEGRATIONS.md).

## 9. Frontend

Next.js App Router with three route groups sharing one component library:

- `(owner)` — pipeline board, agent activity feed, automation builder, settings
- `(staff)` — today's jobs, schedule, customer contact, status updates
- `(customer)` — booking, conversation history, documents, payments

The frontend reads the tenant's **Industry Module Config** from
`GET /config/module` and renders labels/columns/forms from it — the same React
code shows "Service Request" for an HVAC tenant and "Case" for an immigration
firm.

## 10. Scaling & operations

| Concern | Approach |
|---|---|
| Horizontal scale | Stateless API + N workers behind a queue; scale each independently |
| Hot tenants | Per-tenant queue concurrency caps; noisy-neighbor isolation |
| Idempotency | Webhook + action handlers keyed on provider event id (`EventLog`) |
| Observability | Structured logs w/ `tenantId`+`traceId`, `EventLog` + `AuditLog` tables |
| Secrets | Per-tenant integration creds AES-256-GCM encrypted at rest |
| Deploy | Single Docker image, two entrypoints (`main.js` / `worker.js`); Postgres + Redis managed |
| Zero-downtime | Expand/contract migrations; BullMQ drains in-flight jobs on SIGTERM |
