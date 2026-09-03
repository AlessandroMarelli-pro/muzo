"""
Spectral fake-lossless verification.

A FLAC/WAV/AIFF file transcoded from a lossy source (MP3, AAC, ...) keeps the
lossless container but inherits the lossy codec's hard low-pass shelf: above the
encoder cutoff (~16 kHz for 128 kbps MP3, ~19 kHz for V0, ~20 kHz for 256 kbps
AAC) the spectrum drops into the noise floor and stays there. Genuine
CD-sourced lossless has broadband energy up to ~21-22 kHz for 44.1 kHz material.

This module estimates that cutoff from a Welch-averaged power spectral density
and flags a file as "not verified" when the cutoff sits well below Nyquist for
its sample rate.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from loguru import logger
from scipy import signal

from src.services.simple_audio_loader import SimpleAudioLoader

# Energy this many dB below the spectrum peak counts as "noise floor".
_NOISE_FLOOR_DB = -75.0
# A real 44.1 kHz lossless master should carry energy at least this high.
_MIN_EXPECTED_CUTOFF_HZ = 20000.0
# Below this, the file is almost certainly transcoded from a low-bitrate source.
_HARD_FAIL_CUTOFF_HZ = 19000.0


@dataclass
class LosslessVerdict:
    verified: bool
    cutoff_hz: float
    sample_rate: int
    reason: str

    def to_dict(self) -> dict:
        return {
            "verified": self.verified,
            "cutoff_hz": round(self.cutoff_hz, 1),
            "sample_rate": self.sample_rate,
            "reason": self.reason,
        }


class LosslessVerifier:
    def __init__(self, audio_loader: SimpleAudioLoader | None = None):
        self.audio_loader = audio_loader or SimpleAudioLoader()

    def verify_file(self, file_path: str) -> LosslessVerdict:
        y, sr = self.audio_loader.load_audio_sample(file_path, sample_duration=None)
        return self.verify_samples(y, sr)

    def verify_samples(self, y: np.ndarray, sr: int) -> LosslessVerdict:
        if y.size == 0 or sr <= 0:
            return LosslessVerdict(False, 0.0, sr, "empty or unreadable audio")

        cutoff_hz = self._estimate_cutoff_hz(y, sr)
        nyquist = sr / 2.0

        # Sub-44.1 kHz material (rare here) can't be judged against a 20 kHz
        # expectation; only fail it if the cutoff is implausibly low vs its own
        # Nyquist.
        expected = min(_MIN_EXPECTED_CUTOFF_HZ, nyquist * 0.9)

        if cutoff_hz >= expected:
            return LosslessVerdict(
                True, cutoff_hz, sr,
                f"broadband to {cutoff_hz / 1000:.1f} kHz (>= {expected / 1000:.1f} kHz expected)",
            )

        hard = min(_HARD_FAIL_CUTOFF_HZ, nyquist * 0.85)
        if cutoff_hz < hard:
            return LosslessVerdict(
                False, cutoff_hz, sr,
                f"spectrum rolls off at {cutoff_hz / 1000:.1f} kHz - likely transcoded from lossy",
            )

        # Borderline: between hard-fail and expected. Treat as unverified but
        # flag the ambiguity so callers can keep the file if nothing better.
        return LosslessVerdict(
            False, cutoff_hz, sr,
            f"cutoff at {cutoff_hz / 1000:.1f} kHz is below the {expected / 1000:.1f} kHz "
            "expected for genuine lossless (borderline)",
        )

    def _estimate_cutoff_hz(self, y: np.ndarray, sr: int) -> float:
        """Highest frequency whose PSD is still above the noise floor."""
        nperseg = min(len(y), 8192)
        if nperseg < 256:
            return 0.0
        freqs, psd = signal.welch(y, fs=sr, nperseg=nperseg)
        psd_db = 10.0 * np.log10(psd + 1e-20)
        peak_db = np.max(psd_db)
        threshold = peak_db + _NOISE_FLOOR_DB

        above = np.where(psd_db >= threshold)[0]
        if above.size == 0:
            return 0.0
        cutoff = float(freqs[above[-1]])
        logger.debug(
            f"lossless verify: sr={sr} peak={peak_db:.1f}dB "
            f"threshold={threshold:.1f}dB cutoff={cutoff:.0f}Hz"
        )
        return cutoff
