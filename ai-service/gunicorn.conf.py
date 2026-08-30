"""
gunicorn config for ai-service. Used by docker/essentia-cpu.Dockerfile
(`gunicorn -c gunicorn.conf.py wsgi:app`).

Why this exists: the default `python app.py` runs Werkzeug's dev server, which
serves one request at a time AND blocks health checks while an analysis runs.

Concurrency model (revised after measuring under real scan load):
  N gthread workers (WEB_CONCURRENCY), each pinned to ANALYSIS_THREADS native
  threads, sized so `WEB_CONCURRENCY * ANALYSIS_THREADS <= vCPU`. Each worker
  serializes ITS OWN analyses behind a per-process lock
  (src/api/batch_simple_analysis.py) -- so a replica runs WEB_CONCURRENCY
  analyses at once, each with the full ANALYSIS_THREADS and no cross-analysis CPU
  contention. Current deploy: `intel-spr x8` (16 vCPU), WEB_CONCURRENCY=2,
  ANALYSIS_THREADS=8 -> 2 analyses/replica, predictable ~15-18s/file each.
  (A single-worker `x4` deploy is the fallback: WEB_CONCURRENCY=1,
  ANALYSIS_THREADS=8.)

  The constraint is `workers * threads <= vCPU`, NOT "one worker". Earlier this
  ran 2 `sync` workers on an x4 (8 vCPU) with UNPINNED thread pools: each spun
  ~8-wide TF/torch/librosa pools -> ~16 threads on 8 cores, per-stage times ~2x'd
  (DEAM hit 12s, per-file 31s). And a `sync` worker blocked in native TF code
  can't accept the /api/v1/health TCP connection -> HF's probe timed out and
  killed the replica mid-batch. Both are fixed here: thread pinning keeps
  workers*threads == vCPU, and gthread lets a sibling thread answer /health
  during the analysis's native GIL-release windows. The per-process lock still
  prevents a single worker from ever running two analyses at once, so gthread
  never parallelizes the (not-actually-thread-safe) native audio code within a
  worker.

  Cross-replica parallelism comes from HF autoscaling (min/max-replica in
  create-hf-endpoint.sh) -- the backend's AUDIO_SCAN_CONCURRENCY requests queue
  on the per-worker locks and spread across replicas via HF's scaler.

Memory: each worker lazily loads its own copy of the essentia/TF + torch models
(class-level singletons per process), ~2-3 GB resident. 2 workers ~= 5-6 GB on
the `intel-spr x8` (32 GB) -- well within budget.

Warmup: the post_fork hook warms every model in each forked worker before it
takes traffic -- otherwise the first real request pays ~15-20s of graph loading
on top of the analysis. max_requests is high so the re-warm on recycle is rare.
Disable with WARM_MODELS_ON_FORK=false.

Threads: src/config/threads.py (imported first by app.py / wsgi.py) pins the
native pools to ANALYSIS_THREADS. Set it to vCPU / WEB_CONCURRENCY.
"""

import os

# HF Inference Endpoint expects the app on the --port passed at deploy time (4000).
bind = f"0.0.0.0:{os.getenv('FLASK_PORT', '4000')}"

# WEB_CONCURRENCY workers (see module docstring). Each serializes its own
# analyses behind a per-process lock, so this is the per-replica analysis
# concurrency. Keep WEB_CONCURRENCY * ANALYSIS_THREADS <= vCPU. Default 1 for a
# bare `python -m gunicorn` run; the x8 deploy passes 2.
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
