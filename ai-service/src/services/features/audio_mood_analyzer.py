import audioflux as af
import numpy as np
from audioflux.type import SpectralDataType
from loguru import logger

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


class AudioMoodAnalyzer:
    def __init__(self, shared_features: SharedFeatures):
        self.shared_features = shared_features

    @monitor_performance("_get_brightness_factor")
    def _get_brightness_factor(
        self,
    ) -> float:
        """
        Spectral centroid using audioflux.
        """
        # Average over time
        mean_centroid = self.shared_features.features["spectral_centroids"]["mean"]

        # Normalize (typical range 500-6000 Hz)
        min_centroid = 500
        max_centroid = 6000

        brightness = (mean_centroid - min_centroid) / (max_centroid - min_centroid)

        return np.clip(brightness, 0.0, 1.0)

    @monitor_performance("_get_harmonic_factor")
    def _get_harmonic_factor(
        self,
    ) -> float:
        """
        Measures harmonic consonance using spectral flatness.

        Spectral flatness ranges:
        - Very harmonic (tonal): 0.0 - 0.1 → high consonance
        - Normal music: 0.1 - 0.2 → moderate consonance
        - Noisy/dissonant: 0.2 - 0.35 → low consonance
        """
        mean_flatness = self.shared_features.features["spectral_flatnesses"]["mean"]

        # Expand normalization range for better discrimination
        # Typical music range: flatness 0.0 - 0.35
        # Map to full 0-1 consonance range

        # Invert and normalize: low flatness = high consonance
        # flatness 0.0 → consonance 1.0
        # flatness 0.35 → consonance 0.0
        max_flatness = 0.35  # Empirical max for music (noise/distortion boundary)

        consonance = 1.0 - (mean_flatness / max_flatness)

        return float(np.clip(consonance, 0.0, 1.0))

    @monitor_performance("_get_spectral_balance_factor")
    def _get_spectral_balance_factor(
        self,
        y,
        sr,
    ) -> float:
        """
        Balance between low and high frequencies.
        Alternative approach without spectral_contrast.
        """

        # Calculate spectral rolloff
        mean_rolloff = self.shared_features.features["spectral_rolloffs"]["mean"]

        # Calculate spectral spread (variance around centroid)
        # Higher spread = more distributed energy across frequencies
        mean_spread = self.shared_features.features["spectral_spreads"]["mean"]

        # Also calculate energy distribution
        # Get full spectrum
        bft_obj = af.BFT(
            num=2048,
            samplate=sr,
            low_fre=0,
            high_fre=sr // 2,
            data_type=SpectralDataType.POWER,
        )
        spec_arr = bft_obj.bft(y)
        spec_dB_arr = af.utils.power_to_db(np.abs(spec_arr))
        spec_arr = np.abs(spec_dB_arr)

        # Calculate ratio of high-frequency to low-frequency energy
        freq_bins = spec_arr.shape[0]
        mid_point = freq_bins // 2

        low_energy = np.mean(spec_arr[:mid_point, :])
        high_energy = np.mean(spec_arr[mid_point:, :])

        if low_energy > 0:
            hf_lf_ratio = high_energy / (low_energy + 1e-10)
        else:
            hf_lf_ratio = 0

        # Normalize rolloff with expanded range for very bright tracks
        # Typical range: 1000-8000 Hz, but bright music can reach 10000+ Hz
        rolloff_normalized = np.clip((mean_rolloff - 1000) / 9000, 0.0, 1.0)

        # Normalize spread with expanded range
        # Typical range: 0-4000 Hz, but wide-spectrum music can reach 5000+ Hz
        spread_normalized = np.clip(mean_spread / 5000, 0.0, 1.0)

        # Normalize HF/LF ratio with expanded range
        # Typical range: 0.1-2.0, but very bright tracks can reach 3.0+
        ratio_normalized = np.clip((hf_lf_ratio - 0.1) / 2.9, 0.0, 1.0)

        # Combine all three metrics
        spectral_balance = (
            0.4 * rolloff_normalized  # Where most energy is concentrated
            + 0.3 * ratio_normalized  # High vs low frequency balance
            + 0.3 * spread_normalized  # How spread out the energy is
        )

        return float(np.clip(spectral_balance, 0.0, 1.0))

    @monitor_performance("_get_key_valence_factor")
    def _get_mode_valence_factor(self, mode: str) -> float:
        """Get valence factor based on musical key (major vs minor)."""
        try:
            if mode == "major":
                return 0.8  # Major keys are generally more positive
            elif mode == "minor":
                return 0.3  # Minor keys are generally more negative/melancholic
            else:
                return 0.5  # Neutral for unknown keys
        except Exception:
            return 0.5

    @monitor_performance("_get_tempo_valence_factor")
    def _get_tempo_valence_factor(self, tempo: float) -> float:
        """Get valence factor based on tempo."""
        min_bpm = 70
        max_bpm = 170

        # Normalize
        tempo_normalized = (tempo - min_bpm) / (max_bpm - min_bpm)

        return np.clip(tempo_normalized, 0.0, 1.0)

    @monitor_performance("analyze_audio_mood")
    def analyze_audio_mood(
        self,
        y: np.ndarray,
        sr: int,
        tempo: float,
        mode: str,
        beat_strength: float,
    ) -> float:
        """
        Calculate enhanced valence using multiple musical factors.

        This method considers:
        - Musical key (major vs minor)
        - Tempo emotional impact
        - Energy and brightness
        - Harmonic content
        - Spectral characteristics

        Args:
            y: Audio data
            sr: Sample rate
            tempo: Tempo in BPM
            mode: Musical Mode (e.g., major or minor)
            spectral_features: Dictionary containing spectral features
            shared_features: Pre-extracted shared features (optional)

        Returns:
            Valence score (0.0 to 1.0, higher = more positive)
        """
        try:
            # 1. Key-based valence (major vs minor)
            mode_factor = self._get_mode_valence_factor(mode)

            # Calculate tonnetz-based confidence for mode detection
            tonnetz_dict = self.shared_features.features.get("tonnetz", None)
            mode_confidence = 1.0  # Default to full confidence if tonnetz unavailable

            if tonnetz_dict:
                # Use tonnetz stability and clarity as confidence indicators
                tonnetz_mean = np.array(tonnetz_dict["mean"])
                overall_std = tonnetz_dict["overall_std"]

                # Stability: low variance = stable harmonic content = more confident
                stability = 1.0 / (1.0 + overall_std)
                stability = float(np.clip(stability, 0.0, 1.0))

                # Clarity: how distinct is the tonal center
                max_val = np.max(tonnetz_mean)
                min_val = np.min(tonnetz_mean)
                mean_val = np.mean(tonnetz_mean)
                clarity = (max_val - min_val) / (mean_val + 1e-8) if mean_val > 0 else 0
                clarity = float(np.clip(clarity / 2.0, 0.0, 1.0))  # Normalize

                # Combined confidence: both stability and clarity matter
                mode_confidence = 0.6 * stability + 0.4 * clarity

                # If confidence is very low, reduce mode contribution significantly
                if mode_confidence < 0.3:
                    mode_confidence = (
                        0.3  # Never go below 30% to maintain some influence
                    )

            # 2. Tempo-based valence (tempo affects mood)
            tempo_factor = self._get_tempo_valence_factor(tempo)

            # 3. Energy factor (higher energy = more positive)
            energy_factor = self.shared_features._get_energy_factor()

            # 4. Brightness factor (brighter sound = more positive)
            brightness_factor = self._get_brightness_factor()

            # 5. Harmonic richness factor
            harmonic_factor = self._get_harmonic_factor()

            # 6. Spectral balance factor
            spectral_balance = self._get_spectral_balance_factor(
                y,
                sr,
            )

            # 7. Syncopation factor (measures off-beat accents)
            syncopation = self.shared_features._get_syncopation(
                tempo, sr, beat_strength
            )

            # Dynamic mode weight: base 15% × confidence (0.3-1.0)
            mode_weight = 0.15 * mode_confidence

            # Redistribute remaining weight to reliable features
            spectral_weight = (
                1.0 - mode_weight - 0.08 - 0.02
            )  # Reserve tempo and energy weights

            # Weighted combination prioritizing reliable spectral features
            # Mode weight reduced and dynamically adjusted based on tonnetz confidence
            valence = (
                (spectral_weight * 0.47)
                * float(brightness_factor)  # ~35% base, most reliable
                + (spectral_weight * 0.30)
                * float(harmonic_factor)  # ~22% base, consonance
                + (spectral_weight * 0.23)
                * float(spectral_balance)  # ~18% base, brightness
                + mode_weight
                * float(mode_factor)  # Dynamic: 4.5%-15% based on confidence
                + 0.08 * float(tempo_factor)  # Fixed: moderate contribution
                + 0.02 * float(energy_factor)  # Fixed: minimal (misleading for valence)
            )

            valence_mood = "neutral"
            if valence > 0.7:
                valence_mood = "very positive"
            elif valence > 0.55:
                valence_mood = "positive"
            elif valence > 0.48:
                valence_mood = "neutral"
            elif valence > 0.3:
                valence_mood = "negative"
            else:
                valence_mood = "very negative"

            arousal = (
                0.40
                * float(beat_strength)  # INCREASE: most important for perceived energy
                + 0.25 * float(tempo_factor)  # Decrease slightly
                + 0.15 * float(syncopation)  # Increase: rhythmic complexity = energy
                + 0.10 * float(brightness_factor)  # Keep: brightness adds energy
                + 0.05 * float(energy_factor)  # Decrease: RMS energy is misleading
                + 0.03 * float(spectral_balance)  # Small contribution
                + 0.02 * float(mode_factor)  # Minimal
            )

            arousal_mood = "very calm"
            if arousal > 0.7:
                arousal_mood = "very energetic"
            elif arousal > 0.55:
                arousal_mood = "energetic"
            elif arousal > 0.45:
                arousal_mood = "moderate energy"
            elif arousal > 0.3:
                arousal_mood = "calm"
            else:
                arousal_mood = "very calm"

            mood_calculation = {
                "mode_factor": float(mode_factor),
                "mode_confidence": float(mode_confidence),
                "mode_weight": float(mode_weight),
                "tempo_factor": float(tempo_factor),
                "energy_factor": float(energy_factor),
                "brightness_factor": float(brightness_factor),
                "harmonic_factor": float(harmonic_factor),
                "spectral_balance": float(spectral_balance),
                "beat_strength": float(beat_strength),
                "syncopation": float(syncopation),
            }

            return (
                min(1.0, max(0.0, valence)),
                arousal,
                valence_mood,
                arousal_mood,
                mood_calculation,
            )

        except Exception as e:
            logger.error(f"Failed to calculate enhanced valence: {e}")
            return 0.5
