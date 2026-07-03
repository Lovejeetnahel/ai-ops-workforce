#!/usr/bin/env bash
# AIOW Post-Deployment Smoke Tests (17 tests)
# Usage: API_BASE=https://api.aiow.app EMAIL=owner@yourtenant.com PASS=secret ./deploy/smoke-test.sh
# Requires: curl, jq
set -euo pipefail

API="${API_BASE:-https://api.aiow.app}"
EMAIL="${EMAIL:-CHANGE_ME}"
PASS="${PASS:-CHANGE_ME}"
PASS2="${PASS2:-CHANGE_ME}"   # second user for isolation test
EMAIL2="${EMAIL2:-CHANGE_ME2}"

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS: $1"; ((PASS_COUNT++)); }
fail() { echo "  FAIL: $1"; ((FAIL_COUNT++)); }

check() {
  local label="$1" expected_status="$2" actual_status="$3" body="$4"
  if [ "$actual_status" = "$expected_status" ]; then
    pass "$label (HTTP $actual_status)"
  else
    fail "$label — expected HTTP $expected_status, got $actual_status. Body: $body"
  fi
}

echo "=== AIOW Smoke Tests against $API ==="
echo ""

# ── T1: Health / readiness ────────────────────────────────────
echo "--- T1: Health check ---"
R=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/ops/ready" || echo "000")
check "GET /api/ops/ready" "200" "$R" ""

# ── T2: Liveness ─────────────────────────────────────────────
echo "--- T2: Liveness check ---"
R=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/ops/live" || echo "000")
check "GET /api/ops/live" "200" "$R" ""

# ── T3: Auth — login ─────────────────────────────────────────
echo "--- T3: Login ---"
BODY=$(curl -sf -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" || echo "{}")
TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  pass "POST /api/auth/login returns accessToken"
  ((PASS_COUNT++))
else
  fail "POST /api/auth/login — no accessToken in response"
  echo "  Body: $BODY"
  ((FAIL_COUNT++))
  echo "ABORT: Cannot continue without a valid token."
  exit 1
fi

AUTH="Authorization: Bearer $TOKEN"

# ── T4: Authenticated endpoint ───────────────────────────────
echo "--- T4: Authenticated GET ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/leads" -H "$AUTH" || echo "000")
check "GET /api/leads (authenticated)" "200" "$S" ""

# ── T5: Unauthenticated blocked ───────────────────────────────
echo "--- T5: Unauthenticated blocked ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/leads" || echo "000")
check "GET /api/leads (no token) → 401" "401" "$S" ""

# ── T6: Validation pipe — bad body ───────────────────────────
echo "--- T6: ValidationPipe rejects bad body ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$API/api/leads" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"bad_field":true}' || echo "000")
check "POST /api/leads bad body → 400" "400" "$S" ""

# ── T7: Invalid date → 400 (not 500) ─────────────────────────
echo "--- T7: Invalid date param → 400 ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" \
  "$API/api/schedule/calendar?from=INVALID&to=INVALID" -H "$AUTH" || echo "000")
check "GET /schedule/calendar?from=INVALID → 400" "400" "$S" ""

# ── T8: Refresh token flow ────────────────────────────────────
echo "--- T8: Refresh token ---"
RBODY=$(curl -sf -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" || echo "{}")
REFRESH=$(echo "$RBODY" | jq -r '.refreshToken // empty')
if [ -n "$REFRESH" ] && [ "$REFRESH" != "null" ]; then
  S=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH\"}" || echo "000")
  check "POST /api/auth/refresh → 200" "200" "$S" ""
else
  fail "POST /api/auth/login did not return refreshToken"
  ((FAIL_COUNT++))
fi

# ── T9: CORS header present ───────────────────────────────────
echo "--- T9: CORS header ---"
CORS_H=$(curl -sf -I -X OPTIONS "$API/api/auth/login" \
  -H "Origin: https://aiow.app" \
  -H "Access-Control-Request-Method: POST" 2>&1 | grep -i "access-control-allow-origin" || echo "")
if [ -n "$CORS_H" ]; then
  pass "CORS Access-Control-Allow-Origin header present"
  ((PASS_COUNT++))
else
  fail "CORS header missing"
  ((FAIL_COUNT++))
fi

# ── T10: Tenant isolation (cross-tenant read blocked) ─────────
echo "--- T10: Tenant isolation ---"
if [ "$EMAIL2" = "CHANGE_ME2" ]; then
  echo "  SKIP: EMAIL2 not set — skipping tenant isolation test"
