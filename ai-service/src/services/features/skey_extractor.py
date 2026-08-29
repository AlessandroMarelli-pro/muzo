import numpy as np
from loguru import logger

# S-KEY (Deezer Research, ICASSP 2025): self-supervised musical key detection.
# Trained on a HCQT (harmonic constant-Q transform) chromagram via ChromaNet,
# outputting a 24-class softmax over {12 major, 12 minor} keys. Verified live this
# session against the package's own ground-truth test file (Chopin nocturne
# labeled "E-flat major" -> predicted "D# Major", same pitch class) and against a
# real library track already analyzed by the existing KeyFinder/tonnetz pipeline
# this session ("2XM - Jesper.flac" -> both agree on C# minor).
#
# Unlike every Essentia-based extractor in this pipeline, this is a standalone
# PyTorch package (not on PyPI -- installed via git+https in requirements.txt,
# see that file for the pinned commit) with its own bundled checkpoint. The
# checkpoint's sample rate is authoritative -- read from ckpt["audio"]["sr"]
# rather than hardcoded, same idiom as TempoCNN/DEAM needing their own rates.
#
# CRITICAL: `torch` must NOT be imported at module level here (or anywhere else
# before audioflux's first real computation runs in a given process) -- verified
# live this session that `import torch` before any actual audioflux call (not
# just `import audioflux`, an actual `BFT(...).bft(...)` computation) reliably
# segfaults the process (reproduced deterministically via faulthandler; root
# cause not isolated further, presumably a native FFT/threading-runtime symbol
# collision, same category as the documented TF/GPU crash in git history).
# Importing torch lazily inside methods, after audioflux has already done real
# work at least once via smart_audio_sample_loading (SimpleAudioLoader) earlier
# in the real pipeline, avoids the crash. Do not hoist this import back to
# module level. (Note: SharedFeatures.extract_shared_features -- another
# audioflux call site -- is no longer invoked by simple_feature_extractor.py as
# of the response-shape trim that dropped spectral_features/rhythm_fingerprint/
# melodic_fingerprint; smart_audio_sample_loading remains the audioflux call
# that establishes safe ordering and still runs before generate_skey() in both
# analyze_audio and _analyze_single_file_in_batch -- verified live.)


class SkeyExtractor:
    """
    Estimates musical key using Deezer's S-KEY model.

    Loaded once (lazily, class-level) and reused across calls, same pattern as
    the other feature extractors in this package. Output is a human-readable key
    string like "C# minor" / "D# Major" (S-KEY's own key_map naming, sharps only
    -- no flat spellings), split into (tonic, mode) here so callers can build
    e.g. Camelot notation the same way the retired KeyFinder path did.
    """

    _checkpoint = None
    _hcqt = None
    _chromanet = None
    _crop_fn = None
    _sample_rate = None
    _device = None

    def __init__(self):
        pass

    def _ensure_loaded(self):
        if SkeyExtractor._chromanet is not None:
            return
        import torch
        from skey.key_detection import load_checkpoint, load_model_components

        logger.info("Loading S-KEY model into memory")
        device = torch.device("cpu")
        checkpoint = load_checkpoint()
        hcqt, chromanet, crop_fn = load_model_components(checkpoint, device)

        SkeyExtractor._checkpoint = checkpoint
        SkeyExtractor._hcqt = hcqt
        SkeyExtractor._chromanet = chromanet
        SkeyExtractor._crop_fn = crop_fn
        SkeyExtractor._sample_rate = checkpoint["audio"]["sr"]
        SkeyExtractor._device = device

    @property
    def sample_rate(self) -> int:
        self._ensure_loaded()
        return SkeyExtractor._sample_rate

    def extract(self, audio: np.ndarray) -> dict:
        """
        Estimate key from mono audio already at the checkpoint's expected
        sample rate (see `sample_rate`).

        Returns {"key": str, "tonic": str, "mode": str} (e.g. {"key": "C#
        minor", "tonic": "C#", "mode": "minor"}), or {} on failure/short audio
        (S-KEY's own inference returns "error" for clips too short for its
        CQT window -- treated as failure here, same as every other extractor's
        never-raise contract).
        """
        try:
            import torch
            from skey.key_detection import infer_key

            self._ensure_loaded()
            waveform = torch.from_numpy(np.asarray(audio, dtype=np.float32)).unsqueeze(0)
            key = infer_key(
                SkeyExtractor._hcqt,
                SkeyExtractor._chromanet,
                SkeyExtractor._crop_fn,
                waveform,
                SkeyExtractor._device,
            )
            if key == "error":
                return {}
            tonic, mode = key.rsplit(" ", 1)
            return {"key": key, "tonic": tonic, "mode": mode.lower()}
        except Exception as e:
            logger.error(f"S-KEY extraction failed: {e}")
            return {}

    def extract_from_audio(self, y: np.ndarray, sr: int) -> dict:
        """
        Resample audio to S-KEY's expected rate and estimate key. Never raises
        -- returns {} on any failure.
        """
        try:
            import librosa

            target_sr = self.sample_rate
            audio = (
                librosa.resample(y, orig_sr=sr, target_sr=target_sr)
                if sr != target_sr
                else y
            )
            return self.extract(np.asarray(audio))
        except Exception as e:
            logger.error(f"S-KEY extraction failed: {e}")
            return {}
