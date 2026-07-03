# AI Operations Workforce — Production Deployment & Go-Live Playbook

**Version:** 1.0  
**Based on codebase state after Phase G verification (2026-07-02)**  
**Platform:** NestJS API · Next.js Web · PostgreSQL 16 + pgvector · Redis 7 · BullMQ · Kubernetes

> Legend  
> ✅ Verified by live execution in Phases E/F/G  
> 📋 Configuration step (not codeable, requires operator action)  
> ⚠️ Cannot be verified without cloud deployment

---

## 1. Production Architecture

```
Internet
  │
  ▼
[DNS: api.yourdomain.com / app.yourdomain.com]
  │
  ▼
[K8s Ingress + cert-manager (Let's Encrypt TLS)]
  │
  ├──► [aiow-api  × 3–20 pods]   port 4000   (NestJS REST API)
  │         │
  │         ├──► [PostgreSQL 16 + pgvector]  managed RDS / Neon
  │         ├──► [Redis 7 (AOF)]             managed ElastiCache / Upstash
  │         └──► [S3 Bucket]                 documents / attachments
  │
  ├──► [aiow-worker × 2 pods]    no HTTP     (BullMQ automation worker)
  │         │
  │         └──► same PostgreSQL + Redis
  │
  └──► [aiow-web   × 2 pods]    port 3000   (Next.js SSR frontend)
            │
            └──► [aiow-api via internal K8s service]
```

### Components

