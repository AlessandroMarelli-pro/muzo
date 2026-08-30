"""
CPU thread-count pinning for the native numeric stack (TensorFlow, OpenMP/BLAS,
librosa's resampler, torch).

Why this module exists and why it must be imported FIRST:
  TF, numpy's BLAS backend, and torch each read their thread-count knobs from the
  environment exactly once, at import time. If nothing sets them, each pool sizes
  itself to the full CPU count and, with more than one analysis in flight, they
  oversubscribe (measured on 2 sync workers: per-stage times ~2x, per-file
  22s -> 31s).

  Each gunicorn worker serializes its analyses behind a process-wide lock
  (gunicorn.conf.py + src/api/batch_simple_analysis.py), so within a worker
  exactly one analysis runs at a time and should get ANALYSIS_THREADS cores.
  Size it as vCPU / WEB_CONCURRENCY: the HF `intel-spr x8` deploy runs 2 workers
  on 16 vCPU with ANALYSIS_THREADS=8 (2 concurrent tracks, 8 threads each, no
  oversubscription). A single-worker `x4` deploy would use ANALYSIS_THREADS=8.

torch note: torch's intra-op pool does NOT reliably read OMP_NUM_THREADS at
import -- callers that run torch models (src/services/features/skey_extractor.py)
must additionally call `torch.set_num_threads(analysis_threads())` right after
`import torch`, or S-KEY runs on 1-2 threads regardless of what's set here
(measured: 9.8s -> ~3s on the intel-spr box once pinned).

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

# Quieten TF's startup chatter (the INFO lines about oneDNN / CPU features).
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# oneDNN: ON by default now. On the HF `intel-spr` box (Sapphire Rapids: AVX-512
# + AMX) oneDNN gives every TF model stage a meaningful speedup -- measured
# ~1.3-1.9x on the discogs-effnet embedding + classifier heads, the pipeline's
# heaviest TF work. Its startup log warns it "may cause slightly different
# numeric results due to floating-point round-off" from op reordering; for this
# pipeline's outputs (softmax classification -> argmax genre/mood labels, tempo
# to 1 BPM, valence/arousal to 2 dp) that drift is below the reported precision
# and does not change any label. Set TF_ENABLE_ONEDNN_OPTS=0 at deploy time to
# force bit-for-bit reproducibility back on if a downstream consumer needs it.
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "1")


def analysis_threads() -> int:
    """The pinned thread count, for callers that need it as an int (e.g.
    `torch.set_num_threads`)."""
    try:
        return max(1, int(os.getenv("ANALYSIS_THREADS", "8")))
    except ValueError:
        return 8
