#!/bin/bash
# Rebuild the ai-service GPU image and redeploy it to the GPU Hugging Face
# Inference Endpoint. GPU counterpart to ./deploy-hf.sh (CPU) -- kept separate,
# targets a separate workflow + endpoint. Requires: gh CLI (authenticated),
# hf CLI (authenticated, `hf auth login`), and push access to the muzo repo.
#
# Usage: ./deploy-hf-gpu.sh [--skip-gh]
#
#   --skip-gh   Skip the GitHub Actions build (steps 1-2) and go straight to
#               the HF redeploy. Use when :latest is already up to date.
#
# What this does:
#   1. Triggers the ai-service-gpu-image.yml GitHub Actions workflow (builds
#      + pushes ghcr.io/.../ai-service-gpu:latest).
#   2. Waits for the build to finish.
#   3. Pauses + resumes the HF endpoint so it pulls the fresh :latest image
#      (HF caches the image per-instance; a redeploy doesn't happen just
#      because you rebuilt and re-pushed the same tag).
#   4. Polls until the endpoint is running, then hits its health route.
#
# Endpoint config (accelerator, instance size, env vars, etc.) is set once at
# creation via `hf endpoints deploy` and isn't repeated here -- see
# create-hf-endpoint-gpu.sh (or `hf endpoints describe muzo-ai-service-gpu`) if
# you need to recreate the endpoint from scratch. env vars in particular can't
# be changed via `hf endpoints update` -- delete + re-run create-hf-endpoint-gpu.sh.

set -euo pipefail

ENDPOINT_NAME="muzo-ai-service-gpu"
WORKFLOW="ai-service-gpu-image.yml"
REPO="AlessandroMarelli-pro/muzo"

SKIP_GH=false
for arg in "$@"; do
  case "$arg" in
    --skip-gh) SKIP_GH=true ;;
    *) echo "Unknown argument: $arg" >&2; echo "Usage: ./deploy-hf-gpu.sh [--skip-gh]" >&2; exit 1 ;;
  esac
done

if [ "$SKIP_GH" = true ]; then
  echo "==> Skipping GitHub Actions build (--skip-gh)"
else
  echo "==> Triggering $WORKFLOW"
  gh workflow run "$WORKFLOW"
  sleep 5

  RUN_ID=$(gh run list --workflow="$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId')
  echo "==> Watching run $RUN_ID"
  gh run watch "$RUN_ID" --exit-status
  echo "==> Build succeeded"
fi

echo "==> Redeploying $ENDPOINT_NAME"
hf endpoints pause "$ENDPOINT_NAME" >/dev/null 2>&1 || true
hf endpoints resume "$ENDPOINT_NAME" >/dev/null

echo "==> Waiting for endpoint to come up"
for i in $(seq 1 30); do
  STATE=$(hf endpoints describe "$ENDPOINT_NAME" | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['state'])")
  echo "  check $i: $STATE"
  if [ "$STATE" = "running" ] || [ "$STATE" = "failed" ]; then
    break
  fi
  sleep 15
done

if [ "$STATE" != "running" ]; then
  echo "==> Endpoint did not reach 'running' (state: $STATE) -- check logs on the HF dashboard"
  echo "    (GPU cold starts are slower: image pull + CUDA init + per-worker model warmup)"
  exit 1
fi

URL=$(hf endpoints describe "$ENDPOINT_NAME" | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['url'])")
TOKEN=$(hf auth token)

echo "==> Health check: $URL"
curl -s -H "Authorization: Bearer $TOKEN" "$URL/api/v1/health"
echo
echo "==> Done. Endpoint URL: $URL"
echo "    (update backend/.env's AI_SERVICE_URL if it changed)"
