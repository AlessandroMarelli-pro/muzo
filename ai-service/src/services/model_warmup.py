"""
Per-worker model warmup.

Every feature extractor in `src/services/features/` loads its TF graph / torch
checkpoint lazily on first use and caches it as a class-level singleton *per
process*. With gunicorn `sync` workers and no `--preload` (see
`gunicorn.conf.py`), that means the FIRST real request each worker handles pays
the full cost of loading ~13 TF graphs plus the S-KEY torch checkpoint --
measured at ~15-20s on top of the ~30s the analysis itself takes, so a cold
first request is ~50s.

`warm_all_models()` forces every load ahead of time (from a gunicorn `post_fork`
hook) using a few seconds of silence, so the first real request is only as slow
as a warm one. Worker recycling (`max_requests`) re-triggers this, which is why
`max_requests` is also raised.

Ordering matters: S-KEY's module docstring documents that `import torch` before
audioflux has done a real computation in the process can segfault (native
FFT/threading-runtime symbol collision -- historically seen with Apple's
Accelerate; low risk on the Linux container but cheap to avoid). So we do a
throwaway audioflux BFT on silence *before* touching the S-KEY extractor.
"""

import time

import numpy as np
from loguru import logger

_WARM_SR = 16000
_WARM_SECONDS = 3
_DID_WARM = False


def _warm_audioflux() -> None:
    """Run one real audioflux computation so torch can be imported safely
    afterwards (see module docstring)."""
    import audioflux as af
    from audioflux.type import SpectralDataType, SpectralFilterBankScaleType

    silence = np.zeros(_WARM_SR * _WARM_SECONDS, dtype=np.float32)
    bft = af.BFT(
        num=2048,
        samplate=_WARM_SR,
        radix2_exp=12,
        slide_length=1024,
        data_type=SpectralDataType.MAG,
        scale_type=SpectralFilterBankScaleType.LINEAR,
    )
    bft.bft(silence)
    del bft


def warm_all_models() -> None:
    """Load every analysis model into this process. Idempotent; never raises --
    a warmup failure must not stop the worker from booting (the lazy path will
    just pay the cost on first request, as it does today)."""
    global _DID_WARM
    if _DID_WARM:
        return
    _DID_WARM = True

    start = time.time()
    logger.info("Warming analysis models for this worker...")

    silence_16k = np.zeros(_WARM_SR * _WARM_SECONDS, dtype=np.float32)

    # 1. discogs-effnet embedding (also produces the embedding the classifier
    #    heads need).
    embedding = []
    try:
        from src.services.features.discogs_embedding_extractor import (
            DiscogsEmbeddingExtractor,
        )

        embedding = DiscogsEmbeddingExtractor().extract_from_audio(
            silence_16k, _WARM_SR
        )
    except Exception as e:
        logger.warning(f"Warmup: discogs-effnet embedding failed: {e}")

    # 2. All 10 discogs-effnet classifier heads (7 binary + 3 multi-label).
    try:
        from src.services.features.discogs_classifiers_extractor import (
            DiscogsClassifiersExtractor,
        )

        warm_embedding = embedding or [0.0] * 1280
        DiscogsClassifiersExtractor().predict_all(warm_embedding)
    except Exception as e:
        logger.warning(f"Warmup: discogs classifier heads failed: {e}")

    # 3. TempoCNN (own 11025 Hz rate -- resamples internally).
    try:
        from src.services.features.tempo_cnn_extractor import TempoCnnExtractor

        TempoCnnExtractor().extract_from_audio(silence_16k, _WARM_SR)
    except Exception as e:
        logger.warning(f"Warmup: TempoCNN failed: {e}")

    # 4. DEAM (MSD-MusiCNN embedding + DEAM regression head, both 16 kHz).
    try:
        from src.services.features.deam_extractor import DeamExtractor

        DeamExtractor().extract(silence_16k)
    except Exception as e:
        logger.warning(f"Warmup: DEAM failed: {e}")

    # 5. audioflux real computation, THEN S-KEY (imports torch) -- see docstring.
    try:
        _warm_audioflux()
    except Exception as e:
        logger.warning(f"Warmup: audioflux priming failed: {e}")

    try:
        from src.services.features.skey_extractor import SkeyExtractor

        SkeyExtractor().extract_from_audio(silence_16k, _WARM_SR)
    except Exception as e:
        logger.warning(f"Warmup: S-KEY failed: {e}")

    logger.info(f"Analysis models warmed in {time.time() - start:.1f}s")
