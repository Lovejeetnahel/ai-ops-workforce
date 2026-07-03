# AI Operations Workforce System

A multi-tenant SaaS platform of cooperating AI agents that replace the
**receptionist, dispatcher, admin assistant, and sales follow-up** roles for
small and medium businesses.

One unified architecture, configured per industry — not three separate apps.

| Industry module | Replaces | Example tenants |
|---|---|---|
| **Field Services** | Receptionist + dispatcher | HVAC, plumbing, electrical, roofing |
| **Property & Facility Mgmt** | Admin + maintenance coordinator | Property managers, HOAs, facilities |
| **Service Agencies** | Intake + case admin + follow-up | Immigration, staffing, marketing, accounting |

---

## The big idea

The data model and engines are **industry-agnostic**. A single field —
`Tenant.industryModule` — selects an **Industry Module Config** (`packages/config`)
that supplies the vocabulary, pipeline stages, intake fields, document templates,
and automation presets for that vertical. Switching a tenant's module re-skins
the entire product without code changes.

```
                          ┌─────────────────────────────┐
                          │   Industry Module Config     │  packages/config
                          │  labels · pipeline · intake  │
                          │  templates · automations     │
                          └──────────────┬──────────────┘
                                         │ drives
   ┌──────────┐   events   ┌─────────────▼─────────────┐   tools   ┌────────────┐
   │  Voice   │──────────▶ │     Automation Engine     │ ────────▶ │ Integrations│
   │  Chat    │            │  event bus · rule engine  │           │ Twilio·Vapi │
   │  CRM     │ ◀────────  │  (BullMQ async workers)   │ ◀──────── │ SendGrid·GCal│
   │ Dispatch │   triggers └─────────────┬─────────────┘           │ Stripe      │
   │ Follow-up│                          │ reads/writes            └────────────┘
   │ Document │            ┌─────────────▼─────────────┐
   └──────────┘            │  PostgreSQL (multi-tenant)│  Prisma
       agents              └───────────────────────────┘
```

---

## Monorepo layout

```
ai-ops-workforce/
├── apps/
│   ├── api/                 NestJS API — agents, automation, tenancy, REST
│   └── web/                 Next.js dashboard — owner / staff / customer views
├── packages/
│   ├── config/              Industry Module Config engine (the core abstraction)
│   └── shared/              Shared DTOs, enums, zod schemas
├── docs/                    Architecture, schema, automation, modules, integrations
├── docker-compose.yml       Local stack: postgres, redis, api, web
└── .env.example
```

## Quickstart (local)

```bash
# 1. clone + install (pnpm workspaces)
pnpm install

# 2. boot infra (postgres + redis)
docker compose up -d postgres redis
cp .env.example .env

# 3. migrate + seed three demo tenants (one per industry)
pnpm --filter @aiow/api prisma migrate dev
pnpm --filter @aiow/api prisma db seed

# 4. run API + web
pnpm dev            # turbo runs api (:4000) and web (:3000)
```

Or run the whole stack in containers:

```bash
docker compose up --build
```

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, multi-tenancy, RBAC, scaling |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema design + entity rationale |
| [docs/INDUSTRY-MODULES.md](docs/INDUSTRY-MODULES.md) | How the modular config system works |
| [docs/AGENTS.md](docs/AGENTS.md) | The six AI agents and how they cooperate |
| [docs/AUTOMATION-ENGINE.md](docs/AUTOMATION-ENGINE.md) | Event-driven workflow engine |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Voice / SMS / email / calendar / payment adapters |
| [docs/V2-ARCHITECTURE.md](docs/V2-ARCHITECTURE.md) | **AI Business OS upgrade** — Business Brain, memory, RAG, phased roadmap |

## Status of this scaffold

This is a **production-grade foundation**, not a demo. The architecture,
data model, multi-tenancy, RBAC, industry-module engine, automation engine,
and agent/integration contracts are real and runnable. Integration adapters
(Vapi, Twilio, SendGrid, Google Calendar, Stripe) ship as typed interfaces with
one reference implementation each and clearly-marked stubs where you drop in
provider credentials. See each `*.adapter.ts` for the seams.
