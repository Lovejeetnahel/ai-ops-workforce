# Database Design

PostgreSQL via Prisma. Shared schema, multi-tenant by `tenantId` discriminator.
Full schema: [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).

## Design principles

1. **Industry-agnostic core.** There are no `hvac_jobs` / `immigration_cases`
   tables. Verticals share generic `Lead`, `Job`, `Document` tables; the
   `entityType` string column ties each row to the module's vocabulary
   (`service_request`, `maintenance_request`, `case`). Vertical-specific facts
   live in `Json` columns (`Lead.intake`, `Job.metadata`, `Contact.attributes`)
   so we never migrate the schema to onboard a new vertical.
2. **Every tenant row carries `tenantId`** and is indexed on it. The Prisma
   client extension injects it automatically (see ARCHITECTURE §3).
3. **Generic enums + config labels.** `LeadStage` and `JobStatus` are fixed
   enums; the *display* of each stage is supplied by the module config. This
   keeps pipeline analytics uniform across tenants while the UI looks bespoke.
4. **Events are first-class.** `EventLog` is both the observability trail and the
   idempotency ledger (`@@unique([tenantId, source, externalId])`).

## Entity map

```
Tenant 1───* User
Tenant 1───* Contact 1───* Lead *───1 (assignedTo) User
                   │            └──* Conversation 1───* Message
                   │            └──* Job 1───* Booking
                   │                   └──* Document *───* Payment
                   └──* Conversation
Tenant 1───* AutomationRule
Tenant 1───* Integration   (per-provider creds, encrypted)
Tenant 1───* EventLog / AuditLog
```

## Why these tables (mapped to the spec)

| Spec entity | Table | Notes |
|---|---|---|
| Users | `User` | Owner/Admin/Staff **and** authenticated Customers (via `contactId`) |
| Businesses (tenants) | `Tenant` | `industryModule` selects the whole product config |
| Leads | `Lead` | Generic pipeline; `entityType` + `intake` JSON for vertical shape |
| Conversations | `Conversation` + `Message` | Omnichannel, `externalRef` to provider thread |
| Jobs / Tasks | `Job` | Technician job / contractor job / case — all one table |
| Bookings | `Booking` | Two-way calendar sync via `calendarEventId` |
| Messages | `Message` | `author` = which agent/human/contact |
| Documents | `Document` | Invoice/quote/form/contract, `templateKey` records origin |
| Payments (future) | `Payment` | Stripe `externalRef`; optional per the spec |

## Indexing highlights

- `Lead(tenantId, stage)` — pipeline board queries.
- `Job(tenantId, assignedToId, scheduledStart)` — a tech's day.
- `Booking(assignedToId, start)` — conflict detection during dispatch.
- `Conversation(externalRef)` — match inbound provider webhooks to a thread.
- `EventLog(tenantId, source, externalId)` UNIQUE — webhook idempotency.

## Isolation upgrade path

Shared-schema is the default. For a regulated tenant (immigration/legal) you can:
1. Turn on **Postgres RLS** with a policy on `current_setting('app.tenant_id')`
   (the middleware already establishes the tenant per request), or
2. Promote that tenant to its **own schema/database** — the repository layer is
   already tenant-parameterized, so only the connection resolver changes.

## Migrations

```bash
pnpm --filter @aiow/api prisma migrate dev      # author + apply locally
pnpm --filter @aiow/api prisma migrate deploy   # CI / production
pnpm --filter @aiow/api prisma db seed           # three demo tenants
```
