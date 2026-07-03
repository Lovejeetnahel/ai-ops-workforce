# AIOW Production Deployment Checklist

> Flow: Provision → Staging → Smoke Tests → Promote to Production
> Complete every item top to bottom. Do not skip. Rollback instructions after each phase.

---

## Phase 0 — Pre-Deploy (run once, before any server commands)

- [ ] Take full DB snapshot if upgrading existing install: `pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql`
- [ ] Fill `.env.production.template` → save as `.env.staging` and `.env.production` (never commit either)
  - `JWT_SECRET` — `openssl rand -hex 32` (min 32 chars)
  - `CREDENTIALS_ENCRYPTION_KEY` — `openssl rand -hex 32` (output = 64 hex chars — use the same value for staging and prod)
  - `DATABASE_URL` — real managed Postgres 16 + pgvector
  - `REDIS_URL` — real managed Redis 7
  - `CORS_ORIGINS` — staging: `https://staging.yourdomain.com,https://api-staging.yourdomain.com`
  - `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `STRIPE_SECRET_KEY` — real keys
- [ ] DNS A records created and propagated (check with `dig staging.yourdomain.com +short`)
  - `staging.yourdomain.com` → server IP
  - `api-staging.yourdomain.com` → server IP
  - `yourdomain.com` → server IP (create now, do not activate until promotion)
  - `api.yourdomain.com` → server IP (create now, do not activate until promotion)

**Rollback at this phase:** Nothing deployed — no rollback needed.

---

## Phase 1 — Server Provision & Docker Install

```bash
# On fresh Ubuntu 24.04 server
apt-get update -y
apt-get install -y ca-certificates curl nginx certbot python3-certbot-nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

- [ ] `docker --version` prints 27.x or later

**Firewall — only 22, 80, 443 are ever public. 3000 and 4000 are never exposed:**

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status   # must show only 22, 80, 443
```

- [ ] `ufw status` shows exactly: 22/tcp, 80/tcp, 443/tcp — nothing else

---

## Phase 2 — Upload Project

```bash
# From local machine
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='.env.*' \
  /path/to/ai-ops-workforce/ root@SERVER_IP:/opt/aiow/
```

- [ ] `/opt/aiow/docker-compose.yml` exists on server
- [ ] `/opt/aiow/apps/api/Dockerfile` exists on server

---

## Phase 3 — Staging Deploy

### 3a — Create staging .env

```bash
# On server
cp /dev/stdin /opt/aiow/.env << 'ENVEOF'
NODE_ENV=production
API_PORT=4000
JWT_SECRET=YOUR_GENERATED_SECRET
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=30d
CREDENTIALS_ENCRYPTION_KEY=YOUR_GENERATED_KEY
CORS_ORIGINS=https://staging.yourdomain.com,https://api-staging.yourdomain.com
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-4-8
VOYAGE_API_KEY=...
EMBEDDING_MODEL=voyage-3
EMBEDDING_DIMS=1024
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SID=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
ENVEOF
```

- [ ] `.env` contains no literal `PASTE_HERE` or `CHANGE_ME` strings: `grep -c 'PASTE_HERE\|CHANGE_ME' /opt/aiow/.env` must print `0`

### 3b — Configure Nginx for staging (before starting containers)

```bash
STAGING_DOMAIN=staging.yourdomain.com
STAGING_API_DOMAIN=api-staging.yourdomain.com

