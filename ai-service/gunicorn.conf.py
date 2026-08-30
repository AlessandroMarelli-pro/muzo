"""
gunicorn config for ai-service. Used by docker/essentia-cpu.Dockerfile
(`gunicorn -c gunicorn.conf.py wsgi:app`).

Why this exists: the default `python app.py` runs Werkzeug's dev server, which
serves one request at a time AND blocks health checks while an analysis runs.

Concurrency model (revised after measuring under real scan load):
  ONE worker, gthread class, a few threads, and ANALYSIS_THREADS pinned to the
  whole box (8). The actual per-file analysis is serialized behind a process-wide
  lock (src/api/batch_simple_analysis.py) so exactly one analysis runs at a time
  and gets all 8 vCPUs -- no CPU contention, predictable ~18-20s/file.

  Earlier this ran 2 `sync` workers. Measured result: two concurrent batch
  requests each spun their own TF/torch/librosa thread pools and oversubscribed
  the 8 vCPUs -- per-stage times ~2x'd (DEAM hit 12s, per-file 31s), and because
  a `sync` worker blocked in native TF code cannot accept the /api/v1/health
  TCP connection, HF's health probe timed out and killed the replica mid-batch
  ("Handling signal: term").

  gthread fixes the health-check starvation: the analysis holds the GIL only in
  Python, releasing it during the long native TF/numpy calls, so a sibling
  gthread accepts and answers the (trivial, sub-ms) health request in those
  windows. The analysis lock keeps two analyses from ever running concurrently,
  so gthread never actually parallelizes the native audio code (which is why the
  old "sync only, native libs aren't thread-safe" rule doesn't bite here --
  audioflux computation isn't on the current request path anyway; see
  src/services/simple_audio_loader.py, only the dead smart-loading helpers call
  it).

  Cross-replica parallelism still comes from HF autoscaling (min/max-replica in
  create-hf-endpoint.sh) -- the backend's AUDIO_SCAN_CONCURRENCY requests queue
  on the lock within a replica and spread across replicas via HF's scaler.

Memory: the single worker lazily loads one copy of the essentia/TF + torch
models (class-level singletons per process). ~2-3 GB resident on the HF
`intel-spr x4` (8 vCPU / 16 GB) -- one worker is well within budget.

Warmup: the post_fork hook warms every model before the worker takes traffic --
otherwise the first real request pays ~15-20s of graph loading on top of the
analysis. max_requests is high so the re-warm on recycle is rare. Disable with
WARM_MODELS_ON_FORK=false.

Threads: src/config/threads.py (imported first by app.py / wsgi.py) pins the
native pools to ANALYSIS_THREADS. With one worker holding the analysis lock,
ANALYSIS_THREADS should be the full vCPU count (8).
"""

import os

# HF Inference Endpoint expects the app on the --port passed at deploy time (4000).
bind = f"0.0.0.0:{os.getenv('FLASK_PORT', '4000')}"

# One worker (see module docstring). Analyses are serialized behind an in-process
# lock, so a second worker would only add model-memory pressure and CPU
# contention. Cross-replica parallelism comes from HF autoscaling.
workers = int(os.getenv("WEB_CONCURRENCY", "1"))

# gthread, not sync: a sync worker blocked in a 20-30s native analysis cannot
# accept the health-check connection, so HF's probe times out and kills the
# replica. gthread lets a sibling thread answer /health during the native
# call's GIL-release windows. The analysis lock still prevents two analyses
# running at once.
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")

# Enough threads that health checks are never starved: 1 runs the (serialized)
# analysis, several may hold queued batch POSTs blocked on the analysis lock,
# and there must still be a free thread to accept + answer /api/v1/health during
# a 20-30s analysis. 8 gives generous headroom (threads blocked on a lock or in
# native GIL-released code are nearly free).
threads = int(os.getenv("GUNICORN_THREADS", "8"))

# Batch audio analysis is slow (per-file model inference over up to 10 files,
# now serialized). Give plenty of head-room before gunicorn kills a worker as
# hung. The backend's own axios timeout (AI_SERVICE_TIMEOUT * fileCount) is the
# real request deadline.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "1200"))
graceful_timeout = 60

# Recycle the worker periodically to bound native-allocator fragmentation from
# repeated large audio buffers / TF sessions. High, because each recycle re-runs
# the ~15-20s model warmup in post_fork.
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = 50

# Uploads are multipart audio files; don't let gunicorn buffer whole bodies in a
# way that trips its default limits.
limit_request_line = 0
limit_request_field_size = 0

# Route gunicorn's own logs to stdout/stderr (loguru handles app logs).
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()


def post_fork(server, worker):
    """Warm every analysis model in the freshly forked worker so its first real
    request isn't a cold one. See module docstring; disable with
    WARM_MODELS_ON_FORK=false."""
    if os.getenv("WARM_MODELS_ON_FORK", "true").lower() != "true":
        return
    try:
        from src.services.model_warmup import warm_all_models

        warm_all_models()
    except Exception as exc:  # never let warmup stop a worker from booting
        worker.log.warning("post_fork model warmup failed: %s", exc)
