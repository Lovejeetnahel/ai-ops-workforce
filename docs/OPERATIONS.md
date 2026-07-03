# Operations Manual (V1.0)

## Topology
Stateless **api** + **worker** (same image, different entrypoint) + **web**, behind
managed **Postgres 16 (pgvector)** and **Redis**. Scale each independently.

## Deploy
- **Containers:** `docker compose up --build` (local) or the images built by
  `.github/workflows/release.yml` on a `v*` tag.
- **Kubernetes:** `kubectl apply -f deploy/k8s/aiow.yaml` (Deployments + HPA +
  Ingress + Secret template). Set real values in `aiow-secrets`.
- **Infra:** `deploy/terraform/main.tf` provisions Postgres/Redis/S3/secrets.
- **Migrations:** the api image runs `prisma migrate deploy` on boot; or run
  `pnpm --filter @aiow/api prisma migrate deploy` in a job. After first deploy,
  create the pgvector index once:
  `CREATE INDEX ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);`

## Health & monitoring
- Liveness: `GET /api/ops/live` · Readiness: `GET /api/ops/ready` (checks DB).
- Metrics: `GET /api/ops/metrics` (business counts, AI activity, **BullMQ queue
  depth**). Wire to your metrics stack; alert on `queue.failed` and
  `EventLog.status = FAILED`.
- Logs are structured with `tenantId`; ship to your log sink.

## Scaling
- API: HPA on CPU (3→20). Worker: scale replicas with queue depth.
- Per-tenant queue concurrency caps prevent noisy-neighbor starvation.
- Rate limiting on `/v1` is per-instance in-memory today — back with Redis
  (`INCR`+`EXPIRE`) for multi-node correctness; window logic is unchanged.

## Backups & DR
- Postgres PITR (14-day retention recommended) + nightly snapshots.
- **The `CREDENTIALS_ENCRYPTION_KEY` must be backed up separately from the DB**
  (it decrypts per-tenant integration credentials). Losing it = unrecoverable
  integration secrets.
- Redis is a cache/queue; on loss, in-flight automations may need replay.

## Runbook (common)
- *Queue backing up:* scale `worker`; inspect `GET /ops/metrics` → `queue`.
- *Outbound comms failing:* adapters log `[stub]` when keys are missing; check
  the tenant `Integration` row and provider status.
- *Decisions stuck OPEN:* the sweeper marks past-deadline decisions MISSED on the
  next event tick; confirm the worker is consuming.
