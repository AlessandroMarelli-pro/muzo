#!/bin/bash
# One-time creation of the ai-service Hugging Face Inference Endpoint.
# Only run this if the endpoint doesn't exist yet (or was deleted) -- for
# picking up a new image on an EXISTING endpoint, use ./deploy-hf.sh instead.
#
# Requires: hf CLI, authenticated (`hf auth login`) with a token that has
# "Manage Inference Endpoints" permission.
#
# Usage: GEMINI_API_KEY=xxx LAST_FM_API_KEY=xxx LAST_FM_SECRET_KEY=xxx \
#          ./create-hf-endpoint.sh
#   * GEMINI_API_KEY (optional) -- omit to deploy with LLM filename-cleaning
#     disabled; ai-service degrades to using filenames as-is.
#   * LAST_FM_API_KEY / LAST_FM_SECRET_KEY (optional) -- the album-art fallback
#     chain (Apple Music -> Bandcamp -> Last.fm -> MusicBrainz) skips Last.fm
#     when these are unset; the other three sources still run.

set -euo pipefail

ENDPOINT_NAME="muzo-ai-service-cpu"
IMAGE="ghcr.io/alessandromarelli-pro/muzo/ai-service-cpu:latest"

# --repo is required by the deploy API even for a fully custom Docker image
# (--custom-image) where no Hub repo/weights are actually used -- gpt2 is an
# inert placeholder to satisfy that required argument, nothing in ai-service
# reads from it.
DEPLOY_ARGS=(
  "$ENDPOINT_NAME"
  --repo openai-community/gpt2
  --framework custom
  --task custom
  --accelerator cpu
  --instance-type intel-spr
  --instance-size x4
  --region eu-west-1
  --vendor aws
  --custom-image "$IMAGE"
  --health-route /api/v1/health
  --port 4000
  # The backend runs the audio-scan queue at AUDIO_SCAN_CONCURRENCY, firing
  # several concurrent batch requests. Each replica now processes ONE batch at a
  # time (analysis lock), so concurrency = replica count. min-replica 2 keeps two
  # warm to absorb the first requests without a cold start; the scaler adds up to
  # max-replica for the rest. Bump both if scans routinely queue.
  --min-replica 2
  --max-replica 4
  #--scale-to-zero-timeout 15
  # Scale on queued (pending) requests rather than hardware usage -- batch
  # analysis is bursty and a replica looks busy well before CPU saturates.
  --scaling-metric pendingRequests
  --scaling-threshold 2.5
  --env ENABLE_SIMPLE_ANALYSIS=true
  # ONE gunicorn worker per replica (gthread class -- see gunicorn.conf.py). The
  # per-file model inference is serialized behind a process-wide lock so it runs
  # at full speed; a 2nd worker only added CPU contention (per-file 22s -> 31s)
  # and, being blocked in native TF code, couldn't answer /api/v1/health -> HF
  # killed the replica mid-batch. Cross-replica parallelism comes from the
  # scaler below.
  --env WEB_CONCURRENCY=1
  # Native thread pools (TF / OpenMP / BLAS / torch) = the full 8 vCPU, since
  # only one analysis runs at a time. See src/config/threads.py.
  --env ANALYSIS_THREADS=8
  # No Redis is reachable from the endpoint -- make ScanProgressPublisher /
  # RedisCache no-op instead of retrying a refused localhost connection on every
  # call. Real-time scan progress is disabled as a result (it already was).
  --env DISABLE_REDIS=true
  --type authenticated
)

if [ -n "${GEMINI_API_KEY:-}" ]; then
  DEPLOY_ARGS+=(--secrets "GEMINI_API_KEY=$GEMINI_API_KEY")
else
  echo "==> No GEMINI_API_KEY provided -- deploying with Gemini filename cleaning disabled"
fi

if [ -n "${LAST_FM_API_KEY:-}" ] && [ -n "${LAST_FM_SECRET_KEY:-}" ]; then
  DEPLOY_ARGS+=(--secrets "LAST_FM_API_KEY=$LAST_FM_API_KEY" \
                          "LAST_FM_SECRET_KEY=$LAST_FM_SECRET_KEY")
else
  echo "==> No LAST_FM_API_KEY/LAST_FM_SECRET_KEY -- album-art Last.fm source disabled"
fi

echo "==> Deploying $ENDPOINT_NAME"
hf endpoints deploy "${DEPLOY_ARGS[@]}"

echo
echo "==> Endpoint created. Update backend/.env's AI_SERVICE_URL to the URL above,"
echo "    and AI_SERVICE_TOKEN to a token with inference permission for this endpoint."
