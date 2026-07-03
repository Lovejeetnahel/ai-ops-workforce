#!/usr/bin/env bash
# AIOW Production Rollback Script
# Usage: ./deploy/rollback.sh
# Rolls back all three deployments to their previous revision.
set -euo pipefail

echo "=== Rolling back aiow-api ==="
kubectl rollout undo deployment/aiow-api -n aiow
kubectl rollout status deployment/aiow-api -n aiow --timeout=180s

echo "=== Rolling back aiow-worker ==="
kubectl rollout undo deployment/aiow-worker -n aiow
kubectl rollout status deployment/aiow-worker -n aiow --timeout=180s

echo "=== Rolling back aiow-web ==="
kubectl rollout undo deployment/aiow-web -n aiow
kubectl rollout status deployment/aiow-web -n aiow --timeout=180s

echo ""
echo "=== Current pod state ==="
kubectl get pods -n aiow

echo ""
echo "✓ Rollback complete. Verify with deploy/smoke-test.sh API_BASE=https://api.aiow.app"
echo ""
echo "NOTE: If the rollback targets a migration-incompatible schema, restore from DB"
echo "snapshot taken before deploy (see PRODUCTION_PLAYBOOK.md §4 for restore steps)."