cat > /etc/nginx/sites-available/aiow-staging << EOF
server {
    listen 80;
    server_name $STAGING_API_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    server_name $STAGING_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/aiow-staging /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# TLS — DNS must be propagated before this step
certbot --nginx -d $STAGING_DOMAIN -d $STAGING_API_DOMAIN \
  --non-interactive --agree-tos -m your@email.com
```

- [ ] `curl -sf https://api-staging.yourdomain.com/` returns something (even a 404 is fine — proves TLS+proxy works before the API is up)

### 3c — Build and start stack

```bash
cd /opt/aiow
docker compose up --build -d
docker compose ps   # all 5 services: postgres, redis, api, worker, web — all "running"
```

- [ ] `docker compose logs api --tail=20` shows `All migrations have been applied`
- [ ] `docker compose logs api --tail=20` shows application started on port 4000
- [ ] `curl http://127.0.0.1:4000/api/ops/ready` → 200 (local only — not public)
- [ ] `curl https://api-staging.yourdomain.com/api/ops/ready` → 200 (via Nginx+TLS)

---

## Phase 4 — Staging Smoke Tests

```bash
chmod +x /opt/aiow/deploy/smoke-test.sh

API_BASE=https://api-staging.yourdomain.com \
WEB_BASE=https://staging.yourdomain.com \
EMAIL=owner@yourtenant.com \
PASS=yourpassword \
/opt/aiow/deploy/smoke-test.sh
```

- [ ] **17/17 tests PASS** — do not proceed to production until this is green
- [ ] T1: Health /ready → 200
- [ ] T2: Liveness /live → 200
- [ ] T3: Login returns accessToken
- [ ] T4: Authenticated GET /leads → 200
- [ ] T5: Unauthenticated GET /leads → 401
- [ ] T6: Bad body POST /leads → 400
- [ ] T7: Invalid date ?from=INVALID → 400 (not 500)
- [ ] T8: Refresh token flow → 200
- [ ] T9: CORS header present
- [ ] T10: Tenant isolation (cross-tenant → 404)
- [ ] T11: RBAC enforcement
- [ ] T12: Job CRUD (create/read/delete)
- [ ] T13: Invoice create
- [ ] T14: Stripe webhook endpoint → 400 (not 404/500)
- [ ] T15: /v1 without API key → 401
- [ ] T16: Unknown route → 404
- [ ] T17: Web frontend returns text/html

**Rollback staging:** `docker compose down && docker compose up --build -d`

---

## Phase 5 — Staging-to-Production Promotion Checklist

Complete every item before switching DNS to production.

**Code and config:**
- [ ] All 17 smoke tests green on staging
- [ ] No errors in `docker compose logs api --tail=100` or `docker compose logs worker --tail=100`
- [ ] Verified a full workflow manually: login → create lead → create job → generate invoice → mark paid
- [ ] Stripe webhook registered for production URL (`https://api.yourdomain.com/api/webhooks/stripe`)
- [ ] `CORS_ORIGINS` updated in `.env` to production domains: `https://yourdomain.com,https://api.yourdomain.com`
- [ ] `WEB_PUBLIC_API_URL` will be `https://api.yourdomain.com` (set in docker-compose.yml or .env before restart)

**Backup:**
- [ ] DB snapshot taken from staging: `docker compose exec -T postgres pg_dump -U aiow aiow | gzip > /opt/backups/pre-prod-$(date +%Y%m%d).sql.gz`

**Nginx:**
- [ ] Nginx vhost for production domains created and TLS issued (see Phase 6)
- [ ] Confirmed `curl https://api.yourdomain.com/api/ops/ready` → 200 after cutover

**DNS cutover (point of no return):**
- [ ] Update DNS A records: `yourdomain.com` and `api.yourdomain.com` → server IP (if not already)
- [ ] Wait for propagation: `dig yourdomain.com +short` returns server IP
- [ ] Run smoke tests against production domains (see Phase 7)

---

## Phase 6 — Production Nginx + TLS

```bash
PROD_DOMAIN=yourdomain.com
PROD_API_DOMAIN=api.yourdomain.com

cat > /etc/nginx/sites-available/aiow-prod << EOF
server {
    listen 80;
    server_name $PROD_API_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    server_name $PROD_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/aiow-prod /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d $PROD_DOMAIN -d $PROD_API_DOMAIN \
  --non-interactive --agree-tos -m your@email.com
```

- [ ] `curl -sf https://api.yourdomain.com/api/ops/ready` → 200

**Restart with production CORS:**

```bash
cd /opt/aiow
# Update .env: set CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
nano .env
docker compose up -d --no-deps api worker web
```

---

## Phase 7 — Production Smoke Tests

```bash
API_BASE=https://api.yourdomain.com \
WEB_BASE=https://yourdomain.com \
EMAIL=owner@yourtenant.com \
PASS=yourpassword \
/opt/aiow/deploy/smoke-test.sh
```

- [ ] **17/17 PASS** — deployment is complete

---

## Phase 8 — Auto-Restart and Daily Backups

```bash
# Auto-restart on reboot
cat > /etc/systemd/system/aiow.service << 'EOF'
[Unit]
Description=AIOW Docker Compose
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/aiow
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl enable aiow

# Daily DB backup — retain 7 days
mkdir -p /opt/backups
cat > /etc/cron.daily/aiow-backup << 'EOF'
#!/bin/bash
docker compose -f /opt/aiow/docker-compose.yml exec -T postgres \
  pg_dump -U aiow aiow | gzip > /opt/backups/aiow-$(date +%Y%m%d).sql.gz
find /opt/backups -name "*.sql.gz" -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/aiow-backup
```

- [ ] `systemctl is-enabled aiow` → `enabled`
- [ ] `/etc/cron.daily/aiow-backup` exists and is executable

---

## Rollback Reference

| Situation | Command |
|-----------|---------|
| Bad image / crash after deploy | `docker compose down && docker compose up --build -d` |
| DB corrupted | `gunzip -c /opt/backups/aiow-YYYYMMDD.sql.gz \| docker compose exec -T postgres psql -U aiow aiow` |
| Need previous image | `docker compose down && git checkout <previous-tag> && docker compose up --build -d` |
| Nginx config broken | `nginx -t` to diagnose; `systemctl reload nginx` after fix |

---

*Deployment complete when Phase 7 smoke tests show 17/17 PASS on production domains.*
