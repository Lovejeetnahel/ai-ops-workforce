#!/usr/bin/env bash
# AIOW Production Deployment Script
# Usage: IMAGE_TAG=v1.0.0 ORG=your-org ./deploy/deploy.sh
# Requires: docker, kubectl (configured for prod cluster), ghcr.io login
set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-latest}"
ORG="${ORG:-your-org}"
API_IMAGE="ghcr.io/${ORG}/aiow-api:${IMAGE_TAG}"
WEB_IMAGE="ghcr.io/${ORG}/aiow-web:${IMAGE_TAG}"

echo "=== [1/6] Building images (tag: ${IMAGE_TAG}) ==="
docker build -f apps/api/Dockerfile -t "${API_IMAGE}" .
docker build -f apps/web/Dockerfile -t "${WEB_IMAGE}" .

echo "=== [2/6] Pushing images ==="
docker push "${API_IMAGE}"
docker push "${WEB_IMAGE}"

echo "=== [3/6] Applying K8s Secret (ensure aiow.yaml has real values) ==="
kubectl apply -f deploy/k8s/aiow.yaml

echo "=== [4/6] Updating image tags ==="
kubectl set image deployment/aiow-api  api="${API_IMAGE}"    -n aiow
kubectl set image deployment/aiow-worker worker="${API_IMAGE}" -n aiow
kubectl set image deployment/aiow-web  web="${WEB_IMAGE}"    -n aiow

echo "=== [5/6] Waiting for rollout ==="
kubectl rollout status deployment/aiow-api    -n aiow --timeout=300s
kubectl rollout status deployment/aiow-worker -n aiow --timeout=300s
kubectl rollout status deployment/aiow-web    -n aiow --timeout=300s

echo "=== [6/6] Verifying pods ==="
kubectl get pods -n aiow

echo ""
echo "✓ Deployment complete. Run deploy/smoke-test.sh to verify."
