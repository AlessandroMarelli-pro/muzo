#!/bin/bash
# Rebuild the ai-service CPU image and redeploy it to the Hugging Face
# Inference Endpoint. Requires: gh CLI (authenticated), hf CLI (authenticated,
# `hf auth login`), and push access to the muzo repo.
#
# Usage: ./deploy-hf.sh [--skip-gh]
#
#   --skip-gh   Skip the GitHub Actions build (steps 1-2) and go straight to
#               the HF redeploy. Use when :latest is already up to date.
#
# What this does:
#   1. Triggers the ai-service-cpu-image.yml GitHub Actions workflow (builds
#      + pushes ghcr.io/.../ai-service-cpu:latest). Needed even if you only
#      changed ai-service source code, since the workflow's push-trigger path
#      filter only watches the Dockerfile / requirements.txt / .dockerignore /
#      models/essentia_cache / workflow file -- app code changes don't
#      auto-trigger a build, so this always dispatches it explicitly.
#   2. Waits for the build to finish.
#   3. Pauses + resumes the HF endpoint so it pulls the fresh :latest image
#      (HF caches the image per-instance; a redeploy doesn't happen just
#      because you rebuilt and re-pushed the same tag).
#   4. Polls until the endpoint is running, then hits its health route.
#
# Endpoint config (accelerator, instance size, env vars, scale-to-zero, etc.)
# is set once at creation via `hf endpoints deploy` and isn't repeated here --
# see create-hf-endpoint.sh (or `hf endpoints describe muzo-ai-service-cpu`) if
# you need to recreate the endpoint from scratch.
#
# Changing an EXISTING endpoint's config:
#   * replica / scaling knobs, no redeploy needed:
#       hf endpoints update muzo-ai-service-cpu \
#         --min-replica 1 --max-replica 4 \
#         --scaling-metric pendingRequests --scaling-threshold 2
#   * env vars (e.g. WEB_CONCURRENCY for gunicorn worker count) can't be set via
#     `hf endpoints update` -- delete + re-run create-hf-endpoint.sh, or set the
#     var in the Docker image / gunicorn.conf.py default instead.
#   The gunicorn switch itself (this image's CMD) ships with a normal image
#   redeploy below -- no endpoint config change required.

set -euo pipefail

ENDPOINT_NAME="muzo-ai-service-cpu"
WORKFLOW="ai-service-cpu-image.yml"
REPO="AlessandroMarelli-pro/muzo"

SKIP_GH=false
for arg in "$@"; do
  case "$arg" in
    --skip-gh) SKIP_GH=true ;;
    *) echo "Unknown argument: $arg" >&2; echo "Usage: ./deploy-hf.sh [--skip-gh]" >&2; exit 1 ;;
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
for i in $(seq 1 20); do
  STATE=$(hf endpoints describe "$ENDPOINT_NAME" | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['state'])")
  echo "  check $i: $STATE"
  if [ "$STATE" = "running" ] || [ "$STATE" = "failed" ]; then
    break
  fi
  sleep 15
done

if [ "$STATE" != "running" ]; then
  echo "==> Endpoint did not reach 'running' (state: $STATE) -- check logs on the HF dashboard"
  exit 1
fi

URL=$(hf endpoints describe "$ENDPOINT_NAME" | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['url'])")
TOKEN=$(hf auth token)

echo "==> Health check: $URL"
curl -s -H "Authorization: Bearer $TOKEN" "$URL/api/v1/health"
echo
echo "==> Done. Endpoint URL: $URL"
echo "    (update backend/.env's AI_SERVICE_URL if it changed)"
