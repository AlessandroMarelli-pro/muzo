"""Unit tests for the spectral fake-lossless verifier.

Uses synthetic broadband noise instead of real files: genuine lossless has
energy up to Nyquist, a lossy transcode has a hard low-pass shelf. We simulate
the transcode by brick-wall filtering white noise in the frequency domain.
"""

import numpy as np
import pytest

from src.services.features.lossless_verifier import LosslessVerifier

SR = 44100
DURATION_S = 4.0


def _white_noise(n: int, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    y = rng.standard_normal(n).astype(np.float64)
    return y / np.abs(y).max()


def _lowpass(y: np.ndarray, sr: int, cutoff_hz: float) -> np.ndarray:
    spec = np.fft.rfft(y)
    freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
    spec[freqs > cutoff_hz] = 0.0
    out = np.fft.irfft(spec, n=len(y))
    return out / (np.abs(out).max() + 1e-12)


@pytest.fixture
def verifier():
    return LosslessVerifier()


def test_genuine_broadband_noise_is_verified(verifier):
    y = _white_noise(int(SR * DURATION_S))
    verdict = verifier.verify_samples(y, SR)
    assert verdict.verified is True
    assert verdict.cutoff_hz >= 20000.0


def test_128kbps_style_transcode_is_flagged(verifier):
    y = _lowpass(_white_noise(int(SR * DURATION_S)), SR, cutoff_hz=16000.0)
    verdict = verifier.verify_samples(y, SR)
    assert verdict.verified is False
    assert 14000.0 <= verdict.cutoff_hz <= 17500.0


def test_v0_style_transcode_is_flagged(verifier):
    y = _lowpass(_white_noise(int(SR * DURATION_S)), SR, cutoff_hz=18500.0)
    verdict = verifier.verify_samples(y, SR)
    assert verdict.verified is False


def test_empty_audio_is_not_verified(verifier):
    verdict = verifier.verify_samples(np.array([]), SR)
    assert verdict.verified is False
