"""
CPU thread-count pinning for the native numeric stack (TensorFlow, OpenMP/BLAS,
librosa's resampler, torch).

Why this module exists and why it must be imported FIRST:
  TF, numpy's BLAS backend, and torch each read their thread-count knobs from the
  environment exactly once, at import time. If nothing sets them, each pool sizes
  itself to the full CPU count. On the HF `intel-spr x4` box (8 vCPU) with
  gunicorn running `WEB_CONCURRENCY=2` sync workers, two concurrent batch requests
  then each spin ~8-wide pools -> ~16 threads fighting over 8 cores, cache
  thrash, and every model stage runs slower under load than it does in isolation
  (measured: warm single request ~30s/file, but two concurrent requests are each
  slower than that).

  Pinning each worker to `ANALYSIS_THREADS` (default 4 = 8 vCPU / 2 workers) keeps
  `workers * threads` ~= vCPU so the two workers stop oversubscribing.

Import this at the very top of `app.py` and `wsgi.py`, before anything pulls in
numpy / tensorflow / essentia / torch. `os.environ.setdefault` means an explicit
env var from the deploy (`--env ANALYSIS_THREADS=...`) still wins.
"""

import os

_threads = os.getenv("ANALYSIS_THREADS", "4")

# OpenMP (essentia's TF, audioflux) + the common BLAS backends numpy may use.
for _var in (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "TF_NUM_INTRAOP_THREADS",
):
    os.environ.setdefault(_var, _threads)

# One inter-op thread: the per-file pipeline runs model stages sequentially, so
# there is no independent-subgraph parallelism for TF to exploit here -- extra
# inter-op threads only add contention.
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")

# Quieten TF's startup chatter (the INFO lines about oneDNN / CPU features) and
# disable oneDNN's fast-math reordering -- its own log line warns it changes
# numerical results, which we don't want for reproducible analysis output.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")


def analysis_threads() -> int:
    """The pinned per-worker thread count, for callers that need it as an int
    (e.g. `torch.set_num_threads`)."""
    try:
        return max(1, int(os.getenv("ANALYSIS_THREADS", "4")))
    except ValueError:
        return 4
