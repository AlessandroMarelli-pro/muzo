"""
Process-trace logging for the AI service.

A thin wrapper around loguru that emits INFO-level lines in a fixed
``[file] <message>`` format, used *only* to trace the shape of a process:
its start, the step boundaries, its end -- each with timings.

Everything else (diagnostics, lifecycle chatter, health checks) belongs at
DEBUG. The trace stream is what you watch in production at the default
``LOG_LEVEL=INFO``.

Usage::

    from src.utils.trace import trace, trace_start

    h = trace_start("simple_analysis", file="simple_analysis", filename=name)
    with h.step("load track"):
        ...
    h.done(processing_time=pt)

    # or a one-off line
    trace("file 3/12 done in 1.204s", file="simple_analysis")
"""

import os
import time
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from loguru import logger

# Records carrying extra["trace"] are formatted distinctly in configure_logging().
_trace_logger = logger.bind(trace=True)

# Allow disabling the trace stream entirely without touching code.
_ENABLED = os.environ.get("TRACE_ENABLED", "true").lower() == "true"

# The track currently being processed on this thread/task. Set via
# `with track_context(name):` at the analysis entry points so that every trace
# line emitted underneath -- including the generic `[perf]` lines from
# monitor_performance, which have no track argument of their own -- is prefixed
# with `(track)`. Safe under the batch ThreadPoolExecutor: contextvars are
# per-thread and each worker copies the context at submit time.
_current_track: ContextVar[str | None] = ContextVar("_current_track", default=None)


@contextmanager
def track_context(name: str | None):
    """Tag every trace line emitted in this block with the given track name."""
    token = _current_track.set(name or None)
    try:
        yield
    finally:
        _current_track.reset(token)


def _track_prefix() -> str:
    t = _current_track.get()
    return f"({t}) " if t else ""


def _caller_file(depth: int = 2) -> str:
    """Basename (no extension) of the module `depth` frames up the stack."""
    try:
        import inspect

        frame = inspect.stack()[depth]
        return Path(frame.filename).stem
    except Exception:
        return "?"


def trace(message: str, *, file: str | None = None) -> None:
    """Emit a single ``[file] <message>`` trace line at INFO."""
    if not _ENABLED:
        return
    tag = file or _caller_file()
    _trace_logger.info(f"[{tag}] {_track_prefix()}{message}")


def _fmt_ctx(ctx: dict) -> str:
    if not ctx:
        return ""
    return " " + " ".join(f"{k}={v}" for k, v in ctx.items())


class _Step:
    def __init__(self, handle: "TraceHandle", name: str):
        self._handle = handle
        self._name = name
        self._start = time.perf_counter()

    def done(self, **ctx) -> float:
        elapsed = time.perf_counter() - self._start
        self._handle._emit(
            f"{self._handle.process} . {self._name} done in {elapsed:.3f}s"
            + _fmt_ctx(ctx)
        )
        return elapsed


class TraceHandle:
    def __init__(self, process: str, file: str | None):
        self.process = process
        self.file = file or _caller_file(depth=3)
        self._start = time.perf_counter()

    def _emit(self, message: str) -> None:
        if _ENABLED:
            _trace_logger.info(f"[{self.file}] {_track_prefix()}{message}")

    @contextmanager
    def step(self, name: str, **ctx):
        """Context manager: logs step-before, then step-after with timing."""
        self._emit(f"{self.process} . {name}" + _fmt_ctx(ctx))
        s = _Step(self, name)
        try:
            yield s
        finally:
            s.done()

    def note(self, message: str) -> None:
        self._emit(f"{self.process} . {message}")

    def done(self, **ctx) -> float:
        elapsed = time.perf_counter() - self._start
        self._emit(f"END {self.process} in {elapsed:.3f}s" + _fmt_ctx(ctx))
        return elapsed


def trace_start(process: str, *, file: str | None = None, **ctx) -> TraceHandle:
    """Begin a traced process; returns a handle for ``.step()`` / ``.done()``."""
    h = TraceHandle(process, file)
    h._emit(f"START {process}" + _fmt_ctx(ctx))
    return h
