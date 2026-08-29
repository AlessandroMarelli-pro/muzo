"""
gunicorn config for ai-service. Used by docker/essentia-cpu.Dockerfile
(`gunicorn -c gunicorn.conf.py wsgi:app`).

Why this exists: the default `python app.py` runs Werkzeug's dev server, which
serves one request at a time. A single HF Inference Endpoint replica then
serializes concurrent batch-analysis calls, so raising the backend's
AUDIO_SCAN_CONCURRENCY past 1 only helps to the extent HF autoscaling spins up
*more* replicas. gunicorn lets one replica use its whole box.

Why `sync` workers (separate processes), NOT `gthread`/threads:
  the per-file audio analysis path calls into audioflux's native
  BFT/Onset/Spectral routines (audioflux bundles its own OpenMP runtime + uses
  Apple's Accelerate), which are NOT thread-safe -- calling them from multiple
  threads in one process reproducibly SIGBUSes (~40% crash rate; see the
  BATCH_AUDIO_WORKERS comment in src/services/simple_analysis.py). Separate
  processes each get their own native runtime state, so process-level
  concurrency is safe where thread-level isn't.

Memory: each worker lazily loads its own copy of the essentia/TF + torch models
on its first request (models are class-level singletons *per process*, loaded
lazily -- see e.g. src/services/features/discogs_embedding_extractor.py, so
--preload would not share them). On the HF `intel-spr x4` instance (8 vCPU /
16 GB) keep WEB_CONCURRENCY modest -- default 2, raise cautiously and watch the
endpoint's memory graph.
"""

import os

# HF Inference Endpoint expects the app on the --port passed at deploy time (4000).
bind = f"0.0.0.0:{os.getenv('FLASK_PORT', '4000')}"

# Worker processes. `WEB_CONCURRENCY` is gunicorn's conventional env var.
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
worker_class = "sync"  # see module docstring -- native libs are not thread-safe

# Batch audio analysis is slow (per-file model inference over up to 10 files).
# Give a worker plenty of head-room before gunicorn kills it as hung. The
# backend's own axios timeout (AI_SERVICE_TIMEOUT * fileCount) is the real
# request deadline.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "600"))
graceful_timeout = 60

# Recycle workers periodically to bound native-allocator fragmentation from
# repeated large audio buffers / TF sessions (the dev-server path already does
# manual gc + periodic thread-pool refresh for the same reason).
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "200"))
max_requests_jitter = 20

# Uploads are multipart audio files; don't let gunicorn buffer whole bodies in a
# way that trips its default limits.
limit_request_line = 0
limit_request_field_size = 0

# Route gunicorn's own logs to stdout/stderr (loguru handles app logs).
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()
