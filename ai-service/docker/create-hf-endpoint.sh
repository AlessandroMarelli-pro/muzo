#!/bin/bash
# One-time creation of the ai-service Hugging Face Inference Endpoint.
# Only run this if the endpoint doesn't exist yet (or was deleted) -- for
# picking up a new image on an EXISTING endpoint, use ./deploy-hf.sh instead.
#
# Requires: hf CLI, authenticated (`hf auth login`) with a token that has
# "Manage Inference Endpoints" permission.
#
# Usage: GEMINI_API_KEY=xxx ./create-hf-endpoint.sh
# (GEMINI_API_KEY is optional -- omit it to deploy with filename-cleaning
# via Gemini disabled; ai-service degrades to using filenames as-is.)

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
  --region us-east-1
  --vendor aws
  --custom-image "$IMAGE"
  --health-route /api/v1/health
  --port 4000
  # min-replica 1 (not 0): the backend runs the audio-scan queue at
  # AUDIO_SCAN_CONCURRENCY=4, so a scan fires 4 concurrent batch requests. From
  # a cold scale-to-zero state the whole burst would queue behind one
  # cold-starting replica (tens of seconds). Keeping 1 warm absorbs the first
  # requests immediately; HF autoscales up to max-replica for the rest.
  --min-replica 1
  --max-replica 4
  --scale-to-zero-timeout 15
  # Scale on queued (pending) requests rather than hardware usage -- batch
  # analysis is bursty and a replica looks busy well before CPU saturates.
  --scaling-metric pendingRequests
  --scaling-threshold 2
  --env ENABLE_SIMPLE_ANALYSIS=true
  # gunicorn worker processes per replica (see ai-service/gunicorn.conf.py).
  # 2 on intel-spr x4 (8 vCPU / 16 GB); each worker loads its own model copy.
  --env WEB_CONCURRENCY=2
  --type authenticated
)

if [ -n "${GEMINI_API_KEY:-}" ]; then
  DEPLOY_ARGS+=(--secrets "GEMINI_API_KEY=$GEMINI_API_KEY")
else
  echo "==> No GEMINI_API_KEY provided -- deploying with Gemini filename cleaning disabled"
fi

echo "==> Deploying $ENDPOINT_NAME"
hf endpoints deploy "${DEPLOY_ARGS[@]}"

echo
echo "==> Endpoint created. Update backend/.env's AI_SERVICE_URL to the URL above,"
echo "    and AI_SERVICE_TOKEN to a token with inference permission for this endpoint."
