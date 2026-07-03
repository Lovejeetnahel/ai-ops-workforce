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
