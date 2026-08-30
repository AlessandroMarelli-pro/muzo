"""
CPU thread-count pinning for the native numeric stack (TensorFlow, OpenMP/BLAS,
librosa's resampler, torch).

Why this module exists and why it must be imported FIRST:
  TF, numpy's BLAS backend, and torch each read their thread-count knobs from the
  environment exactly once, at import time. If nothing sets them, each pool sizes
  itself to the full CPU count and, with more than one analysis in flight, they
  oversubscribe (measured on 2 sync workers: per-stage times ~2x, per-file
  22s -> 31s).

  The deployment now runs ONE gunicorn worker with a process-wide analysis lock
  (gunicorn.conf.py + src/api/batch_simple_analysis.py) -- exactly one analysis
  runs at a time, so it should get the whole box. `ANALYSIS_THREADS` defaults to
  8 (the HF `intel-spr x4` vCPU count). If you go back to N concurrent analyses,
  set it to vCPU / N.

Import this at the very top of `app.py` and `wsgi.py`, before anything pulls in
numpy / tensorflow / essentia / torch. `os.environ.setdefault` means an explicit
env var from the deploy (`--env ANALYSIS_THREADS=...`) still wins.
"""

import os

_threads = os.getenv("ANALYSIS_THREADS", "8")

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
    """The pinned thread count, for callers that need it as an int (e.g.
    `torch.set_num_threads`)."""
    try:
        return max(1, int(os.getenv("ANALYSIS_THREADS", "8")))
    except ValueError:
        return 8