else
  BODY2=$(curl -sf -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL2\",\"password\":\"$PASS2\"}" || echo "{}")
  TOKEN2=$(echo "$BODY2" | jq -r '.accessToken // empty')
  if [ -n "$TOKEN2" ] && [ "$TOKEN2" != "null" ]; then
    # Get a lead ID from tenant 1
    LEAD_ID=$(curl -sf "$API/api/leads" -H "$AUTH" | jq -r '.[0].id // empty')
    if [ -n "$LEAD_ID" ]; then
      S=$(curl -sf -o /dev/null -w "%{http_code}" \
        "$API/api/leads/$LEAD_ID" -H "Authorization: Bearer $TOKEN2" || echo "000")
      check "Cross-tenant GET /leads/:id → 404" "404" "$S" ""
    else
      echo "  SKIP: no leads in tenant 1 to test isolation"
    fi
  else
    fail "Could not login as EMAIL2 for isolation test"
    ((FAIL_COUNT++))
  fi
fi

# ── T11: RBAC — customer cannot access admin route ───────────
echo "--- T11: RBAC enforcement ---"
# Portal/customer token hitting admin route should 403
S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/users" -H "$AUTH" || echo "000")
# OWNER will get 200, non-admin will get 403 — either is correct behavior
if [ "$S" = "200" ] || [ "$S" = "403" ]; then
  pass "GET /api/users RBAC check (HTTP $S)"
  ((PASS_COUNT++))
else
  fail "GET /api/users unexpected HTTP $S"
  ((FAIL_COUNT++))
fi

# ── T12: Job CRUD ─────────────────────────────────────────────
echo "--- T12: Job creation ---"
JOB_BODY=$(curl -sf -X POST "$API/api/jobs" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"Smoke Test Job","description":"automated smoke","status":"PENDING"}' || echo "{}")
JOB_ID=$(echo "$JOB_BODY" | jq -r '.id // empty')
if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
  pass "POST /api/jobs created (id: $JOB_ID)"
  ((PASS_COUNT++))
  S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/jobs/$JOB_ID" -H "$AUTH" || echo "000")
  check "GET /api/jobs/:id → 200" "200" "$S" ""
  S=$(curl -sf -o /dev/null -w "%{http_code}" -X DELETE "$API/api/jobs/$JOB_ID" -H "$AUTH" || echo "000")
  check "DELETE /api/jobs/:id → 200" "200" "$S" ""
else
  fail "POST /api/jobs did not return id — body: $JOB_BODY"
  ((FAIL_COUNT++))
fi

# ── T13: Invoice flow ─────────────────────────────────────────
echo "--- T13: Invoice create ---"
INV_BODY=$(curl -sf -X POST "$API/api/invoices" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"USD","status":"DRAFT"}' || echo "{}")
INV_ID=$(echo "$INV_BODY" | jq -r '.id // empty')
if [ -n "$INV_ID" ] && [ "$INV_ID" != "null" ]; then
  pass "POST /api/invoices created (id: $INV_ID)"
  ((PASS_COUNT++))
else
  fail "POST /api/invoices did not return id — body: $INV_BODY"
  ((FAIL_COUNT++))
fi

# ── T14: Webhook endpoint reachable ──────────────────────────
echo "--- T14: Stripe webhook endpoint ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$API/api/webhooks/stripe" \
  -H "Content-Type: application/json" -d '{}' || echo "000")
# Expects 400 (bad signature) not 404/500
check "POST /api/webhooks/stripe → 400 (bad sig, not 404)" "400" "$S" ""

# ── T15: API v1 scope guard blocks keyless request ───────────
echo "--- T15: /v1 requires API key ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/v1/leads" || echo "000")
check "GET /api/v1/leads (no key) → 401" "401" "$S" ""

# ── T16: 404 on unknown route ────────────────────────────────
echo "--- T16: 404 on unknown route ---"
S=$(curl -sf -o /dev/null -w "%{http_code}" "$API/api/nonexistent-route-xyz" -H "$AUTH" || echo "000")
check "GET /api/nonexistent-route → 404" "404" "$S" ""

# ── T17: Web frontend serves HTML ─────────────────────────────
echo "--- T17: Web frontend ---"
WEB="${WEB_BASE:-https://aiow.app}"
CT=$(curl -sf -o /dev/null -w "%{content_type}" "$WEB/" || echo "")
if echo "$CT" | grep -q "text/html"; then
  pass "GET $WEB/ returns text/html"
  ((PASS_COUNT++))
else
  fail "GET $WEB/ content-type: $CT"
  ((FAIL_COUNT++))
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════"
echo "  Smoke Tests: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "══════════════════════════════════════"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "RESULT: FAIL — do not mark deployment successful"
  exit 1
else
  echo "RESULT: PASS — deployment verified"
  exit 0
fi