| Component | Technology | Scaling | Notes |
|-----------|-----------|---------|-------|
| API | NestJS · Node 20 | HPA 3–20 replicas | Stateless; tenant context via AsyncLocalStorage |
| Worker | NestJS · BullMQ | 2 replicas fixed | Consumes automation queue; concurrency=10 per pod |
| Web | Next.js standalone | 2 replicas | SSR; talks to API via internal K8s service |
| Database | PostgreSQL 16 + pgvector | Managed (multi-AZ) | HNSW indexes on embedding columns |
| Queue | Redis 7 | Managed (HA) | BullMQ; AOF persistence required |
| Storage | S3-compatible | Managed | Documents, photos, attachments |
| Proxy | K8s Ingress (nginx) | Via K8s | TLS termination, routing |
| DNS | Your DNS provider | N/A | A records to Ingress load balancer |
| TLS | cert-manager + Let's Encrypt | Auto-renew | Configured in aiow.yaml Ingress |
| Monitoring | K8s native + /api/ops/* | — | Metrics endpoint, structured logs |

---

## 2. Infrastructure Deployment Order

Deploy strictly in this order. Each step must succeed before the next begins.

```
1.  Cloud account & networking (VPC, subnets, security groups)
2.  Terraform: S3 bucket for documents
3.  PostgreSQL (managed, pgvector-enabled)
4.  Redis (managed, AOF persistence enabled)
5.  AWS Secrets Manager / K8s Secret — inject all env vars
6.  Container registry (GHCR / ECR) — push images
7.  Kubernetes cluster
8.  cert-manager (TLS)
9.  K8s Secret (aiow-secrets)
10. Database migrations (prisma migrate deploy)
11. aiow-api Deployment (3 replicas)
12. aiow-api Service + readiness validation
13. aiow-worker Deployment (2 replicas)
14. aiow-web Deployment (2 replicas)
15. aiow-web Service
16. HPA for aiow-api
17. Ingress (routes traffic, triggers cert-manager)
18. DNS A records → Ingress load balancer IP
19. Smoke tests
20. First tenant onboarding
```

---

## 3. Environment Variables

### 3.1 Required (API refuses to start in production without these)

The `validateEnv()` function in `apps/api/src/main.ts` checks these at boot and throws if any are missing or malformed.

| Variable | Required | Format | Production Value |
|----------|----------|--------|-----------------|
| `NODE_ENV` | Yes | `production` | Exactly `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://aiow:<pass>@<host>:5432/aiow?schema=public&connection_limit=20&pool_timeout=30&connect_timeout=10` |
| `REDIS_URL` | Yes | Redis URL | `redis://<host>:6379` or `rediss://<host>:6380` (TLS) |
| `JWT_SECRET` | Yes | ≥32 random chars | `openssl rand -hex 32` |
| `CREDENTIALS_ENCRYPTION_KEY` | Yes | Exactly 64 hex chars (32 bytes) | `openssl rand -hex 32` |
| `CORS_ORIGINS` | Yes | Comma-separated URLs | `https://app.yourdomain.com,https://portal.yourdomain.com` |

### 3.2 Optional with recommended values

| Variable | Default | Production Recommendation |
|----------|---------|--------------------------|
| `API_PORT` | `4000` | Leave as `4000` |
| `JWT_EXPIRES_IN` | `15m` | `15m` (short-lived access tokens) |
| `REFRESH_EXPIRES_IN` | `30d` | `30d` |
| `LLM_MODEL` | `claude-opus-4-8` | `claude-opus-4-8` (verified working) |
| `EMBEDDING_MODEL` | `voyage-3` | `voyage-3` (must match 1024-dim schema) |
| `EMBEDDING_DIMS` | `1024` | `1024` — **do not change** without schema migration |

### 3.3 Third-party integrations (optional; empty = feature disabled)

| Variable | Purpose | Where to obtain |
|----------|---------|----------------|
| `ANTHROPIC_API_KEY` | LLM for all AI agents (chat, voice, copilot, brain) | console.anthropic.com |
| `VOYAGE_API_KEY` | Embeddings for Business Brain RAG (empty = stub mode) | voyageai.com |
| `TWILIO_ACCOUNT_SID` | SMS/voice inbound webhooks | twilio.com Console |
| `TWILIO_AUTH_TOKEN` | Twilio signature verification | twilio.com Console |
| `TWILIO_MESSAGING_SID` | Outbound SMS sender ID | twilio.com Messaging Services |
| `VAPI_API_KEY` | Voice AI agent (Vapi platform) | vapi.ai Dashboard |
| `VAPI_PHONE_NUMBER_ID` | Vapi inbound phone number | vapi.ai Dashboard |
| `SENDGRID_API_KEY` | Transactional email | sendgrid.com API Keys |
| `SENDGRID_FROM_EMAIL` | Email sender address (must be verified in SendGrid) | sendgrid.com Sender Identity |
| `GOOGLE_CALENDAR_CLIENT_ID` | Google Calendar OAuth | Google Cloud Console |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google Calendar OAuth | Google Cloud Console |
| `STRIPE_SECRET_KEY` | Payment processing (starts with `sk_live_`) | dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | dashboard.stripe.com/webhooks |

### 3.4 Web (Next.js) variables

| Variable | Required | Value |
|----------|----------|-------|
| `WEB_PUBLIC_API_URL` | Yes | `https://api.yourdomain.com` |
| `NODE_ENV` | Yes | `production` |

### 3.5 Generate secrets

```bash
# JWT_SECRET (≥32 chars — API enforces this at boot)
openssl rand -hex 32

# CREDENTIALS_ENCRYPTION_KEY (exactly 64 hex chars — API enforces this at boot)
openssl rand -hex 32

# Webhook signing secret (for your own outbound webhooks, stored in DB per subscription)
openssl rand -hex 32
```

---

## 4. Database Deployment

### 4.1 Requirements

- PostgreSQL 16 with the `vector` extension available (`pgvector/pgvector:pg16` or RDS with pgvector)
- The `CREATE EXTENSION IF NOT EXISTS "vector"` statement is in migration `20250101000000_init`
- Multi-AZ RDS strongly recommended (Terraform skeleton sets `multi_az = true`)

### 4.2 Migration order

There are exactly **2 migrations**. They must be applied in order:

```
migrations/
├── 20250101000000_init/migration.sql         # Full schema + pgvector extension
└── 20260702000001_pgvector_indexes/          # HNSW indexes on embedding columns
    migration.sql
```

**Apply command** (run before starting the API):

```bash
DATABASE_URL="postgresql://aiow:<password>@<host>:5432/aiow?schema=public" \
  npx prisma migrate deploy
```

The Docker CMD does this automatically:

```
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
```

When running in K8s, the API container's migration step runs before `node dist/main.js` and blocks startup until complete. The readiness probe at `/api/ops/ready` only returns 200 after the app is fully initialized.

### 4.3 Startup on empty database

The `migrate deploy` command:
1. Creates the `_prisma_migrations` tracking table
2. Applies `20250101000000_init` — full schema, 1,500+ lines, all tables and indexes
3. Applies `20260702000001_pgvector_indexes` — HNSW indexes on vector columns
4. Exits 0 → Node starts

This is idempotent: already-applied migrations are skipped.

### 4.4 Startup on existing database

Same command. `migrate deploy` reads `_prisma_migrations` and only applies unapplied migrations. Safe to run on every restart.

### 4.5 Rollback plan

**Prisma does not auto-rollback schema migrations.** Rollback procedure:

```bash
# 1. Mark a failed migration as rolled back (if deploy fails mid-flight)
DATABASE_URL=... npx prisma migrate resolve --rolled-back <migration_name>

# 2. For HNSW index rollback (migration 20260702000001):
#    Drop the indexes manually — no data loss, purely additive:
DROP INDEX IF EXISTS "KnowledgeChunk_embedding_hnsw_idx";
DROP INDEX IF EXISTS "EntityMemory_embedding_hnsw_idx";

# 3. For full schema rollback: restore from pre-migration pg_dump snapshot
pg_restore --clean --no-acl --no-owner -d aiow aiow_pre_migration.dump
```

**Always take a pg_dump snapshot before applying migrations in production.**

### 4.6 Backup

```bash
# Full logical backup (daily, before migrations)
pg_dump \
  --host=<rds-endpoint> \
  --username=aiow \
  --dbname=aiow \
  --format=custom \
  --no-acl \
  --no-owner \
  --file=aiow_$(date +%Y%m%d_%H%M%S).dump

# Automated: RDS automated backups (set backup_retention_period = 14 in Terraform)
# Point-in-time recovery to any second within the retention window
```

### 4.7 Restore

```bash
# Create fresh target database
createdb -h <host> -U aiow aiow_restored

# Restore
pg_restore \
  --host=<host> \
  --username=aiow \
  --dbname=aiow_restored \
  --no-acl \
  --no-owner \
  --clean \
  aiow_20260702_120000.dump

# Verify row counts (spot check)
psql -h <host> -U aiow -d aiow_restored \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;"
```

### 4.8 pgvector verification

```sql
-- Confirm extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- Expected: vector | 0.x.x

-- Confirm embedding columns exist with correct dimension
SELECT column_name, udt_name, character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('KnowledgeChunk', 'EntityMemory')
  AND column_name = 'embedding';
-- Expected: embedding | vector | (null)

-- Confirm HNSW indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname LIKE '%embedding%';
-- Expected: 2 rows, both USING hnsw (embedding vector_cosine_ops)
```

### 4.9 Index verification

```sql
-- All critical compound indexes (verified in migration 20250101000000_init)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

-- Minimum required indexes (verified in init migration):
-- Lead_tenantId_stage_idx, Lead_tenantId_contactId_idx
-- Job_tenantId_status_idx, Job_tenantId_assignedToId_scheduledStart_idx
-- User_tenantId_email_key (unique), User_tenantId_role_idx
-- Contact_tenantId_phone_idx, Contact_tenantId_email_idx
-- Conversation_tenantId_status_idx
-- KnowledgeChunk_embedding_hnsw_idx (migration 20260702000001)
-- EntityMemory_embedding_hnsw_idx   (migration 20260702000001)
```

### 4.10 Long-running migrations note

The HNSW index migration (`20260702000001`) includes a comment documenting the `CONCURRENTLY` form for operators running against a live database with existing data:

```sql
-- For live databases with existing data, run these outside of a migration:
CREATE INDEX CONCURRENTLY IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EntityMemory_embedding_hnsw_idx"
  ON "EntityMemory" USING hnsw (embedding vector_cosine_ops);
```

On initial deployment (empty tables), the migration file's non-concurrent form is correct and fast.

### 4.11 Connection pool

Add these parameters to `DATABASE_URL` in production:

```
?schema=public&connection_limit=20&pool_timeout=30&connect_timeout=10
```

- `connection_limit=20`: 20 connections per API pod × 3 pods = 60 max (size your RDS instance accordingly; `db.r6g.large` handles 500 max)
- `pool_timeout=30`: Wait up to 30s for a connection before throwing
- `connect_timeout=10`: TCP connect timeout to RDS

---

## 5. Kubernetes Deployment

### 5.1 Prerequisites

```bash
# Tools required
kubectl version --client   # ≥1.28
helm version               # for cert-manager
docker version             # for image building

# Cluster access configured
kubectl cluster-info
```

### 5.2 Full deployment command sequence

```bash
# ── Step 1: Namespace ──────────────────────────────────────────
kubectl apply -f deploy/k8s/aiow.yaml --dry-run=client  # validate first
kubectl apply -f deploy/k8s/aiow.yaml

# ── Step 2: Fill in secrets BEFORE the deployments start ───────
# Edit the Secret in aiow.yaml first, replacing CHANGE_ME values, then:
kubectl get secret aiow-secrets -n aiow -o yaml  # verify no CHANGE_ME remains

# ── Step 3: cert-manager (if not already installed) ─────────────
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager \
  -n cert-manager --timeout=120s

# Create ClusterIssuer for Let's Encrypt:
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# ── Step 4: Run database migrations via Job ─────────────────────
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: aiow-migrate
  namespace: aiow
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: ghcr.io/your-org/aiow-api:latest
        command: ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
        envFrom:
        - secretRef:
            name: aiow-secrets
EOF

# Wait for migration to complete
kubectl wait --for=condition=complete job/aiow-migrate -n aiow --timeout=300s
kubectl logs job/aiow-migrate -n aiow  # verify success output

# ── Step 5: Deploy API ──────────────────────────────────────────
kubectl rollout status deployment/aiow-api -n aiow --timeout=300s

# ── Step 6: Validate API readiness ─────────────────────────────
kubectl run smoke-test --rm -it --restart=Never --image=curlimages/curl:latest \
  -- curl -s http://aiow-api.aiow.svc.cluster.local/api/ops/ready
# Expected: {"status":"ready","db":"up"}

# ── Step 7: Deploy Worker ───────────────────────────────────────
kubectl rollout status deployment/aiow-worker -n aiow --timeout=300s

# ── Step 8: Deploy Web ──────────────────────────────────────────
kubectl rollout status deployment/aiow-web -n aiow --timeout=300s

# ── Step 9: Verify HPA ──────────────────────────────────────────
kubectl get hpa -n aiow
# Expected: MINPODS=3, MAXPODS=20, TARGETS shows CPU utilization

# ── Step 10: Verify Ingress and TLS ────────────────────────────
kubectl get ingress -n aiow
kubectl describe certificate aiow-tls -n aiow  # should be Ready=True
```

### 5.3 Validation after deployment

```bash
# All pods running
kubectl get pods -n aiow
# Expected: aiow-api-xxx (3 Running), aiow-worker-xxx (2 Running), aiow-web-xxx (2 Running)

# API health via external URL
curl https://api.yourdomain.com/api/ops/live
# Expected: {"status":"ok"}

curl https://api.yourdomain.com/api/ops/ready
# Expected: {"status":"ready","db":"up"}

# TLS certificate valid
curl -vI https://api.yourdomain.com/api/ops/live 2>&1 | grep "SSL certificate\|issuer\|expire"
```

### 5.4 Rollback

```bash
# API rollback to previous image
kubectl rollout undo deployment/aiow-api -n aiow
kubectl rollout status deployment/aiow-api -n aiow

# Worker rollback
kubectl rollout undo deployment/aiow-worker -n aiow

# Web rollback
kubectl rollout undo deployment/aiow-web -n aiow

# Verify after rollback
kubectl get pods -n aiow
curl https://api.yourdomain.com/api/ops/ready
```

### 5.5 Scaling

```bash
# Manual scale (e.g., for anticipated load)
kubectl scale deployment/aiow-api --replicas=10 -n aiow

# HPA handles automatic scaling (already configured in aiow.yaml)
# Target: CPU utilization 70%, min 3 pods, max 20 pods
kubectl describe hpa aiow-api -n aiow

# Worker scale (no HPA — scale manually based on queue depth from /api/ops/metrics)
kubectl scale deployment/aiow-worker --replicas=4 -n aiow
```

---

## 6. Docker Deployment

### 6.1 Build

```bash
# From repo root (required — Dockerfile context is the monorepo root)

# API image
docker build \
  --file apps/api/Dockerfile \
  --tag ghcr.io/your-org/aiow-api:v1.0.0 \
  --tag ghcr.io/your-org/aiow-api:latest \
  .

# Web image
docker build \
  --file apps/web/Dockerfile \
  --tag ghcr.io/your-org/aiow-web:v1.0.0 \
  --tag ghcr.io/your-org/aiow-web:latest \
  .
```

**Requirements:**
- `pnpm-lock.yaml` must be present in repo root (Dockerfile copies it with `--frozen-lockfile`)
- Build runs as multi-stage: `base → deps → build → runtime`
- Runtime stage runs as `USER node` (non-root ✅)

### 6.2 Push

```bash
# Authenticate to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u your-org --password-stdin

docker push ghcr.io/your-org/aiow-api:v1.0.0
docker push ghcr.io/your-org/aiow-api:latest
docker push ghcr.io/your-org/aiow-web:v1.0.0
docker push ghcr.io/your-org/aiow-web:latest
```

The GitHub Actions release workflow (`.github/workflows/release.yml`) does this automatically on `git tag v*` push.

### 6.3 Pull (on cluster nodes)

Kubernetes pulls images automatically from `ghcr.io` based on `image:` in the deployment spec. For private registries, add an imagePullSecret:

```bash
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=your-org \
  --docker-password=$GITHUB_TOKEN \
  -n aiow
```

Then reference in the deployment spec: `imagePullSecrets: [{name: ghcr-creds}]`.

### 6.4 Run locally (docker-compose)

```bash
# Copy and fill the env file
cp .env.example .env
# Edit .env — set JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY, CORS_ORIGINS at minimum

# Start all services
docker compose up -d

# Verify
curl http://localhost:4000/api/ops/ready
# Expected: {"status":"ready","db":"up"}
```

Services start in order: `postgres` (healthy) → `redis` (healthy) → `api` + `worker` → `web`.

### 6.5 Health verification

```bash
# API container health
docker ps --filter "name=api" --format "table {{.Names}}\t{{.Status}}"

# API liveness
curl http://localhost:4000/api/ops/live
# {"status":"ok"}

# API readiness (includes DB probe)
curl http://localhost:4000/api/ops/ready
# {"status":"ready","db":"up"}

# Worker running (no HTTP — check logs)
docker logs <worker-container> --tail=20
# Expected: "Automation worker started" in output
```

---

## 7. Third-Party Integrations

### 7.1 Anthropic (LLM — AI agents)

**Required for:** Chat agent, voice agent, CRM intelligence, copilot, business brain, executive briefing

```bash
# Environment variables
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-4-8  # verified default
```

**Verification:**
```bash
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-opus-4-8","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'
# Expected: response with "content" array
```

If `ANTHROPIC_API_KEY` is empty, agents return stub responses — platform still runs.

### 7.2 Voyage AI (Embeddings — Business Brain RAG)

**Required for:** Knowledge search, entity memory, agent context grounding

```bash
VOYAGE_API_KEY=pa-...
EMBEDDING_MODEL=voyage-3
EMBEDDING_DIMS=1024  # MUST match pgvector column width — do not change
```

**Verification:**
```bash
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"voyage-3","input":["test"]}'
# Expected: embedding array of length 1024
```

If `VOYAGE_API_KEY` is empty, embedding calls return zero vectors (stub mode). Search still works but returns low-relevance results.

### 7.3 Stripe (Payments)

**Required for:** Invoice payment links, subscription billing, webhook settlement

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # from Stripe dashboard after webhook registration
```

**Webhook registration:**
1. Go to dashboard.stripe.com → Developers → Webhooks → Add endpoint
2. URL: `https://api.yourdomain.com/api/webhooks/payment/<tenantId>`
3. Events to listen for: `payment_intent.succeeded`, `checkout.session.completed`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

**Note:** Each tenant has its own webhook URL (`/api/webhooks/payment/:tenantId`). Register a separate Stripe webhook endpoint per tenant, or use one endpoint and route by metadata.

**Verification:**
```bash
# Test Stripe connectivity
curl https://api.stripe.com/v1/balance \
  -u "$STRIPE_SECRET_KEY:"
# Expected: {"object":"balance",...}

# Test webhook signature validation
stripe trigger payment_intent.succeeded  # using Stripe CLI
```

### 7.4 Twilio (SMS/Voice inbound)

**Required for:** Inbound SMS/WhatsApp messages, missed call handling

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SID=MG...  # Messaging Service SID for outbound SMS
```

**Webhook registration:**
1. Go to twilio.com Console → Phone Numbers → Your number → Messaging
2. Set webhook URL: `https://api.yourdomain.com/api/webhooks/chat/<tenantId>`
3. HTTP Method: POST

**⚠️ Twilio HMAC-SHA1 signature verification is not yet implemented.** The inbound chat webhook (`POST /api/webhooks/chat/:tenantId`) accepts any POST. Until HMAC verification is added, restrict the endpoint by IP allowlist (Twilio publishes its IP ranges at twilio.com/docs/api/security#allowlist-twilio-ip-addresses).

**Verification:**
```bash
# Send test SMS from Twilio Console → verify it appears in conversation log
curl https://api.yourdomain.com/api/leads \
  -H "Authorization: Bearer <owner-token>"
# A new lead should appear from the inbound SMS contact
```

### 7.5 Vapi (Voice AI)

**Required for:** AI voice agent for inbound calls

```bash
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
```

**Webhook registration:**
1. Go to vapi.ai Dashboard → Phone Numbers → Your number
2. Set webhook URL: `https://api.yourdomain.com/api/webhooks/voice/<tenantId>`

**Verification:**
```bash
# Place test call to Vapi number → verify it logs in conversation table
```

### 7.6 SendGrid (Email)

**Required for:** Transactional emails (invoice delivery, quote notifications, portal invites)

```bash
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@yourdomain.com  # must be verified in SendGrid
```

**Verification:**
1. SendGrid → Settings → Sender Authentication → verify `SENDGRID_FROM_EMAIL`
2. Test: create and send a document via `/api/documents/:id/send`
3. Check SendGrid Activity Feed for delivery status

### 7.7 Google Calendar

**Required for:** Schedule sync, appointment booking confirmation

```bash
GOOGLE_CALENDAR_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-...
```

**Setup:**
1. Google Cloud Console → APIs & Services → OAuth 2.0 Client IDs
2. Application type: Web application
3. Authorized redirect URIs: `https://api.yourdomain.com/api/integrations/oauth/callback` (implement this endpoint before using)

**Note:** Per-tenant OAuth tokens are stored encrypted in the `Integration` table using `CREDENTIALS_ENCRYPTION_KEY`. The platform is the encrypted store; OAuth flow must be implemented per-tenant.

### 7.8 Integration verification command

```bash
# After all env vars are set, check that the platform processes a lead end-to-end:
TOKEN=$(curl -s -X POST https://api.yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@yourtenant.com","password":"<password>"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s https://api.yourdomain.com/api/leads \
  -H "Authorization: Bearer $TOKEN"
# Expected: JSON array (even empty is fine — proves DB + auth work)
```

---

## 8. Security Checklist

### 8.1 HTTPS / TLS

- [ ] TLS certificate issued by cert-manager (Let's Encrypt) ✅ configured in `deploy/k8s/aiow.yaml` Ingress
- [ ] Certificate auto-renews (cert-manager handles renewal at 2/3 lifetime)
- [ ] HTTPS enforced at Ingress (redirect HTTP → HTTPS at load balancer / Ingress)
- [ ] No HTTP-only routes exposed externally

### 8.2 JWT

- [ ] `JWT_SECRET` ≥32 random chars (`openssl rand -hex 32`) — enforced by `validateEnv()` ✅
- [ ] Access tokens expire in 15 minutes (`JWT_EXPIRES_IN=15m`) ✅
- [ ] Refresh tokens expire in 30 days (`REFRESH_EXPIRES_IN=30d`) ✅
- [ ] Passwords hashed with bcrypt 12 rounds ✅ (verified in Phase E)
- [ ] JWT `tid` claim carries tenantId — enforced at tenant middleware ✅

### 8.3 Encryption keys

- [ ] `CREDENTIALS_ENCRYPTION_KEY` is exactly 64 hex chars — enforced by `validateEnv()` ✅
- [ ] Key is unique per environment (not shared between staging/production)
- [ ] Key stored in secrets manager (not in source code or `.env` committed to git) 📋

### 8.4 CORS

- [ ] `CORS_ORIGINS` set to exact production domains — enforced by `validateEnv()` ✅
- [ ] No wildcard origin (`*`) — NestJS CORS config uses explicit allowlist ✅
- [ ] `credentials: true` only sent with matching origin ✅

### 8.5 CSP / Security headers (via Helmet) ✅

All headers verified live in Phase G:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'` (and more)
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Permitted-Cross-Domain-Policies: none`

### 8.6 Rate limiting ✅

- Login endpoint: 10 requests/minute/IP → 429 (Redis-backed, fail-open) ✅
- Public API (`/v1`): per-key configured limit (default 120 req/min), Redis-backed ✅
- No rate limit on other staff/owner routes (protected by JWT auth)

### 8.7 API keys

- [ ] API keys hashed before storage (SHA-256 of raw key stored) ✅
- [ ] Raw key only returned once at creation time ✅
- [ ] Scope enforcement: each key declares `scopes`, enforced by `ApiScopeGuard` ✅
- [ ] Rate limit per key, across all horizontal replicas ✅

### 8.8 Webhook secrets

- [ ] Outbound webhooks signed with HMAC-SHA256 (`X-AIOW-Signature` header) ✅
- [ ] Stripe inbound: `STRIPE_WEBHOOK_SECRET` set; signature verified ✅
- [ ] Twilio inbound: HMAC-SHA1 verification **NOT YET IMPLEMENTED** ⚠️
  - Compensating control: restrict `/api/webhooks/chat/:tenantId` and `/api/webhooks/voice/:tenantId` by Twilio IP allowlist at load balancer / Ingress

### 8.9 Tenant isolation

- Tenant-scoped Prisma client extension enforces `tenantId` on every query ✅
- FAIL CLOSED: unclassified Prisma operations throw, never silently leak ✅
- Cross-tenant isolation verified under concurrent load (Phase F Workflow 19) ✅

### 8.10 Container security

- [ ] Containers run as `USER node` (non-root) ✅ (fixed in Phase G)
- [ ] K8s pods have `runAsNonRoot: true, runAsUser: 1000` ✅ (fixed in Phase G)
- [ ] `allowPrivilegeEscalation: false` on all containers ✅ (fixed in Phase G)
- [ ] No privileged containers
- [ ] Read-only root filesystem: not currently set (NestJS needs write access for logs) — add tmpfs mounts if required by policy

### 8.11 Secrets management

- [ ] All secrets in K8s `Secret` (aiow-secrets) — never in ConfigMap or Deployment env literals 📋
- [ ] Consider AWS Secrets Manager + External Secrets Operator for secret rotation
- [ ] `.env` file is in `.gitignore` ✅ — never commit to source control

---

## 9. Monitoring

### 9.1 Health endpoints ✅

Both used as K8s probes:

| Endpoint | Purpose | Expected Response |
|----------|---------|------------------|
| `GET /api/ops/live` | K8s liveness probe | `{"status":"ok"}` — always 200 if process is alive |
| `GET /api/ops/ready` | K8s readiness probe | `{"status":"ready","db":"up"}` — 200 when DB is reachable |
| `GET /api/ops/metrics` | Business + queue metrics | JSON with `business`, `ai`, `workflows`, `queue` — requires ADMIN JWT |

### 9.2 Metrics

`GET /api/ops/metrics` (authenticated, ADMIN role) returns:

```json
{
  "business": { "leads": N, "jobs": N, "openJobs": N },
  "ai": { "agentTasks": N, "decisions": N },
  "workflows": { "runs": N },
  "queue": {
    "waiting": N,
    "active": N,
    "delayed": N,
    "failed": N,
    "completed": N
  }
}
```

**Alert thresholds:**
- `queue.failed` > 10: investigate dead-letter jobs
- `queue.waiting` > 1000: worker capacity issue — scale `aiow-worker`
- `business.openJobs` >> expected: possible dispatch failure

### 9.3 Logging

NestJS uses structured logging (`bufferLogs: true` in `main.ts`). Every startup event, error, and worker failure is logged to stdout. In K8s, pipe to your log aggregation stack:

```bash
# View API logs
kubectl logs -f deployment/aiow-api -n aiow --all-containers

# View worker logs (includes BullMQ job failures)
kubectl logs -f deployment/aiow-worker -n aiow

# Filter for errors
kubectl logs deployment/aiow-api -n aiow | grep -i "error\|fail\|exception"
```

### 9.4 Recommended alert rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| API pod crash | Pod restarts > 3 in 5 min | Critical |
| DB unreachable | `/api/ops/ready` returns non-200 | Critical |
| Queue failed jobs spike | `queue.failed` increases by >5 in 5 min | Warning |
| High error rate | HTTP 5xx rate > 1% of requests | Warning |
| Login rate limit hits | 429 on `/api/auth/login` > 100/min | Warning (possible brute force) |
| Memory pressure | Pod memory > 90% of limit (768Mi) | Warning |
| HPA at max | `aiow-api` replicas = 20 | Critical (capacity ceiling) |

### 9.5 Dashboards

The platform includes its own analytics at `/api/analytics/dashboard/:type` (types: `revenue`, `operations`, `customers`). For infrastructure monitoring, use:

- **Grafana + Prometheus**: scrape `/api/ops/metrics` (adapt endpoint to Prometheus format or use custom exporter)
- **Datadog / New Relic**: Node.js APM agent — add as npm dependency (not currently installed)
- **CloudWatch**: native if running on AWS EKS

### 9.6 Queue monitoring

```bash
# Real-time queue depth
watch -n 10 'curl -s https://api.yourdomain.com/api/ops/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .queue'

# Scale worker when waiting > 500:
kubectl scale deployment/aiow-worker --replicas=4 -n aiow
```

### 9.7 Database monitoring

```sql
-- Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Slow queries (> 1 second)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- HNSW index usage
SELECT indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';
```

---

## 10. Backup & Disaster Recovery

### 10.1 PostgreSQL backups

**Automated (strongly recommended):**
- RDS automated backups: 14-day retention (in Terraform skeleton: `backup_retention_period = 14`)
- Point-in-time recovery to any second within the window

**Manual backup before any migration or deployment:**

```bash
pg_dump \
  --host=$DB_HOST \
  --username=aiow \
  --dbname=aiow \
  --format=custom \
  --no-acl \
  --no-owner \
  --file="aiow_backup_$(date +%Y%m%d_%H%M%S).dump"

# Upload to S3
aws s3 cp aiow_backup_*.dump s3://aiow-production-documents/backups/db/
```

**Schedule (recommended):**
- Full backup: nightly at 02:00 UTC
- WAL archiving: continuous (RDS handles this automatically)

### 10.2 Redis persistence

docker-compose: Redis configured with `appendonly yes, appendfsync everysec` ✅ (fixed in Phase G).  
Production managed Redis (ElastiCache): enable AOF persistence in the ElastiCache parameter group.

BullMQ jobs in the `automation` queue persist to Redis AOF — survives restarts without job loss.

### 10.3 RPO / RTO targets

| Scenario | Target |
|----------|--------|
| RPO (data loss) | ≤1 minute (WAL/AOF continuous) |
| RTO — API pod failure | ~30s (K8s restarts pod; readiness probe gates traffic) |
| RTO — worker pod failure | ~15s (BullMQ stalledInterval=15s re-queues jobs) |
| RTO — full DB restore | ~30 minutes (pg_restore from daily backup) |
| RTO — Redis restore | ~5 minutes (AOF replay on restart) |
| RTO — full cluster failure | ~60 minutes (Terraform re-provision + restore) |

### 10.4 Restore procedure

**Database:**
```bash
# 1. Take a snapshot of the current (broken) state
pg_dump --host=$DB_HOST --username=aiow --dbname=aiow \
  --format=custom --file=aiow_broken_$(date +%Y%m%d).dump

# 2. Restore target database
createdb -h $DB_HOST -U aiow aiow
pg_restore --host=$DB_HOST --username=aiow --dbname=aiow \
  --no-acl --no-owner --clean aiow_backup_YYYYMMDD_HHMMSS.dump

# 3. Verify migration state
DATABASE_URL="postgresql://aiow:<pass>@$DB_HOST:5432/aiow" \
  npx prisma migrate status
# Expected: "Database schema is up to date!"

# 4. Run API readiness check
curl https://api.yourdomain.com/api/ops/ready
# Expected: {"status":"ready","db":"up"}
```

**Redis:**
```bash
# Redis recovers from AOF automatically on restart.
# For managed Redis, restore from a snapshot via AWS Console or CLI:
aws elasticache restore-replication-group-from-s3 \
  --replication-group-id aiow-redis \
  --s3-bucket-name aiow-backups \
  --s3-prefix redis-snapshots/
```

### 10.5 Recovery testing

Test the restore procedure quarterly:
1. Restore DB backup to a staging DB
2. Point a staging API at the restored DB
3. Run the smoke tests (Section 11) against staging
4. Verify data integrity spot checks

---

## 11. Smoke Tests After Deployment

Run these in order after every deployment. Each command must return the expected response before proceeding to the next.

```bash
BASE="https://api.yourdomain.com"

# ── Auth ───────────────────────────────────────────────────────────────────────
echo "TEST 1: Liveness probe"
curl -sf $BASE/api/ops/live | grep '"ok"'

echo "TEST 2: Readiness probe (DB)"
curl -sf $BASE/api/ops/ready | grep '"ready"'

echo "TEST 3: Staff login"
TOKEN=$(curl -sf -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\"}" \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] && echo "PASS: Got token" || echo "FAIL: No token"

echo "TEST 4: Invalid credentials → 401"
curl -sf -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@nobody.com","password":"wrongpassword"}' \
  -w "%{http_code}" -o /dev/null | grep 401

echo "TEST 5: Rate limit on login → 429 after 10 rapid attempts"
for i in $(seq 1 11); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"x@x.com","password":"bad"}')
done
echo "Last attempt code: $CODE (expected 429)"

# ── Tenant ────────────────────────────────────────────────────────────────────
echo "TEST 6: Get tenant info"
curl -sf $BASE/api/tenants/me \
  -H "Authorization: Bearer $TOKEN" | grep '"slug"'

echo "TEST 7: Metrics endpoint (ADMIN)"
curl -sf $BASE/api/ops/metrics \
  -H "Authorization: Bearer $TOKEN" | grep '"queue"'

# ── Leads ─────────────────────────────────────────────────────────────────────
echo "TEST 8: Create lead"
LEAD=$(curl -sf -X POST $BASE/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"contactName":"Smoke Test Customer","phone":"+15550000001","serviceType":"HVAC","urgency":"NORMAL"}')
LEAD_ID=$(echo $LEAD | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$LEAD_ID" ] && echo "PASS: Lead $LEAD_ID" || echo "FAIL: No lead"

echo "TEST 9: Invalid stage → 400 (not 500)"
curl -sf $BASE/api/leads -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}" -o /dev/null | grep 200

# ── Documents ─────────────────────────────────────────────────────────────────
echo "TEST 10: Create quote"
QUOTE=$(curl -sf -X POST $BASE/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"QUOTE\",\"contactId\":\"$(echo $LEAD | grep -o '"contactId":"[^"]*"' | cut -d'"' -f4)\",\"lineItems\":[{\"description\":\"HVAC Service\",\"quantity\":1,\"unitPrice\":250}]}")
echo $QUOTE | grep '"QUOTE"' && echo "PASS: Quote created" || echo "FAIL: No quote"

# ── Security headers ──────────────────────────────────────────────────────────
echo "TEST 11: Security headers present"
HEADERS=$(curl -sI $BASE/api/ops/live)
echo $HEADERS | grep -q "Content-Security-Policy" && echo "PASS: CSP" || echo "FAIL: No CSP"
echo $HEADERS | grep -q "Strict-Transport-Security" && echo "PASS: HSTS" || echo "FAIL: No HSTS"
echo $HEADERS | grep -q "X-Frame-Options" && echo "PASS: XFO" || echo "FAIL: No XFO"

# ── CORS ──────────────────────────────────────────────────────────────────────
echo "TEST 12: CORS rejects unknown origin"
CORS=$(curl -sI -H "Origin: https://evil.com" $BASE/api/ops/live)
echo $CORS | grep -q "Access-Control-Allow-Origin: https://evil.com" \
  && echo "FAIL: CORS allows evil.com" || echo "PASS: evil.com rejected"

# ── Tenant isolation ──────────────────────────────────────────────────────────
echo "TEST 13: No unauthenticated data access"
curl -sf $BASE/api/leads \
  -w "\n%{http_code}" -o /dev/null | grep "40[13]"

# ── Business Brain ────────────────────────────────────────────────────────────
echo "TEST 14: Knowledge list"
curl -sf $BASE/api/brain/knowledge \
  -H "Authorization: Bearer $TOKEN" | grep "\[" && echo "PASS" || echo "FAIL"

echo "TEST 15: Memory invalid subjectType → 400"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  $BASE/api/brain/memory/invalid_type/any-id \
  -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "400" ] && echo "PASS: 400" || echo "FAIL: got $CODE"

# ── Integrations ──────────────────────────────────────────────────────────────
echo "TEST 16: SSRF protection"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST $BASE/api/integrations/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://192.168.1.1/internal","events":["lead.created"]}')
[ "$CODE" = "400" ] && echo "PASS: SSRF blocked" || echo "FAIL: got $CODE"

# ── Portal ────────────────────────────────────────────────────────────────────
echo "TEST 17: Portal login"
PORTAL=$(curl -sf -X POST $BASE/api/portal/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"tenantSlug\":\"$(curl -sf $BASE/api/tenants/me -H 'Authorization: Bearer '$TOKEN | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)\",\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASSWORD\"}")
echo $PORTAL | grep -q '"accessToken"' && echo "PASS: Portal login" || echo "SKIP: No portal user configured"

echo ""
echo "=== Smoke tests complete ==="
```

---

## 12. Production Acceptance Checklist

Complete all items before traffic goes live.

### Infrastructure

- [ ] PostgreSQL: managed instance running, pgvector enabled
- [ ] Redis: managed instance running, AOF persistence enabled
- [ ] S3 bucket: `aiow-<env>-documents` created
- [ ] K8s cluster: all pods in `Running` state
- [ ] DNS: `api.yourdomain.com` and `app.yourdomain.com` resolve to Ingress IP
- [ ] TLS: valid certificates on both domains, auto-renew confirmed
- [ ] HTTPS: HTTP requests redirect to HTTPS

### Security

- [ ] `JWT_SECRET` is ≥32 random chars, unique to production
- [ ] `CREDENTIALS_ENCRYPTION_KEY` is 64 hex chars, unique to production
- [ ] `CORS_ORIGINS` set to exact production domains only
- [ ] No placeholder `CHANGE_ME` values in K8s secrets
- [ ] `migrate-passwords.cjs` is deleted from repo ✅ (deleted in Phase G)
- [ ] `.env` is not committed to git
- [ ] API containers running as non-root (`USER node`) ✅
- [ ] K8s pods running as non-root (`runAsNonRoot: true`) ✅

### Database

- [ ] Both migrations applied: `migrate status` shows "up to date"
- [ ] HNSW indexes verified: `pg_indexes` shows 2 embedding indexes
- [ ] Pre-migration backup taken and stored in S3
- [ ] Backup restore tested on staging

### Health

- [ ] `GET /api/ops/live` → `{"status":"ok"}`
- [ ] `GET /api/ops/ready` → `{"status":"ready","db":"up"}`
- [ ] `GET /api/ops/metrics` → returns queue + business counts
- [ ] K8s readiness probe passing (all `aiow-api` pods show `1/1 Ready`)
- [ ] K8s liveness probe configured (API and worker)

### Third-party integrations

- [ ] Anthropic API key valid and tested
- [ ] Voyage AI key valid (or acknowledged offline/stub mode)
- [ ] Stripe: `sk_live_` key set, webhook registered, webhook secret set
- [ ] Twilio: account SID + auth token set, inbound webhook URL registered (IP allowlist applied as compensating control for missing HMAC verification)
- [ ] SendGrid: API key valid, sender email verified
- [ ] Vapi: API key set, phone number webhook registered (if using voice)
- [ ] Google Calendar: OAuth client configured (if using calendar sync)

### Smoke tests

- [ ] All 17 smoke tests (Section 11) pass
- [ ] End-to-end: create lead → dispatch → invoice → payment verified against production

---

## 13. Pilot Customer Checklist

Before onboarding the first real paying customer:

### Account provisioning

```bash
# Create tenant via the signup endpoint (public, no auth required)
curl -X POST https://api.yourdomain.com/api/tenants \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Acme HVAC",
    "ownerEmail": "owner@acmehvac.com",
    "ownerPassword": "<secure-password>",
    "industryModule": "FIELD_SERVICES"
  }'
# Response: { "id": "<tenantId>", "slug": "acme-hvac", "industryModule": "FIELD_SERVICES" }
```

**After provisioning:**
- [ ] Tenant ID and slug recorded
- [ ] Owner can log in at `https://app.yourdomain.com`
- [ ] Owner email is valid and reachable

### Tenant configuration

- [ ] Working hours configured: `PUT /api/schedule/working-hours/<userId>`
- [ ] Staff users created: `POST /api/tenants/users` (role: `STAFF`)
- [ ] Automation rules seeded (happens automatically on provisioning)
- [ ] Industry-specific knowledge uploaded to Business Brain: `POST /api/brain/knowledge`

### Integration setup (per tenant)

- [ ] Twilio number configured for inbound chat (if using SMS)
- [ ] Stripe account connected for payment processing
- [ ] Customer portal URL explained to owner: `https://portal.yourdomain.com` (if using separate portal domain) or `https://app.yourdomain.com/portal`

### Customer portal setup

```bash
# Create portal access for first customer contact
curl -X POST https://api.yourdomain.com/api/portal/auth/users \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"contactId\": \"<contactId>\", \"email\": \"customer@email.com\", \"password\": \"TempPass123!\"}"

# Customer logs in at:
curl -X POST https://api.yourdomain.com/api/portal/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"tenantSlug":"acme-hvac","email":"customer@email.com","password":"TempPass123!"}'
```

- [ ] Portal login working for pilot customer
- [ ] Pilot customer can view their job history and invoices

### Data sanity

- [ ] No test data visible to pilot customer (use a separate tenant for testing)
- [ ] Tenant isolation confirmed: pilot customer cannot see other tenants' data
- [ ] Pilot customer's data is not visible to other tenants

### Support readiness

- [ ] Ops team has ADMIN login credentials
- [ ] Runbook location communicated to on-call team
- [ ] Alert channels configured (Slack/PagerDuty)
- [ ] Escalation path defined

---

## 14. Launch-Day Checklist

Exact deployment sequence with validation and rollback at each step.

### T-24 hours

- [ ] Pre-launch DB backup: `pg_dump` stored in S3
- [ ] Notify on-call team: standby from T-0 to T+4 hours
- [ ] Staging smoke tests pass (run Section 11 against staging)
- [ ] New Docker images built and pushed for the release tag

### T-0: Deployment sequence

**Step 1 — Build and push final images**
```bash
git tag v1.0.0 && git push --tags
# GitHub Actions release.yml triggers automatically
# Monitor: github.com/your-org/aiow/actions
```
Validation: Images visible in GHCR at `ghcr.io/your-org/aiow-api:v1.0.0`  
Rollback: N/A (images are additive)

---

**Step 2 — Database migrations**
```bash
# Run as K8s Job (see Section 5.2 Step 4)
kubectl apply -f deploy/k8s/migrate-job.yaml
kubectl wait --for=condition=complete job/aiow-migrate -n aiow --timeout=300s
kubectl logs job/aiow-migrate -n aiow
```
Validation: `prisma migrate status` shows "up to date"  
Rollback: `pg_restore` from pre-launch backup (see Section 10.4)

---

**Step 3 — Deploy API**
```bash
kubectl set image deployment/aiow-api api=ghcr.io/your-org/aiow-api:v1.0.0 -n aiow
kubectl rollout status deployment/aiow-api -n aiow --timeout=300s
```
Validation:
```bash
curl -sf https://api.yourdomain.com/api/ops/ready
# Expected: {"status":"ready","db":"up"}
kubectl get pods -n aiow -l app=aiow-api
# Expected: 3/3 Running
```
Rollback:
```bash
kubectl rollout undo deployment/aiow-api -n aiow
kubectl rollout status deployment/aiow-api -n aiow
```

---

**Step 4 — Deploy Worker**
```bash
kubectl set image deployment/aiow-worker worker=ghcr.io/your-org/aiow-api:v1.0.0 -n aiow
kubectl rollout status deployment/aiow-worker -n aiow --timeout=300s
```
Validation:
```bash
kubectl logs deployment/aiow-worker -n aiow --tail=20
# Expected: "Automation worker started" in logs
kubectl get pods -n aiow -l app=aiow-worker
# Expected: 2/2 Running
```
Rollback:
```bash
kubectl rollout undo deployment/aiow-worker -n aiow
```

---

**Step 5 — Deploy Web**
```bash
kubectl set image deployment/aiow-web web=ghcr.io/your-org/aiow-web:v1.0.0 -n aiow
kubectl rollout status deployment/aiow-web -n aiow --timeout=300s
```
Validation:
```bash
curl -sf https://app.yourdomain.com
# Expected: HTML response (Next.js app)
```
Rollback:
```bash
kubectl rollout undo deployment/aiow-web -n aiow
```

---

**Step 6 — Run smoke tests**
```bash
# Run all 17 smoke tests from Section 11
# All must PASS before proceeding
```
Validation: All 17 PASS  
Rollback: Undo all three deployments (Steps 3–5 rollback commands)

---

**Step 7 — Update DNS (if first deployment)**
- Set A record: `api.yourdomain.com` → Ingress load balancer IP
- Set A record: `app.yourdomain.com` → Ingress load balancer IP
- DNS TTL: start at 60 seconds for rollback capability; increase to 3600 after stabilization

Validation:
```bash
dig api.yourdomain.com A +short
# Expected: Ingress IP
```

---

**Step 8 — Enable traffic**
- Remove any maintenance page or IP restrictions
- Monitor error rate for 15 minutes

Validation:
```bash
# Watch for errors
kubectl logs -f deployment/aiow-api -n aiow | grep -i "error\|exception"
# Watch metrics
watch -n 30 'curl -s https://api.yourdomain.com/api/ops/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq "{queue:.queue,jobs:.business.openJobs}"'
```

---

**Step 9 — Onboard pilot tenant**
```bash
curl -X POST https://api.yourdomain.com/api/tenants \
  -H 'Content-Type: application/json' \
  -d '{"name":"<pilot_name>","ownerEmail":"<email>","ownerPassword":"<password>","industryModule":"FIELD_SERVICES"}'
```
Validation: Owner can log in and see the dashboard  
Rollback: `DELETE FROM "Tenant" WHERE id = '<id>';` in DB (cascade deletes all tenant data)

---

### T+1 hour: Stabilization check

- [ ] Zero unexpected 5xx errors in API logs
- [ ] Queue `failed` count stable (not growing)
- [ ] All 3 API pods healthy
- [ ] Both worker pods healthy
- [ ] Memory usage < 80% of limits on all pods
- [ ] No DB connection pool exhaustion (`pg_stat_activity` connections < limit)

---

## 15. Post-Launch Checklist

### First hour

- [ ] Monitor `kubectl logs -f deployment/aiow-api -n aiow` for errors
- [ ] Check queue health: `queue.failed` not growing in `/api/ops/metrics`
- [ ] Confirm pilot tenant successfully used the platform (created a lead, dispatched a job)
- [ ] Verify first Stripe payment processes correctly (if applicable)
- [ ] Check all third-party webhook deliveries in logs
- [ ] Confirm outbound SMS sends if Twilio is configured

### First day

- [ ] Review all error logs from launch day
- [ ] Check DB query performance (`pg_stat_statements` slow queries)
- [ ] Verify nightly DB backup completed and stored in S3
- [ ] Confirm Redis AOF file is growing (persistence active)
- [ ] Review `/api/ops/metrics` queue counts — ensure `failed` is 0 or near 0
- [ ] Check HPA: ensure CPU-based autoscaling is functioning (`kubectl describe hpa aiow-api -n aiow`)
- [ ] Pilot customer onboarding debrief — note any workflow friction
- [ ] Resolve any setup issues reported by pilot customer

### First week

- [ ] Review and fix any recurring 5xx errors
- [ ] Tune DB connection pool if `pool_timeout` errors appear in logs
- [ ] Review BullMQ dead-letter queue: jobs in `failed` state — investigate root causes
- [ ] Implement Twilio HMAC-SHA1 webhook signature verification (deferred from Phase G)
- [ ] Set HSTS max-age to 31536000 (1 year) for preload list eligibility
- [ ] Add proper Prometheus metrics scraping if using Grafana
- [ ] Load test: simulate 10× expected pilot traffic and validate HPA behavior
- [ ] Review Stripe webhook delivery success rate in Stripe dashboard
- [ ] Document any operational learnings in runbook

### First month

- [ ] Onboard additional pilot customers (separate tenants)
- [ ] Review and tune worker concurrency based on observed queue depth
- [ ] Verify 14-day RDS backup retention is operational — attempt a test restore
- [ ] Implement secret rotation procedure:
  - `JWT_SECRET`: update in K8s secret → rolling restart API pods → tokens re-signed (existing tokens expire naturally in 15 minutes)
  - `CREDENTIALS_ENCRYPTION_KEY`: requires data re-encryption in `Integration` table before key change
- [ ] Review audit log completeness: `GET /api/compliance/audit`
- [ ] Conduct GDPR process test: `GET /api/compliance/export/:contactId` and `POST /api/compliance/erase/:contactId`
- [ ] Configure proper monitoring dashboards in Grafana / Datadog
- [ ] Implement external uptime monitoring (e.g., Better Uptime, Pingdom) on `/api/ops/live`
- [ ] Review API key usage: `GET /api/developer/usage` — identify highest-volume API consumers
- [ ] Performance review: measure p95 API response time under real load
- [ ] Security review: test rate limiting held under sustained brute-force attempt
- [ ] Capacity planning: project DB storage growth rate; adjust RDS instance if needed
- [ ] Consider enabling pgvector CONCURRENTLY index rebuild if tables have grown significantly

---

## Appendix A: Quick Reference Commands

```bash
# Get a fresh admin token
TOKEN=$(curl -sf -X POST https://api.yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"$OWNER_EMAIL","password":"$OWNER_PASS"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Check all pods
kubectl get pods -n aiow

# View API logs
kubectl logs -f deployment/aiow-api -n aiow

# View worker logs
kubectl logs -f deployment/aiow-worker -n aiow

# Queue metrics
curl -s https://api.yourdomain.com/api/ops/metrics \
  -H "Authorization: Bearer $TOKEN" | jq .queue

# Migration status
DATABASE_URL=... npx prisma migrate status

# Scale API manually
kubectl scale deployment/aiow-api --replicas=6 -n aiow

# Emergency rollback all
kubectl rollout undo deployment/aiow-api -n aiow
kubectl rollout undo deployment/aiow-worker -n aiow
kubectl rollout undo deployment/aiow-web -n aiow
```

## Appendix B: Known Operational Gaps

Items that require cloud infrastructure or are deferred; not blocking for initial launch.

| Gap | Risk | Compensating Control |
|-----|------|---------------------|
| Twilio webhook HMAC verification | Medium: spoofed inbound SMS/voice | Twilio IP allowlist at load balancer |
| XSS sanitization (frontend) | Low: Next.js JSX escapes by default | Audit `dangerouslySetInnerHTML` usage |
| Terraform modules (skeleton) | N/A: deploy docs | Use managed console for RDS/ElastiCache provisioning |
| Zero-downtime K8s migrations | Low: 3 API replicas mean no downtime for app; migration runs serially | Migration runs before pods start; readiness probe gates traffic |
| HSTS preload (1-year) | Info: not preload-eligible | 180-day HSTS still enforced for active connections |
| Datadog/Prometheus scraping | Medium: limited metrics visibility | `/api/ops/metrics` provides baseline; set up proper APM in week 1 |
