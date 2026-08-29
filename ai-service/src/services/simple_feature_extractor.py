"""
Simple audio feature extractor for extracting musical features from audio.

This service provides audio feature extraction including tempo, key, energy,
and other musical characteristics using audioFlux for optimized performance.
"""

import traceback
from typing import Any, Dict

import numpy as np
from loguru import logger

from src.services.features.key_detector import KeyDetector
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

    def __init__(self):
        """Initialize the feature extractor service."""
        logger.info("SimpleFeatureExtractor initialized")
        self.redis_cache = RedisCache(key_prefix="simple_feature_extractor")

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

            return {
                "valence": float(round(valence, 3)),
                "valence_mood": valence_mood,
                "arousal": float(round(arousal, 3)),
                "arousal_mood": arousal_mood,
                "danceability": float(round(danceability, 3)),
                "danceability_feeling": danceability_feeling,
                "instrumentalness": float(round(instrumentalness, 3)),
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
                "mode": mode,
            }

    @monitor_performance("simple_basic_features")
    def extract_basic_features(
        self,
        file_path: str,
        discogs_classifiers: dict,
        discogs_tempo: dict,
        discogs_deam: dict,
        discogs_skey: dict,
        ai_bpm: float = None,
        ai_key: str = None,
    ) -> Dict[str, Any]:
        """
        Extract basic audio features.

        Args:
            file_path: Path to audio file (for fallback)
            discogs_classifiers: Output of DiscogsClassifiersExtractor.predict_all,
                computed earlier in the same request -- feeds danceability/
                instrumentalness (replaces DanceabilityAnalyzer/the
                acousticness-speechiness-liveness heuristics)
            discogs_tempo: Output of TempoCnnExtractor.extract_from_audio, computed
                earlier in the same request -- feeds tempo
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
            tempo = float((discogs_tempo or {}).get("tempo") or 0.0)
            if ai_bpm:
                # The LLM-provided BPM silently overrides the detected value.
                # If AI metadata is only intermittently available, the same
                # file can report different tempos across runs with no
                # visible reason -- log it so that's diagnosable instead of
                # invisible.
                logger.info(
                    f"Overriding detected tempo {tempo} BPM with AI-provided "
                    f"tempo {ai_bpm} BPM for {file_path}"
                )
                tempo = ai_bpm

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

            musical_features = self._get_musical_features(
                discogs_classifiers,
                discogs_deam,
                mode,
            )

            # Combine all features. spectral_features/rhythm_fingerprint/
            # melodic_fingerprint (raw audioFlux MFCC/chroma/tonnetz/etc. output,
            # with no discogs-effnet analog) and tempo_source/key (redundant with
            # discogs_tempo/discogs_skey, which the caller already has) are no
            # longer included in the response -- trimmed per explicit decision to
            # shrink the /audio/analyze/simple response shape.
            features = {
                "features": {
                    "musical_features": {
                        **musical_features,
                        "tempo": tempo,
                        "camelot_key": camelot_key,
                    },
                }
            }

            logger.info("audioFlux features extracted successfully")
            return features

        except Exception as e:
            logger.error(f"Failed to extract basic features: {e}")
            logger.debug(traceback.format_exc())
            return None
