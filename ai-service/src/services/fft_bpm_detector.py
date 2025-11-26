"""
FFT-based BPM detection algorithm implementation.

This module implements the BPM detection algorithm from:
https://github.com/scaperot/the-BPM-detector-python/blob/master/bpm_detection/bpm_detection.py

The algorithm uses Fast Fourier Transform (FFT) to analyze the frequency domain
and identify dominant frequencies corresponding to tempo.

Enhanced with:
- File loading and chunking capabilities
- Multiple chunk analysis for improved accuracy
- Most frequent BPM selection from chunk results
"""

from typing import List, Optional, Tuple

import numpy as np
from loguru import logger
from scipy import signal

from src.utils.performance_optimizer import monitor_performance


class FFTBPMDetector:
    """
    FFT-based BPM detection using frequency domain analysis.

    This implementation is based on the algorithm from:
    https://github.com/scaperot/the-BPM-detector-python

    Enhanced with file loading, chunking, and most frequent BPM selection.
    """

    @monitor_performance("fft_bpm_detection")
    def detect_bpm(self, y: np.ndarray, sr: int) -> Tuple[float, float]:
        """
        Detect BPM using FFT-based frequency analysis.

        Args:
            y: Audio data (mono)
            sr: Sample rate

        Returns:
            Estimated BPM
        """
        try:
            logger.info("Starting FFT-based BPM detection")
            # Ensure mono audio
            if y.ndim > 1:
                y = np.mean(y, axis=1)

            # First FFT: Larger window for better frequency resolution
            window_size_1 = 4096  # Larger for better frequency resolution
            hop_size_1 = 1024

            # Second FFT: Different window for cross-validation
            window_size_2 = 8192  # Even larger for maximum resolution
            hop_size_2 = 2048

            # Compute both STFTs
            stft1 = self._compute_stft(y, sr, window_size_1, hop_size_1)
            stft2 = self._compute_stft(y, sr, window_size_2, hop_size_2)

            # Compute onset strength for both
            onset1 = self._compute_onset_strength(stft1)
            onset2 = self._compute_onset_strength(stft2)

            # Compute autocorrelations
            autocorr1 = self._compute_autocorrelation(onset1)
            autocorr2 = self._compute_autocorrelation(onset2)

            # Average the autocorrelations for better peak detection
            # Interpolate to same length if needed
            min_len = min(len(autocorr1), len(autocorr2))
            autocorr1 = autocorr1[:min_len]
            autocorr2 = autocorr2[:min_len]

            averaged_autocorr = (autocorr1 + autocorr2) / 2

            # Find peaks in averaged spectrum
            peaks = self._find_peaks(averaged_autocorr, sr, hop_size_1, 70, 170)

            # Select best BPM
            bpm, strength = self._select_best_bpm(peaks, 70, 170)

            return float(bpm), float(strength)

        except Exception as e:
            logger.error(f"FFT BPM detection failed: {e}")
            return 120.0  # Default fallback

    def _get_most_frequent_bpm(self, bpm_list: List[float]) -> float:
        """
        Get the most frequent BPM from a list of BPM values.

        Args:
            bpm_list: List of BPM values

        Returns:
            Most frequent BPM value
        """
        if not bpm_list:
            return 120.0

        # Use numpy to find most frequent value
        unique_values, counts = np.unique(bpm_list, return_counts=True)
        most_frequent_idx = np.argmax(counts)
        most_frequent_bpm = unique_values[most_frequent_idx]

        logger.debug(
            f"Most frequent BPM: {most_frequent_bpm:.1f} (appears {counts[most_frequent_idx]} times)"
        )

        return float(most_frequent_bpm)

    def _compute_stft(
        self, y: np.ndarray, sr: int, window_size: int, hop_size: int
    ) -> np.ndarray:
        """Compute Short-Time Fourier Transform."""
        # Use scipy's spectrogram for STFT computation
        freqs, times, stft = signal.spectrogram(
            y,
            fs=sr,
            window="hann",
            nperseg=window_size,
            noverlap=window_size - hop_size,
            mode="magnitude",
        )
        return stft

    def _compute_onset_strength(self, stft: np.ndarray) -> np.ndarray:
        """Compute onset strength function from STFT."""
        # Sum across frequency bins to get time-domain onset strength
        onset_strength = np.sum(stft, axis=0)

        # Apply smoothing to reduce noise
        onset_strength = signal.savgol_filter(onset_strength, 5, 2)

        return onset_strength

    def _compute_autocorrelation(self, onset_strength: np.ndarray) -> np.ndarray:
        """Compute autocorrelation of onset strength function."""
        # Normalize the signal
        onset_strength = onset_strength - np.mean(onset_strength)

        # Compute autocorrelation
        autocorr = np.correlate(onset_strength, onset_strength, mode="same")
        autocorr = autocorr[autocorr.size // 2 :]

        # Normalize autocorrelation
        autocorr = autocorr / np.max(autocorr)

        return autocorr

    def _find_peaks(
        self,
        autocorr: np.ndarray,
        sr: int,
        hop_size: int,
        min_bpm: float,
        max_bpm: float,
    ) -> list:
        """Find peaks in autocorrelation corresponding to BPM range."""
        # Convert BPM range to lag range
        min_lag = int(60 * sr / (max_bpm * hop_size))
        max_lag = int(60 * sr / (min_bpm * hop_size))

        # Limit to valid range
        min_lag = max(min_lag, 1)
        max_lag = min(max_lag, len(autocorr) - 1)

        # Find peaks in the specified range
        peaks, properties = signal.find_peaks(
            autocorr[min_lag:max_lag],
            height=0.05,  # Lower minimum peak height for better sensitivity
            distance=1,  # Smaller minimum distance for more peaks
        )
        # Convert peak indices back to BPM
        bpm_peaks = []
        for peak in peaks:
            lag = peak + min_lag
            bpm = 60 * sr / (lag * hop_size)
            # Round BPM to 1 decimal place for cleaner results
            bpm = round(bpm, 1)
            if min_bpm <= bpm <= max_bpm:
                bpm_peaks.append((bpm, autocorr[lag]))

        return bpm_peaks

    def _select_best_bpm(self, peaks: list, min_bpm: float, max_bpm: float) -> float:
        """Select the best BPM from detected peaks using musical context."""
        if not peaks:
            logger.warning("No BPM peaks found, using default")
            return 0.0, 0.0

        # Sort peaks by strength (autocorrelation value)
        peaks.sort(key=lambda x: x[1], reverse=True)

        logger.debug(f"Top 5 peaks: {[(p[0], p[1]) for p in peaks[:5]]}")

        # Check if the strongest peak is significantly stronger than others
        if len(peaks) >= 2:
            strongest_strength = peaks[0][1]
            second_strength = peaks[1][1]
            strength_ratio = strongest_strength / second_strength

            logger.debug(
                f"Strength ratio check: {strongest_strength:.3f} / {second_strength:.3f} = {strength_ratio:.3f}"
            )

            # If the strongest peak is significantly stronger (4%+) AND in a reasonable BPM range, prioritize it
            if strength_ratio >= 1.04 and 70 <= peaks[0][0] <= 180:
                best_bpm, best_strength = peaks[0]
                logger.debug(
                    f"Strongest peak significantly stronger (ratio: {strength_ratio:.2f}) and in reasonable range, selecting: {best_bpm:.1f} BPM"
                )
                return float(best_bpm), best_strength

        # Score each peak based on multiple factors
        scored_peaks = []

        for bpm, strength in peaks:
            score = self._calculate_bpm_score(bpm, strength, peaks, min_bpm, max_bpm)
            scored_peaks.append((bpm, strength, score))

        # Sort by score (higher is better)
        scored_peaks.sort(key=lambda x: x[2], reverse=True)

        best_bpm, best_strength, best_score = scored_peaks[0]

        logger.debug(
            f"Selected BPM: {best_bpm:.1f} (strength: {best_strength:.3f}, score: {best_score:.3f})"
        )

        return best_bpm, best_strength

    def _calculate_bpm_score(
        self,
        bpm: float,
        strength: float,
        all_peaks: list,
        min_bpm: float,
        max_bpm: float,
    ) -> float:
        """Calculate a score for a BPM candidate based on multiple factors."""
        score = 0.0

        # Base score from autocorrelation strength (dominant weight)
        score += strength * 0.6

        # Prefer BPMs in common musical ranges (reduced weight)
        if 120 <= bpm <= 140:  # Most common range for modern music
            score += 0.15
        elif 100 <= bpm <= 160:  # Common dance/electronic range
            score += 0.1
        elif 80 <= bpm <= 180:  # General musical range
            score += 0.05
        elif min_bpm <= bpm <= max_bpm:  # Within valid range
            score += 0.02

        # Penalize very slow or very fast BPMs
        if bpm < 70:
            score -= 0.3
        elif bpm > 170:
            score -= 0.3

        # Check for harmonic relationships with other strong peaks
        harmonic_bonus = 0.0
        for other_bpm, other_strength in all_peaks[:10]:  # Check top 5 peaks
            if other_bpm == bpm:
                continue

            ratio = bpm / other_bpm

            # Check for common musical relationships
            if 0.95 <= ratio <= 1.05:  # Very close (same tempo)
                harmonic_bonus += 0.05
            elif 1.9 <= ratio <= 2.1:  # 2:1 ratio (double tempo)
                harmonic_bonus += 0.02
            elif 0.45 <= ratio <= 0.55:  # 1:2 ratio (half tempo)
                harmonic_bonus += 0.02
            elif 1.4 <= ratio <= 1.6:  # 3:2 ratio (common in jazz)
                harmonic_bonus += 0.01

        score += harmonic_bonus

        return score

    @monitor_performance("fft_bpm_comparison")
    def compare_with_current(self, y: np.ndarray, sr: int, current_bpm: float) -> dict:
        """
        Compare FFT-based BPM detection with current method.

        Args:
            y: Audio data
            sr: Sample rate
            current_bpm: BPM from current method

        Returns:
            Comparison results
        """
        try:
            fft_bpm = self.detect_bpm(y, sr)

            error = abs(fft_bpm - current_bpm)
            accuracy = (
                max(0, 100 - (error / current_bpm * 100)) if current_bpm > 0 else 0
            )

            return {
                "current_bpm": current_bpm,
                "fft_bpm": fft_bpm,
                "error": error,
                "accuracy": accuracy,
                "method": "FFT-based autocorrelation",
            }

        except Exception as e:
            logger.error(f"BPM comparison failed: {e}")
            return {
                "current_bpm": current_bpm,
                "fft_bpm": 120.0,
                "error": abs(120.0 - current_bpm),
                "accuracy": 0,
                "method": "FFT-based autocorrelation (failed)",
            }
