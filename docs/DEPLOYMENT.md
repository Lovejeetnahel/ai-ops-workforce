# Deployment

Single Docker image for the backend with **two entrypoints** (API + worker),
plus the Next.js frontend. Portable to Railway, Render, Fly.io, AWS ECS, or a
plain VPS — anything that runs containers + managed Postgres + Redis.

## Topology

```
            ┌─────────────┐     ┌─────────────┐
  internet ─┤  web (Next) ├─────┤  api (Nest) ├──┐
            └─────────────┘     └─────────────┘  │
                                       │ enqueue  │ read/write
                                ┌──────▼──────┐   │
                                │   Redis     │   │
                                └──────┬──────┘   │
                                ┌──────▼──────┐ ┌─▼──────────┐
                                │   worker    │ │ PostgreSQL │
                                └─────────────┘ └────────────┘
```

- **api** and **worker** are the *same image*; compose overrides the worker's
  command to `node dist/worker.js`. Scale them independently.
- **Stateless** — scale `api`/`worker` horizontally behind the queue.

## Local

```bash
cp .env.example .env
docker compose up --build           # postgres, redis, api, worker, web
# api → http://localhost:4000   web → http://localhost:3000
```

## Production domains (sofilic.com, live)

Public traffic terminates at **Caddy on the host** (ports 80/443); every
container port is bound to `127.0.0.1` only, so Postgres, Redis, the API and
the web app are unreachable from the internet except through the proxy:

| Domain | Caddy upstream |
|---|---|
| `https://sofilic.com` | `127.0.0.1:3000` (web) |
| `https://www.sofilic.com` | redirect → `https://sofilic.com` |
| `https://api.sofilic.com` | `127.0.0.1:4000` (api) |

Required domain-related env in the server's `.env` (real variable names —
nothing else configures domains):

```bash
NODE_ENV=production
WEB_PUBLIC_API_URL=https://api.sofilic.com                  # baked into the web bundle at BUILD time
CORS_ORIGINS=https://sofilic.com,https://www.sofilic.com    # strict allowlist, never "*"
```

⚠️ `WEB_PUBLIC_API_URL` is inlined into the client JavaScript during
`docker compose build web` (Next.js `env` config). Changing it requires a
**rebuild** of the web image, not just a restart. The API also refuses to boot
in production without `CORS_ORIGINS`, `JWT_SECRET` (32+ chars),
`CREDENTIALS_ENCRYPTION_KEY` (64 hex), `DATABASE_URL`, `REDIS_URL`.

Auth is Bearer-token (Authorization header) — there are no cross-domain
cookies and no OAuth callback URLs to configure.

## Production checklist

| Step | Notes |
|---|---|
| Set real secrets | `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` (32-byte hex from a KMS), `ANTHROPIC_API_KEY` |
| Managed Postgres | point `DATABASE_URL`; run `prisma migrate deploy` (api container does this on boot) |
| Managed Redis | point `REDIS_URL` (Upstash/Elasticache) |
| Object storage | wire `Document.url` to S3/R2 for rendered PDFs |
| Scale workers | raise replicas + BullMQ concurrency for outbound throughput |
| TLS / domains | terminate at the platform LB; set `WEB_PUBLIC_API_URL` to the public API URL |
| Observability | ship structured logs (tenantId+traceId) to your log sink; alert on `EventLog.status=FAILED` |
| Backups | Postgres PITR; the encryption key must be backed up separately from the DB |

## Managed-services variant (fastest live SaaS)

- **web** → Vercel (`output: standalone` already set)
- **api + worker** → Railway/Render containers
- **Postgres** → Neon/Supabase · **Redis** → Upstash

## Zero-downtime migrations

Use expand/contract: deploy additive migrations first, then the code that uses
them, then remove old columns in a later release. `prisma migrate deploy` is
forward-only and safe to run on every boot.

### ⚠️ `prisma migrate dev` will try to drop the pgvector HNSW indexes — always review the diff

The two HNSW vector indexes (`KnowledgeChunk_embedding_hnsw_idx`,
`EntityMemory_embedding_hnsw_idx`, added in `20260702000001_pgvector_indexes`)
were created with raw SQL (`USING hnsw (...)`) because Prisma's schema DSL has
no way to express an HNSW index. Prisma's schema-diffing engine can't see
them, so it considers them drift and **every subsequent `prisma migrate dev`
run against this schema will auto-generate a migration that includes**:

```sql
-- DropIndex
DROP INDEX "EntityMemory_embedding_hnsw_idx";
-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_hnsw_idx";
```

This has happened twice already (Website Release 1's `add_public_contact_submission`
migration, and its follow-up `add_contact_submission_status` migration) — both
times caught and hand-fixed before commit by deleting those two lines from the
generated `migration.sql`, since they're not part of the actual intended
change.

**Before committing any `prisma migrate dev` output on this schema:** open the
generated `migration.sql` and delete any `DROP INDEX` lines referencing
`*_hnsw_idx` — they are never intentional. After fixing the file, verify with:

```bash
DATABASE_URL=... pnpm exec prisma migrate reset --force --skip-seed   # replay from scratch
DATABASE_URL=... pnpm exec prisma migrate deploy                      # the exact production command
psql -c "select indexname from pg_indexes where indexname like '%hnsw%';"  # expect 2 rows
```
