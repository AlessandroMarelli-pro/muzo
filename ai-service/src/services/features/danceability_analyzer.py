import json

import audioflux as af
import numpy as np
from audioflux.type import NoveltyType, SpectralDataType, SpectralFilterBankScaleType

# Compatibility shim for madmom
try:
    # Restore deprecated numpy aliases for madmom compatibility
    if not hasattr(np, "float"):
        np.float = float
    if not hasattr(np, "int"):
        np.int = int
    if not hasattr(np, "complex"):
        np.complex = complex
except Exception:
    pass

from src.services.features.shared_features import SharedFeatures
from src.utils.performance_optimizer import monitor_performance


class DanceabilityAnalyzer:
    def __init__(self, shared_features: SharedFeatures):
        self.shared_features = shared_features

    @monitor_performance("simple_tempo_appropriateness")
    def _get_tempo_appropriateness(self, tempo: float) -> float:
        """
        Calculate how appropriate the tempo is for dancing.

        Based on research, optimal dance tempos are typically in the 90-140 BPM range,
        with some variation depending on dance style.
        Optimal dance tempo ranges
            Very slow (60-80): Less danceable
            Slow (80-100): Moderately danceable
            Medium (100-120): Good for dancing
            Fast (120-140): Very danceable
            Very fast (140+): Less danceable

        Args:
            tempo: Tempo in BPM

        Returns:
            Tempo appropriateness score (0.0 to 1.0)
        """
        if tempo <= 60:
            return 0.2
        elif tempo <= 80:
            return 0.4
        elif tempo <= 90:
            return 0.5
        elif tempo <= 100:
            return 0.6
        elif tempo <= 110:
            return 0.7
        elif tempo <= 120:
            return 0.8
        elif tempo <= 130:
            return 0.9
        elif tempo <= 140:
            return 1.0
        elif tempo <= 160:
            return 0.8
        elif tempo <= 180:
            return 0.6
        else:
            return 0.2

    @monitor_performance("_get_danceability_feeling")
    def _get_danceability_feeling(self, danceability: float) -> str:
        """
        Calculate human-readable danceability feeling/label.

        Args:
            danceability: Danceability score (0.0 to 1.0)

        Returns:
            String describing the danceability feeling
        """
        if danceability >= 0.75:
            return "highly-danceable"
        elif danceability >= 0.60:
            return "danceable"
        elif danceability >= 0.55:
            return "moderately-danceable"
        elif danceability >= 0.35:
            return "slightly-danceable"
        elif danceability >= 0.20:
            return "minimally-danceable"
        elif danceability >= 0.10:
            return "ambient"
        else:
            return "experimental"

    @monitor_performance("_get_tempo_regularity")
    def _get_tempo_regularity(self, onset_env, beat_strength: float):
        """
        Measures how consistent the tempo is throughout the track.
        High regularity = steady tempo = more danceable.
        """
        # if beat_strength < 0.1:
        #    return 0.0

        # Find onset peaks
        threshold = np.mean(onset_env) + 0.8 * np.std(onset_env)
        onset_peaks = np.where(onset_env > threshold)[0]

        if len(onset_peaks) < 4:
            return 0.0

        # Calculate inter-onset intervals (IOIs)
        intervals = np.diff(onset_peaks)

        if len(intervals) < 2:
            return 0.0

        # Remove outliers (tempo changes, syncopation)
        median_interval = np.median(intervals)

        # Keep only intervals within 50% of median (filter out subdivisions/syncopation)
        valid_intervals = intervals[
            (intervals > median_interval * 0.5) & (intervals < median_interval * 1.5)
        ]

        # Measure consistency using coefficient of variation
        # Lower CV = more regular
        mean_interval = np.mean(valid_intervals)
        std_interval = np.std(valid_intervals)

        if mean_interval > 0:
            cv = std_interval / mean_interval
            # Invert and normalize: high regularity = low variation
            regularity = 1 / (1 + cv)
        else:
            regularity = 0

        return float(np.clip(regularity, 0.0, 1.0))

    @monitor_performance("_get_rhythm_stability")
    def _get_rhythm_stability(self, onset_env):
        """
        Measures how stable/consistent the rhythmic pattern is.
        Uses onset peak intervals across time windows to measure rhythm consistency.
        """

        # Find onset peaks from envelope
        threshold = np.mean(onset_env) + 0.5 * np.std(onset_env)
        onset_peaks = np.where(onset_env > threshold)[0]

        if len(onset_peaks) < 8:
            return 0.0

        # Calculate inter-onset intervals
        intervals = np.diff(onset_peaks)

        if len(intervals) < 4:
            return 0.0

        # Divide into time windows and measure interval consistency in each
        num_windows = min(8, len(intervals) // 4)  # Adaptive window count
        window_size = len(intervals) // num_windows

        if window_size < 2:
            return 0.0

        window_cvs = []  # Coefficient of variation per window

        for i in range(num_windows):
            start_idx = i * window_size
            end_idx = start_idx + window_size

            if end_idx > len(intervals):
                break

            window_intervals = intervals[start_idx:end_idx]

            # Filter outliers within window
            median_interval = np.median(window_intervals)
            valid_intervals = window_intervals[
                (window_intervals > median_interval * 0.4)
                & (window_intervals < median_interval * 2.0)
            ]

            if len(valid_intervals) < 2:
                continue

            # Coefficient of variation for this window
            mean_interval = np.mean(valid_intervals)
            std_interval = np.std(valid_intervals)

            if mean_interval > 0:
                cv = std_interval / mean_interval
                window_cvs.append(cv)

        if len(window_cvs) == 0:
            return 0.0

        # Stability = low variation across AND within windows
        # Low CV within windows = consistent rhythm
        mean_cv = np.mean(window_cvs)
        # Low std of CVs = stable rhythm over time
        std_cv = np.std(window_cvs)

        # Convert CV to stability score (lower CV = higher stability)
        within_window_stability = 1 / (1 + mean_cv)
        across_window_stability = 1 / (1 + std_cv)

        # Combine both aspects
        stability = 0.6 * within_window_stability + 0.4 * across_window_stability

        return round(float(np.clip(stability, 0.0, 1.0)), 1)

    @monitor_performance("_get_bass_presence")
    def _get_bass_presence(self, audio_arr, sr):
        """
        Measures the presence and strength of bass frequencies (20-200 Hz).
        Strong bass = more danceable.
        """
        # Create BFT object for full spectrum
        bft_obj = af.BFT(
            num=2049,
            samplate=sr,
            radix2_exp=12,
            slide_length=1024,
            scale_type=SpectralFilterBankScaleType.LINEAR,
            data_type=SpectralDataType.POWER,
        )
        spec_arr = bft_obj.bft(audio_arr)
        # spec_arr is already power spectrum, no need for np.abs()

        # Get frequency coordinates
        freqs = bft_obj.y_coords()

        # Ensure frequency array matches spectrogram size
        n_freq_bins = spec_arr.shape[0]
        if len(freqs) != n_freq_bins:
            # Adjust freq array to match spec_arr size
            freqs = freqs[:n_freq_bins]

        # Find bass frequency bins (20-200 Hz for strong bass)
        bass_mask = (freqs >= 20) & (freqs <= 300)

        if not np.any(bass_mask):
            # No bass frequencies found in this range
            return 0.0

        # Calculate total energy in bass vs full spectrum (use power, not dB)
        bass_power = np.sum(spec_arr[bass_mask, :])  # Total bass energy across time
        total_power = np.sum(spec_arr)  # Total energy across all frequencies and time

        if total_power == 0:
            return 0.0

        # Bass ratio (what percentage of total energy is in bass)
        bass_ratio = bass_power / total_power

        # Normalize: typical bass ratio ranges from 0.05 (5%) to 0.40 (40%)
        # Higher ratio = more bass-heavy track
        bass_presence = (bass_ratio - 0.05) / 0.35

        return float(np.clip(bass_presence, 0.0, 1.0))

    @monitor_performance("calculate_danceability")
    def calculate_danceability(
        self,
        beat_strength: float,
        y: np.ndarray,
        sr: int,
        tempo: float,
    ) -> float:
        """
        Production-ready danceability calculator.
        Handles all dance genres correctly.
        """
        onset_env_arr, onset_env_obj = self.shared_features._get_onset_env()
        # Enhanced danceability calculation based on Essentia approach
        rhythm_stability = self._get_rhythm_stability(onset_env_arr)
        tempo_regularity = self._get_tempo_regularity(onset_env_arr, beat_strength)
        bass_presence = self._get_bass_presence(y, sr)
        tempo_appropriateness = self._get_tempo_appropriateness(tempo)

        # Energy factor for danceability (higher energy = more danceable)
        energy_factor = self.shared_features._get_energy_factor()
        syncopation = self.shared_features._get_syncopation(tempo, sr, beat_strength)

        # Critical factors (must have these)
        essential = (
            0.40 * beat_strength  # Clear, strong beats
            + 0.40 * tempo_regularity  # Steady tempo
            + 0.20 * bass_presence  # Strong bass foundation
        )

        # Enhancement factors (make it better)
        enhancements = (
            0.35 * tempo_appropriateness  # Right BPM
            + 0.40 * energy_factor  # Enough energy
            + 0.25 * rhythm_stability  # Rhythmic consistency
        )

        danceability = 0.70 * essential + 0.30 * enhancements

        # Bonus for exceptional groove
        if syncopation < 0.5 and beat_strength > 0.7 and bass_presence > 0.8:
            danceability = min(1.0, danceability * 1.1)  # 10% boost

        danceability = float(np.clip(danceability, 0.0, 1.0))

        # Apply beat strength gate: Very weak beats reduce danceability significantly
        # If beat_strength < 0.3, apply a diminishing multiplier
        # if beat_strength < 0.3:
        #    # Quadratic curve for smooth transition: (beat_strength / 0.3)^2
        #    beat_multiplier = (beat_strength / 0.3) ** 2
        #    danceability_enhanced = danceability * beat_multiplier
        # else:
        #    danceability_enhanced = danceability

        # Use enhanced version as primary danceability (0-1 range)
        # danceability = danceability_enhanced

        # Calculate danceability feeling (human-readable label)
        danceability_feeling = self._get_danceability_feeling(danceability)
        danceability_calculation = {
            "rhythm_stability": rhythm_stability,
            "bass_presence": bass_presence,
            "tempo_regularity": tempo_regularity,
            "tempo_appropriateness": tempo_appropriateness,
            "energy_factor": energy_factor,
            "syncopation": syncopation,
            "beat_strength": beat_strength,
        }
        return danceability, danceability_feeling, danceability_calculation
