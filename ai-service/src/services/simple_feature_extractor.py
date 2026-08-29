"""
Simple audio feature extractor for extracting musical features from audio.

This service derives interpreted musical characteristics (valence/arousal mood,
danceability feeling, tempo, key) from the discogs-effnet/DEAM/S-KEY/TempoCNN model
outputs computed earlier in the same request. It never falls back to a neutral
placeholder (0.5, 0.0, "Unknown") when a source model produced nothing -- a missing
input yields a missing output (None), so callers can tell "the model said 0.5" from
"the model didn't run".
"""

import traceback
from typing import Any, Dict, Optional

from loguru import logger

from src.services.features.key_detector import KeyDetector
from src.utils.redis_cache import RedisCache

# Compatibility shim for madmom
import numpy as np

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
    Simple audio feature extractor that derives interpreted musical features
    (mood/danceability tier labels, tempo, key) from model outputs.
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
    def _label_from_tiers(
        value: Optional[float], tiers: list, below_label: str
    ) -> Optional[str]:
        """Same tier-ladder lookup as before, but returns None when value is None
        instead of silently labelling a missing value as if it were the lowest tier."""
        if value is None:
            return None
        for threshold, label in tiers:
            if value >= threshold:
                return label
        return below_label

    @monitor_performance("get_musical_features")
    def _get_musical_features(
        self,
        discogs_classifiers: dict,
        discogs_deam: dict,
        mode: Optional[str],
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
                on failure/disabled
            mode: "major"/"minor" from S-KEY's own key prediction, or None when
                S-KEY produced nothing

        Returns:
            Dictionary of raw values (valence, arousal, danceability,
            instrumentalness, mode) and their tier labels (valence_mood,
            arousal_mood, danceability_feeling). Any entry is None when its source
            model didn't produce a value -- no neutral placeholders.
        """
        try:
            discogs_classifiers = discogs_classifiers or {}
            discogs_deam = discogs_deam or {}

            def _prob(key: str) -> Optional[float]:
                value = discogs_classifiers.get(key)
                return float(value) if value is not None else None

            voice = _prob("voice")
            danceable = _prob("danceable")

            valence_raw = discogs_deam.get("valence")
            valence = (
                min(1.0, max(0.0, float(valence_raw)))
                if valence_raw is not None
                else None
            )
            valence_mood = self._label_from_tiers(
                valence, self._VALENCE_MOOD_TIERS, "very negative"
            )

            arousal_raw = discogs_deam.get("arousal")
            arousal = (
                min(1.0, max(0.0, float(arousal_raw)))
                if arousal_raw is not None
                else None
            )
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
            instrumentalness = 1.0 - voice if voice is not None else None

            return {
                "valence": round(valence, 3) if valence is not None else None,
                "valence_mood": valence_mood,
                "arousal": round(arousal, 3) if arousal is not None else None,
                "arousal_mood": arousal_mood,
                "danceability": round(danceability, 3)
                if danceability is not None
                else None,
                "danceability_feeling": danceability_feeling,
                "instrumentalness": round(instrumentalness, 3)
                if instrumentalness is not None
                else None,
                "mode": mode,
            }

        except Exception as e:
            traceback.print_exc()
            logger.error(f"Failed to extract musical features: {e}")
            return {
                "valence": None,
                "valence_mood": None,
                "arousal": None,
                "arousal_mood": None,
                "danceability": None,
                "danceability_feeling": None,
                "instrumentalness": None,
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
    ) -> Dict[str, Any]:
        """
        Derive interpreted musical features from the model outputs computed
        earlier in the same request.

        Args:
            file_path: Path to audio file (for log context only)
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
            Dict with two top-level keys:
              - "musical": raw values (tempo, key, camelot_key, valence, arousal,
                danceability, instrumentalness, mode) -- each None when its source
                model produced nothing. No neutral placeholders: a missing tempo is
                None, never 0.0; a missing key is None, never "Unknown".
              - "labels": interpreted tier labels (valence_mood, arousal_mood,
                danceability_feeling) -- None when the value they describe is None.
            Returns None on unexpected failure (caller is responsible for turning
            that into a warning, not a crash -- see simple_analysis.py).
        """
        try:
            discogs_tempo = discogs_tempo or {}
            discogs_skey = discogs_skey or {}

            tempo = discogs_tempo.get("tempo")
            tempo = float(tempo) if tempo is not None else None
            tempo_confidence = discogs_tempo.get("confidence")

            # S-KEY's key string (e.g. "C# minor") uses sharps-only naming, so
            # the camelot_wheel lookup (keyed on e.g. "C# MINOR") works unchanged.
            key = discogs_skey.get("key")
            mode = discogs_skey.get("mode")
            camelot_key = (
                KeyDetector.camelot_wheel.get(key.upper()) if key else None
            )
            key = key.capitalize() if key else None

            musical_features = self._get_musical_features(
                discogs_classifiers,
                discogs_deam,
                mode,
            )

            return {
                "musical": {
                    **musical_features,
                    "tempo": tempo,
                    "tempo_confidence": tempo_confidence,
                    "key": key,
                    "camelot_key": camelot_key,
                },
                "labels": {
                    "valence_mood": musical_features["valence_mood"],
                    "arousal_mood": musical_features["arousal_mood"],
                    "danceability_feeling": musical_features["danceability_feeling"],
                },
            }

        except Exception as e:
            logger.error(f"Failed to extract basic features: {e}")
            logger.debug(traceback.format_exc())
            return None
