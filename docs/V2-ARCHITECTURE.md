# V2 — AI Business Operating System (Upgrade Architecture)

> This is an **evolution of the existing scaffold, not a rewrite.** Every new
> system is additive and plugs into the layers we already have (EventBus,
> multi-tenancy, agents, automation, industry modules).

The product is repositioned from "automation platform" to a **digital AI
workforce** that replaces receptionist, dispatcher, admin, and follow-up roles.
The non-negotiable flow:

```
User Input (call / SMS / web / form)
        ↓
   EventBus            ← already exists
        ↓
   AI Brain            ← NEW core layer (context + decisions, RAG + memory)
        ↓
   AI Agents           ← already exist (voice/chat/crm/dispatch/followup/document)
        ↓
   Business Memory     ← NEW (vector + structured history) + existing DB
        ↓
   Actions             ← already exist (book/assign/notify/generate/update)
```

---

## 1. What already exists (audited from the codebase)

| Capability | Where | Status |
|---|---|---|
| Multi-tenant isolation | `common/tenancy/*`, tenant-scoped Prisma extension | ✅ Solid |
| RBAC (OWNER/ADMIN/STAFF/CUSTOMER) | `common/rbac/*` | ✅ |
| EventBus (in-proc + BullMQ, idempotent) | `automation/event-bus.ts` | ✅ Strong backbone |
| Automation engine (triggers→conditions→actions, WAIT) | `automation/*` | ✅ |
| 6 agents on a shared `Agent` contract | `agents/*` | ✅ but **prompts are static personas** |
| Industry Module config | `packages/config` | ✅ Exactly the extensibility model V2 needs |
| Integrations ports & adapters | `integrations/*` | ✅ Clean seam for new providers |
| Data model | `prisma/schema.prisma` | ✅ Generic, but **no knowledge/memory/embeddings** |
| Frontend (owner/staff/customer shells) | `apps/web` | ✅ Minimal, ready to extend |
| Audit log / EventLog | schema | ✅ Reusable for "automation history" |

**Key insight:** the EventBus, the tenant-scoped Prisma layer, and the
industry-config pattern are exactly the primitives an AI-OS needs. We are not
missing foundations — we are missing a **brain** that sits on top of them.

## 2. Mapping the V2 requirements onto the current architecture

| V2 system | Built on top of | New code needed |
|---|---|---|
| **Business Brain** | Prisma + new pgvector store + `EmbeddingPort` | `brain/` module (NEW) |
| **AI Memory** | Brain (entity memory) + existing Contact/User/Job | `brain/memory.service.ts` (NEW) |
| **AI Assistant (NL control)** | Brain + a tool-calling layer over existing services | `assistant/` module (later) |
| **AI Executive Dashboard** | Existing data + Brain summarization | `insights/` module (later) |
| **NL Workflow Builder** | Existing automation engine (it already runs JSON rules) | LLM→rule compiler (later) |
| **Customer AI Portal** | Existing `(customer)` routes + Brain (PUBLIC knowledge) | extend web (later) |
| **Employee AI Copilot** | Existing staff routes + Brain (employee memory) | extend web (later) |
| **Predictive Analytics** | Existing job/lead/payment history | `analytics/` workers (later) |
| **Plugin / Marketplace** | EventBus + a manifest + SDK | `platform/plugins` (later) |
| **AI Agent Marketplace** | Existing `AgentRegistry` + Brain | registry → installable agents (later) |
| **Industry expansion** | Existing `packages/config` (already config-only!) | just add config files |
| **Public API / SDK / OAuth** | Existing REST + API keys + versioning | `/api/v1` namespace + keys (later) |

The single most leveraged addition is the **Business Brain**: it is the shared
dependency for the Assistant, Dashboard, Copilot, Portal, and every agent. Build
it first; everything else consumes it.

## 3. Gap analysis (what's genuinely missing)

1. **No knowledge layer.** Services/pricing/SOPs/FAQs/contracts live nowhere
   retrievable. Agents can't ground answers.
2. **No vector search / RAG.** Postgres has no embeddings; no semantic retrieval.
3. **No persistent entity memory.** Contacts/Users hold facts but nothing
   captures *preferences, summaries, performance, communication style* that the
   AI should personalize on.
4. **Prompts are hardcoded personas.** `config.agentPersona` is static; the rule
   "no prompt without Brain context" is not yet enforceable.
5. **No NL→action or NL→workflow compiler.** The automation engine executes
   rules but nothing authors them from language yet.
6. **No insight/forecasting layer.** Analytics today would be raw CRUD.
7. **No plugin manifest/SDK or API-key auth** for third parties.

## 4. Upgrade plan — phased, additive, non-breaking

Each phase ships independently, preserves multi-tenancy + EventBus, and adds
**new modules** rather than editing core flows.

