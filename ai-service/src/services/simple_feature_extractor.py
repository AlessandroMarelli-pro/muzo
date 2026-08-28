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
        mfcc_std = self.shared_features.features.get("mfcc_std", [0.0] * 13)
        spectral_contrasts = self.shared_features.features.get(
            "spectral_contrasts",
            {
                "mean": 0.0,
                "std": 0.0,
                "median": 0.0,
                "min": 0.0,
                "max": 0.0,
                "p25": 0.0,
                "p75": 0.0,
            },
        )
        dynamic_range = float(self.shared_features.features.get("dynamic_range", 0.0))

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
            "mfcc_std": mfcc_std,
            "spectral_contrasts": spectral_contrasts,
            "dynamic_range": dynamic_range,
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

    # danceability_feeling threshold ladder, reused from the retired DanceabilityAnalyzer
    # so the label semantics don't change even though the source score does.
    _DANCEABILITY_FEELING_TIERS = [
        (0.75, "highly-danceable"),
        (0.60, "very-danceable"),
        (0.45, "danceable"),
        (0.30, "moderately-danceable"),
        (0.20, "somewhat-danceable"),
        (0.10, "minimally-danceable"),
    ]

    # valence_mood / arousal_mood 5-tier ladders, reused from the retired
    # AudioMoodAnalyzer so label semantics don't change even though the source scores do.
    _VALENCE_MOOD_TIERS = [
        (0.75, "very positive"),
        (0.60, "positive"),
        (0.40, "neutral"),
        (0.25, "negative"),
    ]
    _AROUSAL_MOOD_TIERS = [
        (0.80, "very energetic"),
        (0.60, "energetic"),
        (0.40, "moderate energy"),
        (0.20, "calm"),
    ]

    @staticmethod
    def _label_from_tiers(value: float, tiers: list, below_label: str) -> str:
        for threshold, label in tiers:
            if value >= threshold:
                return label
        return below_label

    @monitor_performance("get_musical_features")
    def _get_musical_features(
        self,
        spectral_features: dict,
        discogs_classifiers: dict,
        discogs_deam: dict,
        mode: str = "major",
    ) -> dict:
        """
        Derive musical characteristics (valence/arousal, danceability,
        instrumentalness) from the discogs-effnet classifier outputs and the DEAM
        arousal-valence regression model, replacing the retired hand-computed
        AudioMoodAnalyzer/DanceabilityAnalyzer formulas and spectral heuristics.

        Args:
            spectral_features: Dictionary containing spectral features (used only for
                the energy-band comment/keywords, which have no discogs-effnet analog)
            discogs_classifiers: Output of DiscogsClassifiersExtractor.predict_all --
                danceable, mood_happy, mood_sad, mood_relaxed, mood_aggressive,
                mood_party, voice (all 0-1 or None)
            discogs_deam: Output of DeamExtractor.extract_from_audio -- valence/
                arousal (both 0-1, rescaled from DEAM's native [1,9] range), or {}
                on failure. Chosen over emoMusic/MuSe for best arousal correlation
                (see DeamExtractor's docstring). Falls back to a neutral 0.5/0.5 if
                empty rather than deriving from the mood classifiers, since DEAM is
                a dedicated regression model for this exact task.
            mode: "major"/"minor" from S-KEY's own key prediction (or from ai_key
                when the LLM-provided key overrides it)

        Returns:
            Dictionary containing musical features
        """
        try:
            discogs_classifiers = discogs_classifiers or {}
            discogs_deam = discogs_deam or {}

            def _prob(key: str) -> float:
                value = discogs_classifiers.get(key)
                return float(value) if value is not None else 0.5

            voice = _prob("voice")
            danceable = _prob("danceable")

            valence = float(discogs_deam.get("valence", 0.5))
            valence = min(1.0, max(0.0, valence))
            valence_mood = self._label_from_tiers(
                valence, self._VALENCE_MOOD_TIERS, "very negative"
            )

            arousal = float(discogs_deam.get("arousal", 0.5))
            arousal = min(1.0, max(0.0, arousal))
            arousal_mood = self._label_from_tiers(
                arousal, self._AROUSAL_MOOD_TIERS, "very calm"
            )

            danceability = danceable
            danceability_feeling = self._label_from_tiers(
                danceability, self._DANCEABILITY_FEELING_TIERS, "experimental"
            )

            # instrumentalness: probability of NOT vocal -- the closest discogs-effnet
            # analog to the old spectral-rolloff heuristic. acousticness/speechiness/
            # liveness have no discogs-effnet equivalent and are dropped outright (no
            # replacement computation, no placeholder) per explicit decision.
            instrumentalness = 1.0 - voice

            # Generate energy band comment and keywords (no discogs-effnet analog;
            # kept as-is, still sourced from spectral features)
            energy_by_band = spectral_features["energy_by_band"]
            energy_ratios = spectral_features["energy_ratios"]
            energy_info = self._get_energy_band_comment(energy_by_band, energy_ratios)

            return {
                "valence": float(round(valence, 3)),
                "valence_mood": valence_mood,
                "arousal": float(round(arousal, 3)),
                "arousal_mood": arousal_mood,
                "danceability": float(round(danceability, 3)),
                "danceability_feeling": danceability_feeling,
                "instrumentalness": float(round(instrumentalness, 3)),
                "energy_comment": energy_info["comment"],
                "energy_keywords": energy_info["keywords"],
                "mode": mode,
            }

        except Exception as e:
            traceback.print_exc()
            logger.error(f"Failed to extract musical features: {e}")
            return {
                "valence": 0.5,
                "valence_mood": "neutral",
                "arousal": 0.5,
                "arousal_mood": "neutral",
                "danceability": 0.5,
                "danceability_feeling": "neutral",
                "instrumentalness": 0.5,
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
        onset_density = float(self.shared_features.features.get("onset_density", 0.0))
        return {
            "zcr_mean": zcr["mean"],
            "zcr_std": zcr["std"],
            "onset_density": onset_density,
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
        discogs_classifiers: dict,
        discogs_tempo: dict,
        discogs_deam: dict,
        discogs_skey: dict,
        ai_bpm: float = None,
        ai_key: str = None,
    ) -> Dict[str, Any]:
        """
        Extract basic audio features using optimized samples.

        Args:
            y_harmonic: Harmonic-rich audio sample (for key, chords, melody)
            y_percussive: Percussive-rich audio sample (for rhythm analysis)
            y_bpm: BPM-optimized audio sample (unused now that tempo comes from
                TempoCNN instead of the retired hand-computed BPM detector; kept in
                the signature since callers/smart_audio_sample_loading still produce it)
            sr: Sample rate
            file_path: Path to audio file (for fallback)
            discogs_classifiers: Output of DiscogsClassifiersExtractor.predict_all,
                computed earlier in the same request -- feeds danceability/
                instrumentalness (replaces DanceabilityAnalyzer/the
                acousticness-speechiness-liveness heuristics)
            discogs_tempo: Output of TempoCnnExtractor.extract_from_audio, computed
                earlier in the same request -- feeds tempo (replaces
                EnhancedAdaptiveBPMDetector/FFTBPMDetector)
            discogs_deam: Output of DeamExtractor.extract_from_audio, computed
                earlier in the same request -- feeds valence/arousal (replaces
                AudioMoodAnalyzer)
            discogs_skey: Output of SkeyExtractor.extract_from_audio, computed
                earlier in the same request -- feeds key/camelot_key (replaces
                the KeyFinder/tonnetz-mode heuristic)

        Returns:
            Dictionary containing basic audio features
        """
        try:
            logger.info("Extracting basic audio features using audioFlux")

            # Extract shared features from both harmonic and percussive samples
            self.shared_features.extract_shared_features(y_harmonic, y_percussive, sr)

            tempo = float((discogs_tempo or {}).get("tempo") or 0.0)
            tempo_source = "tempo_cnn"
            if ai_bpm:
                # The LLM-provided BPM silently overrides the detected value.
                # If AI metadata is only intermittently available, the same
                # file can report different tempos across runs with no
                # visible reason -- log it and surface the source downstream
                # so that's diagnosable instead of invisible.
                logger.info(
                    f"Overriding detected tempo {tempo} BPM with AI-provided "
                    f"tempo {ai_bpm} BPM for {file_path}"
                )
                tempo = ai_bpm
                tempo_source = "ai"

            # S-KEY's key string (e.g. "C# minor") uses sharps-only naming, so
            # the camelot_wheel lookup (keyed on e.g. "C# MINOR") works unchanged.
            key = (discogs_skey or {}).get("key") or "Unknown"
            mode = (discogs_skey or {}).get("mode") or "major"
            camelot_key = KeyDetector.camelot_wheel.get(key.upper(), "Unknown")
            if ai_key:
                key = ai_key
                camelot_key = KeyDetector.camelot_wheel.get(key.upper(), "Unknown")
                mode = "major" if "major" in key.lower() else "minor"
            key = key.capitalize()
            spectral_features = self._get_spectral_features()

            musical_features = self._get_musical_features(
                spectral_features,
                discogs_classifiers,
                discogs_deam,
                mode,
            )

            # bass_presence had no source besides the retired DanceabilityAnalyzer;
            # no discogs-effnet equivalent exists, so it defaults to 0.0.
            spectral_features["bass_presence"] = 0.0

            rhythm_fingerprint = self._get_rhythm_fingerprint()
            melodic_fingerprint = self._get_melodic_fingerprint()

            # Combine all features
            features = {
                "features": {
                    "musical_features": {
                        **musical_features,
                        "tempo": tempo,
                        "tempo_source": tempo_source,
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
