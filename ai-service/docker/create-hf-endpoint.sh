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
  # x8 = 16 vCPU / 32 GB. Runs 2 gunicorn workers (WEB_CONCURRENCY=2) each pinned
  # to ANALYSIS_THREADS=8 -> 2 concurrent analyses, 8 threads each, exactly
  # filling 16 vCPU with no oversubscription. 2x per-replica throughput vs the
  # old x4 / 1-worker setup. (Safe now that workers are gthread + each serializes
  # its own analyses behind a per-process lock -- the old 2-sync-worker problem
  # was CPU contention on 8 vCPU + health-check starvation, both gone here.)
  --instance-size x8
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
  # 2 gunicorn workers per replica (gthread -- see gunicorn.conf.py). Each worker
  # serializes its own analyses behind a per-process lock, so this is 2
  # concurrent analyses per replica; with ANALYSIS_THREADS=8 that's 16 threads on
  # the x8's 16 vCPU -- no oversubscription. gthread keeps /api/v1/health
  # answered during the native TF calls (the old 2-sync-worker health starvation
  # is gone). Cross-replica parallelism still comes from the scaler below.
  --env WEB_CONCURRENCY=2
  # Native thread pools (TF / OpenMP / BLAS / torch) PER worker. 2 workers * 8 =
  # 16 = the x8 vCPU count. See src/config/threads.py.
  --env ANALYSIS_THREADS=8
  # No Redis is reachable from the endpoint -- make ScanProgressPublisher /
  # RedisCache no-op instead of retrying a refused localhost connection on every
  # call. Real-time scan progress is disabled as a result (it already was).
  --env DISABLE_REDIS=true
  # S-KEY runs on a bounded mid-track window (it's length-linear and was trained
  # on 15s segments, unlike the patch-pooling discogs/tempo/DEAM models). 90s
  # from 30s in cuts the skey_generation stage ~3-4x. SKEY_WINDOW_S=0 -> full
  # track. Also code defaults in src/services/simple_analysis.py.
  --env SKEY_WINDOW_S=90
  --env SKEY_SKIP_INTRO_S=30
  --type authenticated
)

if [ -n "${GEMINI_API_KEY:-}" ]; then
  DEPLOY_ARGS+=(--secrets "GEMINI_API_KEY=$GEMINI_API_KEY")
else
  echo "==> No GEMINI_API_KEY provided -- deploying with Gemini filename cleaning disabled"
fi

if [ -n "${LAST_FM_API_KEY:-}" ] && [ -n "${LAST_FM_SECRET_KEY:-}" ]; then
  DEPLOY_ARGS+=(--secrets "LAST_FM_API_KEY=$LAST_FM_API_KEY" \
                          --secrets "LAST_FM_SECRET_KEY=$LAST_FM_SECRET_KEY")
else
  echo "==> No LAST_FM_API_KEY/LAST_FM_SECRET_KEY -- album-art Last.fm source disabled"
fi

echo "==> Deploying $ENDPOINT_NAME"
hf endpoints deploy "${DEPLOY_ARGS[@]}"

echo
echo "==> Endpoint created. Update backend/.env's AI_SERVICE_URL to the URL above,"
echo "    and AI_SERVICE_TOKEN to a token with inference permission for this endpoint."
