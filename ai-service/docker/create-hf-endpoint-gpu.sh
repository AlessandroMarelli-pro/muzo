#!/bin/bash
# One-time creation of the GPU ai-service Hugging Face Inference Endpoint.
# GPU counterpart to ./create-hf-endpoint.sh (which creates the CPU endpoint) --
# the two are kept as separate scripts / separate endpoints on purpose, so the
# CPU endpoint stays as a known-good fallback while the GPU one is validated.
#
# Only run this if the GPU endpoint doesn't exist yet (or was deleted) -- for
# picking up a new image on an EXISTING endpoint, use ./deploy-hf-gpu.sh.
#
# Requires: hf CLI, authenticated (`hf auth login`) with a token that has
# "Manage Inference Endpoints" permission.
#
# Usage: GEMINI_API_KEY=xxx ./create-hf-endpoint-gpu.sh
# (GEMINI_API_KEY is optional -- omit it to deploy with filename-cleaning
# via Gemini disabled; ai-service degrades to using filenames as-is.)
#
# Prerequisite: the GPU image must already be built + pushed. It is NOT built by
# the CPU workflow -- trigger .github/workflows/ai-service-gpu-image.yml (or run
# ./deploy-hf-gpu.sh, which does that for you).

set -euo pipefail

ENDPOINT_NAME="muzo-ai-service-gpu"
IMAGE="ghcr.io/alessandromarelli-pro/muzo/ai-service-gpu:latest"

# --repo is required by the deploy API even for a fully custom Docker image
# (--custom-image) where no Hub repo/weights are actually used -- gpt2 is an
# inert placeholder to satisfy that required argument, nothing in ai-service
# reads from it.
DEPLOY_ARGS=(
  "$ENDPOINT_NAME"
  --repo openai-community/gpt2
  --framework custom
  --task custom
  --accelerator gpu
  # nvidia-t4 x1: 16 GB GPU / 4 vCPU / 16 GB RAM. The essentia-gpu image targets
  # CUDA 11.8 + TF 2.14 (T4 = Turing, sm_75), and the historical malloc crash
  # this build fixes was reproduced on exactly this instance. Bump to nvidia-l4
  # (Ada, more compute + 24 GB) if T4 throughput is short -- same CUDA arch
  # coverage, no image change needed.
  --instance-type nvidia-t4
  --instance-size x1
  --region eu-west-1
  --vendor aws
  --custom-image "$IMAGE"
  --health-route /api/v1/health
  --port 4000
  # min-replica 1 (not 0): the backend's audio-scan queue runs at
  # AUDIO_SCAN_CONCURRENCY=4, so a scan fires 4 concurrent batch requests. From a
  # cold scale-to-zero state that whole burst would queue behind one
  # cold-starting replica (GPU cold start is slower than CPU -- image pull +
  # CUDA init + per-worker model warmup). Keeping 1 warm absorbs the first
  # requests; HF autoscales up to max-replica for the rest.
  --min-replica 1
  --max-replica 3
  # Scale on queued (pending) requests rather than hardware usage -- batch
  # analysis is bursty and a replica looks busy well before the GPU saturates.
  --scaling-metric pendingRequests
  --scaling-threshold 2.5
  --env ENABLE_SIMPLE_ANALYSIS=true
  # ONE gunicorn worker per replica: unlike the CPU endpoint (2 workers), each
  # worker loads its own full copy of every model onto the GPU, and a single T4
  # (16 GB) does not comfortably hold two independent TF contexts + the torch
  # S-KEY model. One worker owns the GPU. Raise only on a bigger-memory GPU.
  --env WEB_CONCURRENCY=1
  # Native CPU thread pool cap for the non-GPU stages (librosa resample, audioflux,
  # torch S-KEY, BLAS). The T4 instance has 4 vCPU and only 1 gunicorn worker, so
  # give it all 4. See src/config/threads.py.
  --env ANALYSIS_THREADS=4
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

echo "==> Deploying $ENDPOINT_NAME (GPU)"
hf endpoints deploy "${DEPLOY_ARGS[@]}"

echo
echo "==> Endpoint created. Update backend/.env's AI_SERVICE_URL to the URL above,"
echo "    and AI_SERVICE_TOKEN to a token with inference permission for this endpoint."
echo
echo "==> Watch the first boot log for the GPU malloc crash this image is meant to"
echo "    fix: a clean 'Analysis models warmed in ...s' line (no 'malloc(): invalid"
echo "    size' abort right after 'MLIR V1 optimization pass is not enabled') means"
echo "    the setup_from_python.sh TF fix worked. Confirm TF registered the GPU:"
echo "    the log should NOT say 'Skipping registering GPU devices'."