| Phase | Increment | Delivers | Touches |
|---|---|---|---|
| **P1 (this PR)** | **Business Brain + Memory core** | Knowledge store, chunking, embeddings (pgvector), RAG retrieval, entity memory, brain-context composer, one agent wired as reference | NEW `brain/`; additive schema; 1 adapter; safe edit to chat agent |
| P2 | Agent grounding rollout | All 6 agents pull persona **+ Brain context + memory**; memory write-back on every conversation/job event | agents (additive) |
| P3 | AI Assistant (internal NL control) | `assistant/` module: LLM tool-calling over existing services ("show delayed jobs", "book tomorrow 2pm") | NEW `assistant/`, tool registry |
| P4 | NL Workflow Builder | LLM compiles language → `AutomationRule` JSON (reuses today's engine), with preview/confirm | NEW compiler in `automation/` |
| P5 | AI Executive Dashboard / Insights | Scheduled insight jobs → narrative + recommendations from real data + Brain | NEW `insights/` worker |
| P6 | Predictive analytics | Forecasting/churn/anomaly jobs writing to an `Insight`/`Forecast` table | NEW `analytics/` |
| P7 | Customer Portal + Employee Copilot UI | Web surfaces over Brain (PUBLIC vs INTERNAL knowledge) | `apps/web` |
| P8 | Plugin SDK + Marketplace + API keys + `/api/v1` | Manifest, EventBus-only plugin contract, developer SDK, OAuth/API keys, rate limiting | NEW `platform/` |
| P9 | Agent Marketplace | Installable AI employees via `AgentRegistry` sharing Brain/Memory | registry extension |
| ongoing | Industry expansion | New verticals = **one config file each** (already supported) | `packages/config` only |

### Architectural decisions (made as CTO, reversible by design)

- **Vector store = pgvector inside the existing Postgres**, behind a
  `VectorStorePort`. Rationale: zero new infra, inherits tenant isolation and
  backups; swap to Pinecone/Qdrant later by writing one adapter. Not a lock-in.
- **Embeddings = Voyage AI** (`voyage-3`, 1024-dim — Anthropic's recommended
  embeddings) behind an `EmbeddingPort`, with an offline deterministic stub so
  dev/CI run without keys. Swap to any model via the port.
- **Brain is a "pull" service, not a router.** Agents *retrieve* context from the
  Brain (RAG + memory) when composing prompts. This satisfies "AI Brain between
  EventBus and Agents" without inserting a fragile central dispatcher; the Brain
  can later gain an orchestrator for multi-agent planning (P9) without changing
  agent contracts.
- **Knowledge has permissions + versions.** `visibility` (PUBLIC/INTERNAL/
  RESTRICTED) gates portal vs staff vs owner retrieval; `version`/`supersededById`
  give history. RAG queries filter by requester role.
- **Tenant safety on raw vector SQL.** pgvector similarity uses `$queryRaw`, which
  **bypasses** the tenant-scoped Prisma extension — so every Brain query injects
  `tenantId` explicitly from `tenantContext`. This is enforced in
  `business-brain.service.ts` and called out in code.

---

## Business Brain — P1 design (implemented in this PR)

```
                 ┌────────────────────────────────────────────┐
 agents ────────▶│            BrainContextService              │
 assistant ─────▶│  composeAgentContext({ persona, query,      │
 portal ────────▶│     subject, role })                        │
                 │   = business profile + RAG snippets         │
                 │     + entity memory, permission-filtered    │
                 └───────┬───────────────────────┬─────────────┘
                         │ retrieve              │ recall
                 ┌───────▼────────┐      ┌───────▼─────────┐
                 │ KnowledgeService│      │  MemoryService  │
                 │ ingest+chunk+   │      │ record/recall   │
                 │ embed, search   │      │ customer & emp  │
                 └───────┬────────┘      └───────┬─────────┘
                         │                        │
                 ┌───────▼────────────────────────▼─────────┐
                 │ Postgres + pgvector (tenant-scoped)       │
                 │ KnowledgeDoc · KnowledgeChunk · EntityMemory│
                 └────────────────────────────────────────────┘
                         ▲ EmbeddingPort (Voyage / stub)
```

### Public surface (P1)

```
POST   /api/brain/knowledge        ingest a doc (service/pricing/SOP/FAQ/...)
GET    /api/brain/knowledge        list (role-filtered)
DELETE /api/brain/knowledge/:id    soft-version a doc
POST   /api/brain/search           semantic search { query, types?, topK? }
POST   /api/brain/memory           record an EntityMemory (customer/employee)
GET    /api/brain/memory/:type/:id recall memory for a subject
GET    /api/brain/context          debug: see the composed agent context
```

### How agents consume it (the rule, enforced)

Before: `system = config.agentPersona`.
After: `system = await brainContext.composeAgentContext({ persona, tenantId, query, subjectId })`
→ persona **+ business profile + top-K knowledge + subject memory**. If the Brain
is empty or unreachable, it degrades gracefully to the persona (non-breaking).

### Migration / infra notes

- `docker-compose.yml` postgres image → `pgvector/pgvector:pg16` (drop-in).
- Schema enables the `vector` extension via Prisma `postgresqlExtensions`.
- After `prisma migrate dev`, create the ANN index once (HNSW):
  `CREATE INDEX ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);`
  (documented in the migration; safe to add when row counts grow).
