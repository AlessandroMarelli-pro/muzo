#!/usr/bin/env python3
"""
Enhanced Adaptive BPM Detector using Rice University beat detection.

This combines the best of both approaches:
- Rice University algorithm for accurate beat detection
- Adaptive strategy selection (FFT vs Spectral Flux)
- Optimized for speed and accuracy
"""

import json
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from typing import List, Optional, Tuple

import numpy as np
from loguru import logger
from scipy import signal

from src.services.simple_audio_loader import SimpleAudioLoader
from src.utils.performance_optimizer import monitor_performance


class EnhancedAdaptiveBPMDetector:
    """
      Enhanced adaptive BPM detector using Rice University beat detection.

      Strategy Selection:
      - Rice algorithm detects beats → Use FFT-based (for rhythmic music)
      - No beats detected → Use spectral flux (for melodic music)
    | Music Type                   | Old Confidence | New Confidence |
    |------------------------------|----------------|----------------|
    | Strong beats (dance, rock)   | 0.3-0.6        | 0.8-1.0 ✅      |
    | No beats (ambient, drone)    | 0.3-0.5 ❌      | 0.0-0.2 ✅      |
    | Weak beats (jazz, classical) | 0.2-0.4        | 0.3-0.6 ✅      |
    """

    def __init__(self):
        """Initialize the enhanced adaptive BPM detector."""
        logger.info("EnhancedAdaptiveBPMDetector initialized")
        self.audio_loader = SimpleAudioLoader()

        # Rice beat detection parameters
        self.band_limits = [0, 200, 400, 800, 1600, 3200]
        self.beat_threshold = 0.45
        self.min_bpm = 60
        self.max_bpm = 240

    @monitor_performance("enhanced_adaptive_bpm_detection")
    def detect_bpm(self, y: np.ndarray, sr: int) -> Tuple[float, float]:
        """
        Detect BPM using enhanced adaptive strategy selection.

        Args:
            y: Audio data (mono)
            sr: Sample rate

        Returns:
            Tuple of (estimated BPM, confidence)
        """
        try:
            logger.info("Starting enhanced adaptive BPM detection")

            # Ensure mono audio
            if y.ndim > 1:
                y = np.mean(y, axis=1)

            # Step 1: Detect beats using Rice algorithm
            has_beats, beat_confidence, detected_bpm = self._detect_beats_rice(y, sr)

            logger.debug(
                f"Rice beat detection: has_beats={has_beats}, confidence={beat_confidence:.3f}, bpm={detected_bpm:.1f}"
            )

            # Step 2: Choose appropriate strategy
            if has_beats:
                logger.debug("Using FFT-based strategy (rhythmic music detected)")
                bpm, strength = self._detect_bpm_fft(y, sr)
                strategy = "FFT-based (rhythmic)"

            if not has_beats or bpm == 0:
                logger.debug("Using spectral flux strategy (melodic music detected)")
                bpm, strength = self._detect_bpm_spectral_flux(y, sr)
                strategy = "Spectral flux (melodic)"

            if bpm == 120.0 and strength == 0.0:
                return round(detected_bpm, 1), 0.0

            logger.info(
                f"Enhanced adaptive BPM detection result: {bpm:.1f} BPM (confidence: {beat_confidence:.3f}) using {strategy}"
            )
            return round(bpm, 1), round(strength, 3)

        except Exception as e:
            logger.error(f"Enhanced adaptive BPM detection failed: {e}")
            return 120.0, 0.0

    def _detect_beats_rice(self, y: np.ndarray, sr: int) -> Tuple[bool, float, float]:
        """
        Detect beats using Rice University algorithm (optimized version).

        This is a simplified but faster version of the full Rice algorithm.
        """
        try:
            # Step 1: Filterbank - Divide into frequency bands
            frequency_bands = self._filterbank_fast(y, sr)

            # Step 2: Smoothing - Extract envelopes
            smoothed_bands = self._smoothing_fast(frequency_bands, sr)

            # Step 3: Diff-Rect - Differentiate and rectify
            diff_rect_bands = self._diff_rect_fast(smoothed_bands)

            # Step 4: Comb Filter - Find tempo (simplified)
            detected_bpm = self._comb_filter_fast(diff_rect_bands, sr)

            # Calculate beat confidence
            beat_confidence = self._calculate_beat_confidence_fast(
                diff_rect_bands, detected_bpm, sr
            )
            has_beats = beat_confidence > self.beat_threshold

            return has_beats, beat_confidence, detected_bpm

        except Exception as e:
            logger.warning(f"Rice beat detection failed: {e}")
            return False, 0.0, 120.0

    def _filterbank_fast(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Fast frequency band separation."""
        # Use scipy's spectrogram for efficiency
        freqs, times, stft = signal.spectrogram(
            y, fs=sr, window="hann", nperseg=1024, noverlap=512, mode="magnitude"
        )

        # Create frequency bands
        bands = []
        for i in range(len(self.band_limits) - 1):
            low_freq = self.band_limits[i]
            high_freq = self.band_limits[i + 1]

            # Find frequency indices
            freq_mask = (freqs >= low_freq) & (freqs < high_freq)

            # Sum energy in this band
            band_energy = np.sum(stft[freq_mask, :], axis=0)
            bands.append(band_energy)

        # Final band: 3200Hz to Nyquist
        nyquist = sr / 2
        freq_mask = (freqs >= self.band_limits[-1]) & (freqs <= nyquist)
        band_energy = np.sum(stft[freq_mask, :], axis=0)
        bands.append(band_energy)

        return np.array(bands)

    def _smoothing_fast(self, bands: np.ndarray, sr: int) -> np.ndarray:
        """Fast envelope extraction."""
        smoothed_bands = []

        for band in bands:
            # Simple smoothing using moving average
            window_size = max(1, int(0.1 * sr / 1024))  # 0.1 second window

            # Ensure window_size is odd and less than signal length
            if window_size % 2 == 0:
                window_size += 1
            window_size = min(window_size, len(band) - 1)

            if window_size >= 3 and len(band) > window_size:
                smoothed = signal.savgol_filter(band, window_size, 2)
            else:
                # Fallback to simple moving average
                smoothed = np.convolve(
                    band, np.ones(window_size) / window_size, mode="same"
                )

            smoothed_bands.append(smoothed)

        return np.array(smoothed_bands)

    def _diff_rect_fast(self, bands: np.ndarray) -> np.ndarray:
        """Fast differentiation and rectification."""
        diff_rect_bands = []

        for band in bands:
            # Differentiate
            differentiated = np.diff(band)

            # Half-wave rectification
            rectified = np.maximum(differentiated, 0)

            diff_rect_bands.append(rectified)

        return np.array(diff_rect_bands)

    def _comb_filter_fast(self, bands: np.ndarray, sr: int) -> float:
        """Fast tempo detection using autocorrelation."""
        # Combine all bands
        combined_signal = np.sum(bands, axis=0)

        # Use autocorrelation for tempo detection
        autocorr = np.correlate(combined_signal, combined_signal, mode="full")
        autocorr = autocorr[autocorr.size // 2 :]

        # Find peaks in autocorrelation
        min_lag = int(60 * sr / (self.max_bpm * 1024))  # Convert BPM to lag
        max_lag = int(60 * sr / (self.min_bpm * 1024))

        min_lag = max(min_lag, 1)
        max_lag = min(max_lag, len(autocorr) - 1)

        # Find peaks in the valid range
        peaks, properties = signal.find_peaks(
            autocorr[min_lag:max_lag],
            height=np.percentile(autocorr[min_lag:max_lag], 70),
            distance=max(1, int(sr / (200 * 1024))),
        )

        if len(peaks) == 0:
            return 120.0

        # Convert peak lag to BPM
        peak_lag = peaks[0] + min_lag
        bpm = 60 * sr / (peak_lag * 1024)
        bpm = self.normalize_bpm(bpm)
        return float(bpm)

    def normalize_bpm(self, raw_bpm):
        """
        Normalize BPM to a reasonable range (60-200) by detecting harmonics.
        """
        # Common musical BPM ranges
        reasonable_ranges = [
            (60, 80),  # Slow ballads
            (80, 120),  # Medium tempo
            (120, 160),  # Up-tempo
            (160, 200),  # Very fast
        ]

        # Try different divisions
        for divisor in [
            1,
            2,
            4,
            8,
        ]:
            normalized = raw_bpm / divisor

            # Check if it falls in a reasonable range
            for min_bpm, max_bpm in reasonable_ranges:
                if min_bpm <= normalized <= max_bpm:
                    return normalized

        # If nothing works, return the original
        return float(raw_bpm)

    def _calculate_beat_confidence_fast(
        self, bands: np.ndarray, bpm: float, sr: int
    ) -> float:
        """
        Calculate beat confidence based on periodicity strength, not just signal dynamics.

        This measures if the signal has a clear, repeating beat pattern.
        """
        try:
            combined_signal = np.sum(bands, axis=0)

            if len(combined_signal) < 10:
                return 0.0

            # 1. Autocorrelation to measure periodicity
            signal_centered = combined_signal - np.mean(combined_signal)
            autocorr = np.correlate(signal_centered, signal_centered, mode="full")
            autocorr = autocorr[autocorr.size // 2 :]

            if len(autocorr) == 0 or autocorr[0] == 0:
                return 0.0

            # Normalize autocorrelation
            autocorr_norm = autocorr / autocorr[0]

            # 2. Find periodicity strength at expected beat interval
            # Calculate expected lag from BPM
            if 60 <= bpm <= 240:
                expected_beat_interval_sec = 60.0 / bpm
                # Convert to frames (using hop_length from spectrogram)
                hop_length = 512  # From _filterbank_fast
                expected_lag = int(expected_beat_interval_sec * sr / hop_length)
            else:
                expected_lag = None

            # 3. Find peaks in autocorrelation (within BPM range)
            min_lag = int(60 * sr / (240 * hop_length))  # 240 BPM
            max_lag = int(60 * sr / (60 * hop_length))  # 60 BPM

            min_lag = max(min_lag, 1)
            max_lag = min(max_lag, len(autocorr_norm) - 1)

            if min_lag >= max_lag:
                return 0.0

            # Find peaks in valid range
            peaks, properties = signal.find_peaks(
                autocorr_norm[min_lag:max_lag],
                height=0.1,  # Minimum correlation
                distance=max(1, min_lag // 2),
            )

            if len(peaks) == 0:
                return 0.0

            # Get strongest peak
            peak_heights = properties["peak_heights"]
            strongest_peak_idx = np.argmax(peak_heights)
            strongest_peak_height = peak_heights[strongest_peak_idx]
            strongest_peak_lag = peaks[strongest_peak_idx] + min_lag

            # 4. Check if detected lag matches expected BPM
            lag_matches_bpm = False
            if expected_lag is not None:
                # Allow 10% tolerance
                lag_matches_bpm = (
                    abs(strongest_peak_lag - expected_lag) / expected_lag < 0.1
                )

            # 5. Measure peak sharpness (sharp peaks = clear beats)
            # Use signal peaks, not autocorrelation
            signal_peaks, _ = signal.find_peaks(
                combined_signal, height=np.percentile(combined_signal, 75)
            )

            if len(signal_peaks) < 2:
                peak_sharpness = 0.0
            else:
                # Measure consistency of peak intervals
                peak_intervals = np.diff(signal_peaks)
                if np.mean(peak_intervals) > 0:
                    peak_cv = np.std(peak_intervals) / np.mean(peak_intervals)
                    peak_sharpness = 1.0 / (1.0 + peak_cv)  # Lower CV = sharper
                else:
                    peak_sharpness = 0.0

            # 6. Calculate final confidence
            periodicity_score = strongest_peak_height  # 0-1 range
            sharpness_score = peak_sharpness  # 0-1 range

            # Base confidence from periodicity and sharpness
            confidence = 0.6 * periodicity_score + 0.4 * sharpness_score

            # Bonus if detected lag matches expected BPM
            if lag_matches_bpm:
                confidence = min(1.0, confidence * 1.2)

            logger.debug(
                f"Beat confidence: periodicity={periodicity_score:.3f}, "
                f"sharpness={sharpness_score:.3f}, "
                f"peak_height={strongest_peak_height:.3f}, "
                f"lag_match={lag_matches_bpm}, "
                f"confidence={confidence:.3f}"
            )

            return float(np.clip(confidence, 0.0, 1.0))

        except Exception as e:
            logger.warning(f"Fast beat confidence calculation failed: {e}")
            return 0.0

    def _detect_bpm_fft(self, y: np.ndarray, sr: int) -> Tuple[float, float]:
        """FFT-based BPM detection for rhythmic music."""
        try:
            from src.services.fft_bpm_detector import FFTBPMDetector

            fft_detector = FFTBPMDetector()
            bpm, strength = fft_detector.detect_bpm(y, sr)
            return bpm, strength

        except Exception as e:
            logger.warning(f"FFT BPM detection failed: {e}")
            return 120.0, 0.0

    def _detect_bpm_spectral_flux(self, y: np.ndarray, sr: int) -> Tuple[float, float]:
        """Spectral flux-based BPM detection for melodic music."""
        try:
            # Parameters optimized for melodic content
            window_size = 2048
            hop_size = 512

            # Compute STFT
            freqs, times, stft = signal.spectrogram(
                y,
                fs=sr,
                window="hann",
                nperseg=window_size,
                noverlap=window_size - hop_size,
                mode="magnitude",
            )

            # Compute spectral flux correctly
            # Spectral flux = sum of positive differences between consecutive frames
            spectral_flux = np.sum(np.maximum(np.diff(stft, axis=1), 0), axis=0)

            # Apply smoothing
            if len(spectral_flux) > 5:
                spectral_flux = signal.savgol_filter(
                    spectral_flux, min(5, len(spectral_flux)), 2
                )

            # Find peaks with better parameters
            min_distance = max(1, int(sr / (200 * hop_size)))
            peaks, properties = signal.find_peaks(
                spectral_flux,
                height=np.percentile(spectral_flux, 60),  # Lower threshold
                distance=min_distance,
            )
            if len(peaks) < 2:
                return 120.0, 0.0

            # Convert to BPM correctly
            peak_intervals = np.diff(peaks) * hop_size / sr  # Convert to seconds
            bpm_values = 60.0 / peak_intervals  # Convert to BPM

            # Filter reasonable range
            valid_bpms = bpm_values[(bpm_values >= 60) & (bpm_values <= 200)]

            if len(valid_bpms) == 0:
                return 120.0, 0.0

            # Use median for robustness
            estimated_bpm = np.median(valid_bpms)

            # Check for harmonics
            estimated_bpm = self._check_harmonics_spectral(estimated_bpm, valid_bpms)

            # Calculate beat strength from spectral flux peak heights
            # Similar to autocorr[lag] in FFT detector
            if len(peaks) > 0 and "peak_heights" in properties:
                # Use average of peak heights as beat strength
                peak_heights = properties["peak_heights"]
                avg_strength = np.mean(peak_heights) if len(peak_heights) > 0 else 0
                # Normalize to 0-1 range (typical max is ~0.1-1.0 for spectral flux)
                beat_strength = min(1.0, avg_strength / 0.5)
            else:
                # Fallback: use consistency-based confidence
                consistency = 1.0 - (np.std(valid_bpms) / np.mean(valid_bpms))
                beat_strength = max(0.0, min(1.0, consistency))

            # Diminished beat strength for melodic music
            beat_strength = beat_strength / 4
            logger.debug(
                f"Spectral flux: detected {estimated_bpm:.1f} BPM from {len(valid_bpms)} intervals, beat_strength={beat_strength:.3f}"
            )

            return float(estimated_bpm), float(beat_strength)

        except Exception as e:
            logger.warning(f"Spectral flux BPM detection failed: {e}")
            return 120.0, 0.0

    def _check_harmonics_spectral(
        self, detected_bpm: float, valid_bpms: np.ndarray
    ) -> float:
        """Check for harmonics in spectral flux results."""
        try:
            # Check if detected BPM is in common musical range
            if 80 <= detected_bpm <= 160:
                return detected_bpm

            # Check for sub-harmonic (half the BPM)
            sub_harmonic_bpm = detected_bpm / 2
            if 80 <= sub_harmonic_bpm <= 160:
                logger.debug(
                    f"Spectral harmonic check: preferring sub-harmonic {sub_harmonic_bpm:.1f} BPM over {detected_bpm:.1f} BPM"
                )
                return sub_harmonic_bpm

            # Check for harmonic (double the BPM)
            harmonic_bpm = detected_bpm * 2
            if 80 <= harmonic_bpm <= 160:
                logger.debug(
                    f"Spectral harmonic check: preferring harmonic {harmonic_bpm:.1f} BPM over {detected_bpm:.1f} BPM"
                )
                return harmonic_bpm

            return detected_bpm

        except Exception as e:
            logger.warning(f"Spectral harmonic check failed: {e}")
            return detected_bpm

    @monitor_performance("detect_bpm_from_file")
    def detect_bpm_from_file(
        self, file_path: str, bpm_metadata: dict
    ) -> Tuple[float, float]:
        """
        Detect BPM from audio file using enhanced adaptive approach.

        Args:
            file_path: Path to audio file
            bpm_metadata: Metadata for BPM detection

        Returns:
            Tuple of (most_frequent_bpm, beat_strength)
        """
        try:
            logger.info(
                f"Starting enhanced adaptive file-based BPM detection for: {file_path}"
            )

            # Default chunk intervals if not provided
            chunk_intervals = [0, 15, 30, 45, 60]

            bpm_with_strength_results = []
            # Note : maybe use sf.info to get the duration and detect bpm on several parts of the audiofile
            # Analyze each chunk
            for interval in chunk_intervals:
                try:
                    # Load audio chunk
                    y, sr = self.audio_loader.load_audio_sample(
                        file_path,
                        sample_duration=np.floor(bpm_metadata["duration"]),
                        skip_intro=bpm_metadata["start_time"] + interval,
                    )

                    # Detect BPM for this chunk
                    bpm, beat_strength = self.detect_bpm(y, sr)

                    bpm_with_strength_results.append(
                        {"bpm": bpm, "beat_strength": beat_strength}
                    )
                    logger.debug(
                        f"Chunk {interval}s: {bpm:.1f} BPM (strength: {beat_strength:.3f})"
                    )

                except Exception as e:
                    logger.warning(f"Failed to analyze chunk at {interval}s: {e}")
                    continue

            if not bpm_with_strength_results:
                logger.warning("No valid chunks analyzed, using default BPM")
                return 120.0, 0.0, []

            # Find most frequent BPM
            most_frequent_bpm, beat_strength = self._get_most_frequent_bpm(
                bpm_with_strength_results
            )

            logger.info(
                f"Enhanced adaptive file BPM detection complete: {most_frequent_bpm:.1f} BPM from {len(bpm_with_strength_results)} chunks, beat_strength: {beat_strength:.3f}"
            )

            logger.debug(f"All BPM results: {bpm_with_strength_results}")

            return (
                most_frequent_bpm,
                beat_strength,
                bpm_with_strength_results,
            )

        except Exception as e:
            logger.error(f"Enhanced adaptive file-based BPM detection failed: {e}")
            return 120.0, 0.0, []

    def _get_most_frequent_bpm(
        self, bpm_with_strength_results: List[dict]
    ) -> Tuple[float, float]:
        bpm_with_strength_results.sort(key=lambda x: x["beat_strength"], reverse=True)

        # filter strength == 0
        bpm_with_strength_results_filtered = [
            result
            for result in bpm_with_strength_results
            if result["beat_strength"] > 0
        ]

        if len(bpm_with_strength_results_filtered) == 0:
            bpm_with_strength_results_filtered = bpm_with_strength_results
        bpm_with_strength_results = bpm_with_strength_results_filtered

        """Get the most frequent BPM from a list of BPM values."""
        if not bpm_with_strength_results:
            return 120.0, 0.0

        # Use numpy to find most frequent value
        unique_values, counts = np.unique(
            [result["bpm"] for result in bpm_with_strength_results], return_counts=True
        )

        if len(unique_values) == len(bpm_with_strength_results):
            strongest_beat_strength = bpm_with_strength_results[0]
            return strongest_beat_strength["bpm"], strongest_beat_strength[
                "beat_strength"
            ]
        # highest unique value count
        most_frequent_count = np.max(counts)
        # indices from unique values that match the most frequent count
        most_frequent_indices = np.where(counts == most_frequent_count)[0]

        frequent_bpm_results = []
        for idx in most_frequent_indices:
            frequent_bpm = float(unique_values[idx])
            # strength is first value from bpm_with_strength_results that match the bpm
            frequent_strength = next(
                (
                    result["beat_strength"]
                    for result in bpm_with_strength_results
                    if result["bpm"] == frequent_bpm
                ),
                0.0,
            )

            frequent_bpm_results.append(
                {"bpm": frequent_bpm, "beat_strength": frequent_strength}
            )
        frequent_bpm_results.sort(key=lambda x: x["beat_strength"], reverse=True)

        most_frequent_bpm_result = frequent_bpm_results[0]
        most_frequent_bpm = round(most_frequent_bpm_result["bpm"], 1)

        most_frequent_strength = round(most_frequent_bpm_result["beat_strength"], 3)
        logger.debug(
            f"Most frequent BPM: {most_frequent_bpm:.1f} (appears {most_frequent_count} times)"
        )

        return most_frequent_bpm, most_frequent_strength
