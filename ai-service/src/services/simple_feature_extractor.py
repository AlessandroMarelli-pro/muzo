"""
Simple audio feature extractor for extracting musical features from audio.

This service provides audio feature extraction including tempo, key, energy,
and other musical characteristics using audioFlux for optimized performance.
"""

import traceback
from typing import Any, Dict

import audioflux as af
import numpy as np
from audioflux.type import SpectralFilterBankScaleType
from loguru import logger

from src.services.features.audio_mood_analyzer import AudioMoodAnalyzer
from src.services.features.danceability_analyzer import DanceabilityAnalyzer
from src.services.features.key_detector import KeyDetector
from src.services.features.shared_features import SharedFeatures
from src.utils.redis_cache import RedisCache

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

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector
from src.utils.performance_optimizer import monitor_performance


class SimpleFeatureExtractor:
    """
    Simple audio feature extractor that provides musical feature extraction
    capabilities using audioFlux for optimized performance.
    """

    shared_features: SharedFeatures = None

    def __init__(self):
        """Initialize the feature extractor service."""
        logger.info("SimpleFeatureExtractor initialized")
        self.redis_cache = RedisCache(key_prefix="simple_feature_extractor")
        self.shared_features = SharedFeatures()

    @monitor_performance("_get_spectral_features")
    def _get_spectral_features(self) -> dict:
        """
        Extract spectral features from audio using audioFlux.

        Returns:
            Dictionary containing spectral features
        """

        # Use shared features if available, otherwise extract individually
        spectral_centroids = self.shared_features.features["spectral_centroids"]
        spectral_bandwidths = self.shared_features.features["spectral_bandwidths"]
        spectral_spreads = self.shared_features.features["spectral_spreads"]
        spectral_flatnesses = self.shared_features.features["spectral_flatnesses"]
        spectral_rolloffs = self.shared_features.features["spectral_rolloffs"]
        zero_crossing_rate = self.shared_features.features["zero_crossing_rate"]
        energy_by_band = self.shared_features.features["energy_by_band"]
        rms = self.shared_features.features["rms"]
        mfcc_mean = self.shared_features.features["mfcc_mean"]

        # Perceptual energy: combines all frequency bands for comprehensive energy
        # Captures both "brightness" (high freq) and "fullness" (bass) + mid presence
        total = sum(energy_by_band)
        bass, mid, high = energy_by_band
        # Protect against division by zero
        if total > 0:
            energy_ratios = [bass / total, mid / total, high / total]
        else:
            energy_ratios = [0.0, 0.0, 0.0]

        return {
            "spectral_centroids": spectral_centroids,
            "spectral_bandwidths": spectral_bandwidths,
            "spectral_spreads": spectral_spreads,
            "spectral_flatnesses": spectral_flatnesses,
            "spectral_rolloffs": spectral_rolloffs,
            "zero_crossing_rate": zero_crossing_rate,
            "rms": rms,
            "energy_by_band": energy_by_band,
            "energy_ratios": energy_ratios,
            "mfcc_mean": mfcc_mean,
        }

    @monitor_performance("_get_energy_band_comment")
    def _get_energy_band_comment(
        self, energy_by_band: list, energy_ratios: list
    ) -> dict:
        """
        Generate descriptive comment and keywords about energy distribution across frequency bands.

        Args:
            energy_by_band: List of [low, mid, high] frequency band energies

        Returns:
            Dictionary with 'comment' (str) and 'keywords' (list) for classification
        """
        if not energy_by_band or len(energy_by_band) != 3:
            return {"comment": "Energy profile unavailable", "keywords": []}

        bass, mid, high = energy_by_band
        total = sum(energy_by_band)

        if total < 1.0:
            return {
                "comment": "Very low energy overall - quiet or minimal content",
                "keywords": ["quiet", "minimal", "low-energy"],
            }

        # Calculate ratios
        bass_ratio = energy_ratios[0]
        mid_ratio = energy_ratios[1]
        high_ratio = energy_ratios[2]

        # Determine energy profile
        if bass > 25 and bass_ratio > 0.6:
            if bass > 30:
                return {
                    "comment": "Bass-heavy track - strong low-end presence with punchy kick and deep bass lines",
                    "keywords": [
                        "bass-heavy",
                        "punchy",
                        "deep-bass",
                        "low-end",
                        "powerful",
                    ],
                }
            else:
                return {
                    "comment": "Bass-focused track - prominent low frequencies, warm foundation",
                    "keywords": [
                        "bass-focused",
                        "warm",
                        "low-frequencies",
                        "foundation",
                    ],
                }

        elif high_ratio > 0.15 or (high > 1.0 and high_ratio > 0.10):
            return {
                "comment": "Bright, treble-focused track - crisp highs and clear detail",
                "keywords": ["bright", "treble-focused", "crisp", "highs", "detailed"],
            }

        elif abs(bass_ratio - mid_ratio) < 0.2 and abs(mid_ratio - high_ratio) < 0.15:
            return {
                "comment": "Balanced spectral distribution - even energy across frequency range",
                "keywords": [
                    "balanced",
                    "even",
                    "well-distributed",
                    "spectral-balance",
                ],
            }

        elif mid_ratio > 0.5 and mid > 10:
            return {
                "comment": "Mid-forward track - vocals and instruments prominent in the mix",
                "keywords": [
                    "mid-forward",
                    "vocals",
                    "instruments",
                    "prominent",
                    "presence",
                ],
            }

        elif total < 15 and high < 1.0:
            return {
                "comment": "Subdued energy profile - warm and mellow character",
                "keywords": ["subdued", "warm", "mellow", "gentle", "soft"],
            }

        elif bass_ratio < 0.4 and mid_ratio < 0.4:
            return {
                "comment": "Bright and airy - emphasis on treble content with minimal bass weight",
                "keywords": ["bright", "airy", "treble", "light", "ethereal"],
            }

        else:
            return {
                "comment": "Mixed energy profile - varied frequency distribution",
                "keywords": ["mixed", "varied", "complex"],
            }

    @monitor_performance("get_musical_features")
    def _get_musical_features(
        self,
        y: np.ndarray,
        y_bpm: np.ndarray,
        sr: int,
        tempo: float,
        beat_strength: float,
        spectral_features: dict,
        mode: str = "major",
    ) -> dict:
        """
        Extract musical characteristics like valence, danceability, etc.

        Enhanced danceability calculation based on Essentia's approach:
        - Rhythm regularity: Consistency of beat patterns
        - Beat strength: Prominence and clarity of beats
        - Tempo appropriateness: How suitable tempo is for dancing
        - Energy distribution: Overall energy characteristics

        Args:
            y: Audio data
            y_bpm: BPM-optimized audio data
            sr: Sample rate
            tempo: Tempo in BPM
            spectral_features: Dictionary containing spectral features
            shared_features: Pre-extracted shared features (optional)

        Returns:
            Dictionary containing musical features
        """
        try:
            rolloff = spectral_features["spectral_rolloffs"]["mean"]

            # Enhanced valence calculation using multiple musical factors
            (
                valence,
                arousal,
                valence_mood,
                arousal_mood,
                mood_calculation,
            ) = AudioMoodAnalyzer(self.shared_features).analyze_audio_mood(
                y,
                sr,
                tempo,
                mode,
                beat_strength,
            )

            # Combine all danceability factors with weights
            # Based on Essentia's approach: rhythm regularity and beat strength are most important
            # Enhanced danceability (0-1 range)
            danceability, danceability_feeling, danceability_calculation = (
                DanceabilityAnalyzer(self.shared_features).calculate_danceability(
                    beat_strength,
                    y_bpm,
                    sr,
                    tempo,
                )
            )

            # Acousticness: Higher for acoustic instruments, lower for electronic
            # Use shared features if available to avoid duplicate spectral_centroids call
            harmonic_content = float(
                self.shared_features.features["spectral_centroids"]["mean"]
            )
            acousticness = min(1.0, max(0.0, 1.0 - (harmonic_content / 3000.0)))

            # Instrumentalness: Fast approximation using spectral rolloff
            instrumentalness = min(1.0, max(0.0, rolloff / 4000.0))

            # Speechiness: Higher for speech-like content, lower for musical content
            speechiness = min(
                1.0, max(0.0, spectral_features["zero_crossing_rate"]["mean"] * 2.0)
            )

            # Liveness: Higher for live recordings, lower for studio recordings
            dynamic_range = float(np.std(y) / (np.mean(np.abs(y)) + 1e-8))
            liveness = min(1.0, max(0.0, dynamic_range * 0.5))

            # Generate energy band comment and keywords
            energy_by_band = spectral_features["energy_by_band"]
            energy_ratios = spectral_features["energy_ratios"]
            energy_info = self._get_energy_band_comment(energy_by_band, energy_ratios)

            return {
                "valence": float(round(valence, 3)),
                "mood_calculation": mood_calculation,
                "valence_mood": valence_mood,
                "arousal": float(round(arousal, 3)),
                "arousal_mood": arousal_mood,
                "danceability": float(round(danceability, 3)),
                "danceability_feeling": danceability_feeling,
                "danceability_calculation": danceability_calculation,
                "acousticness": float(round(acousticness, 3)),
                "instrumentalness": float(round(instrumentalness, 3)),
                "speechiness": float(round(speechiness, 3)),
                "liveness": float(round(liveness, 3)),
                "energy_comment": energy_info["comment"],
                "energy_keywords": energy_info["keywords"],
                "mode": mode,
            }

        except Exception as e:
            traceback.print_exc()
            logger.error(f"Failed to extract musical features: {e}")
            return {
                "valence": 0.5,
                "mood_calculation": {
                    "mode_factor": 0.0,
                    "tempo_factor": 0.0,
                    "energy_factor": 0.0,
                    "brightness_factor": 0.0,
                    "harmonic_factor": 0.0,
                    "spectral_balance": 0.0,
                    "timbre_factor": 0.0,
                },
                "valence_mood": "neutral",
                "arousal": 0.5,
                "arousal_mood": "neutral",
                "danceability": 0.5,
                "danceability_calculation": {
                    "rhythm_regularity": 0.0,
                    "beat_strength": 0.0,
                    "tempo_appropriateness": 0.0,
                    "energy_factor": 0.0,
                },
                "danceability_feeling": "neutral",
                "attack_time": 0.1,
                "harmonic_to_noise_ratio": 0.5,
                "syncopation": 0.3,
                "acousticness": 0.5,
                "instrumentalness": 0.5,
                "speechiness": 0.5,
                "liveness": 0.5,
                "energy_comment": "Energy profile unavailable",
                "energy_keywords": [],
                "energy_ratios": [0.0, 0.0, 0.0],
            }

    @monitor_performance("get_rhythm_fingerprint")
    def _get_rhythm_fingerprint(self) -> dict:
        """
        Extract rhythm-based fingerprint for tempo and beat pattern identification.

        Rhythm fingerprints capture the temporal structure of audio,
        useful for identifying songs with similar rhythmic patterns.

        Args:
            y: Audio data
            sr: Sample rate


        Returns:
            Dictionary containing rhythm fingerprint features
        """
        # Use shared features if available, otherwise extract zero crossing rate
        zcr = self.shared_features.features["zero_crossing_rate"]
        return {
            "zcr_mean": zcr["mean"],
            "zcr_std": zcr["std"],
        }

    @monitor_performance("get_melodic_fingerprint")
    def _get_melodic_fingerprint(
        self,
    ) -> dict:
        """
        Extract melodic-based fingerprint for harmonic content identification.

        Melodic fingerprints capture the harmonic and tonal characteristics,
        useful for identifying songs with similar chord progressions or melodies.

        Args:
            y: Audio data
            sr: Sample rate
        Returns:
            Dictionary containing melodic fingerprint features
        """
        # Use shared features if available, otherwise extract individually
        chroma = self.shared_features.features["chroma"]
        tonnetz = self.shared_features.features["tonnetz"]

        return {
            "chroma": chroma,
            "tonnetz": tonnetz,
        }

    @monitor_performance("simple_basic_features")
    def extract_basic_features(
        self,
        y_harmonic: np.ndarray,
        y_percussive: np.ndarray,
        y_bpm: np.ndarray,
        bpm_metadata: dict,
        sr: int,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Extract basic audio features using optimized samples.

        Args:
            y_harmonic: Harmonic-rich audio sample (for key, chords, melody)
            y_percussive: Percussive-rich audio sample (for rhythm analysis)
            y_bpm: BPM-optimized audio sample (regular beat, good energy)
            sr: Sample rate
            file_path: Path to audio file (for fallback)

        Returns:
            Dictionary containing basic audio features
        """
        try:
            logger.info("Extracting basic audio features using audioFlux")

            # Extract shared features from both harmonic and percussive samples
            self.shared_features.extract_shared_features(y_harmonic, y_percussive, sr)

            # Extract individual feature groups using BPM-optimized sample
            bpm_detector = EnhancedAdaptiveBPMDetector()
            tempo, beat_strength, bpm_results = bpm_detector.detect_bpm_from_file(
                file_path, bpm_metadata
            )

            # Use harmonic sample for key detection (key is based on tonal content)
            key, camelot_key, tonnetz_mode = KeyDetector(
                self.shared_features
            ).get_simple_key(y_harmonic, sr)
            spectral_features = self._get_spectral_features()
            # Use harmonic sample for musical features (mood/valence based on harmony)

            musical_features = self._get_musical_features(
                y_harmonic,
                y_bpm,
                sr,
                tempo,
                beat_strength,
                spectral_features,
                tonnetz_mode,
            )

            rhythm_fingerprint = self._get_rhythm_fingerprint()
            melodic_fingerprint = self._get_melodic_fingerprint()

            # Combine all features
            features = {
                "features": {
                    "musical_features": {
                        **musical_features,
                        "tempo": tempo,
                        "key": key,
                        "camelot_key": camelot_key,
                    },
                    "spectral_features": spectral_features,
                    "rhythm_fingerprint": rhythm_fingerprint,
                    "melodic_fingerprint": melodic_fingerprint,
                }
            }

            logger.info("audioFlux features extracted successfully")
            return features

        except Exception as e:
            logger.error(f"Failed to extract basic features: {e}")
            logger.debug(traceback.format_exc())
            return None
