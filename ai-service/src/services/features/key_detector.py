import audioflux as af
import numpy as np
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

from warnings import deprecated

from src.services.features.shared_features import SharedFeatures
from src.utils.keyfinder import KeyFinder
from src.utils.performance_optimizer import monitor_performance


class KeyDetector:
    camelot_wheel = {
        # Major keys (inner circle)
        "C MAJOR": "8B",
        "G MAJOR": "9B",
        "D MAJOR": "10B",
        "A MAJOR": "11B",
        "E MAJOR": "12B",
        "B MAJOR": "1B",
        "F# MAJOR": "2B",
        "C# MAJOR": "3B",
        "G# MAJOR": "4B",
        "D# MAJOR": "5B",
        "A# MAJOR": "6B",
        "F MAJOR": "7B",
        # Minor keys (outer circle)
        "A MINOR": "8A",
        "E MINOR": "9A",
        "B MINOR": "10A",
        "F# MINOR": "11A",
        "C# MINOR": "12A",
        "G# MINOR": "1A",
        "D# MINOR": "2A",
        "A# MINOR": "3A",
        "F MINOR": "4A",
        "C MINOR": "5A",
        "G MINOR": "6A",
        "D MINOR": "7A",
    }

    def __init__(self, shared_features: SharedFeatures):
        self.shared_features = shared_features

    def _calculate_tonnetz_metrics(self, tonnetz_dict: dict) -> dict:
        """
        Calculate advanced metrics from tonnetz features.

        Returns:
            Dictionary with stability, clarity, and mode indicators
        """
        try:
            tonnetz_mean = np.array(tonnetz_dict["mean"])
            overall_std = tonnetz_dict["overall_std"]

            # Stability: low variance = stable harmonic content
            stability = 1.0 / (1.0 + overall_std)

            # Clarity: how distinct is the tonal center (high peak vs low baseline)
            max_val = np.max(tonnetz_mean)
            min_val = np.min(tonnetz_mean)
            mean_val = np.mean(tonnetz_mean)
            clarity = (max_val - min_val) / (mean_val + 1e-8) if mean_val > 0 else 0

            # Major/minor indication based on third relationships
            # Major: strong tonnetz[0,2,4] (C-E-G, E-G#-B, G-B-D patterns)
            # Minor: strong tonnetz[1,3,5] (D-F-A, F-Ab-C, A-C-E patterns)
            major_indicator = tonnetz_mean[0] + tonnetz_mean[2] + tonnetz_mean[4]
            minor_indicator = tonnetz_mean[1] + tonnetz_mean[3] + tonnetz_mean[5]

            total_indicator = major_indicator + minor_indicator
            if total_indicator > 0:
                major_weight = major_indicator / total_indicator
                minor_weight = minor_indicator / total_indicator
            else:
                major_weight = 0.5
                minor_weight = 0.5

            return {
                "stability": float(np.clip(stability, 0.0, 1.0)),
                "clarity": float(np.clip(clarity, 0.0, 2.0)),
                "major_weight": float(major_weight),
                "minor_weight": float(minor_weight),
            }

        except Exception as e:
            logger.error(f"Failed to calculate tonnetz metrics: {e}")
            return {
                "stability": 0.5,
                "clarity": 0.5,
                "major_weight": 0.5,
                "minor_weight": 0.5,
            }

    def _classify_mode_from_tonnetz(
        self,
        tonnetz_dict: dict,
    ) -> str:
        """
        Classify major vs minor mode using tonnetz features.

        Args:
            tonnetz_dict: Tonnetz feature dictionary
            threshold: Ratio threshold for classification (default 1.15 = 15% stronger)

        Returns:
            "major", "minor", or "ambiguous"
        """
        metrics = self._calculate_tonnetz_metrics(tonnetz_dict)
        major_weight = metrics["major_weight"]
        minor_weight = metrics["minor_weight"]

        if major_weight > minor_weight:
            return "major"
        elif minor_weight > major_weight:
            return "minor"
        else:
            return "ambiguous"

    def get_simple_key(self, y: np.ndarray, sr: int) -> tuple[str, str]:
        """
        Extract musical key using simple key detection with tonnetz validation.

        Args:
            y: Audio data (full audio for accurate tonnetz)
            sr: Sample rate

        Returns:
            Tuple of (key, camelot_key, tonnetz_mode)
        """

        key = KeyFinder(y, sr).key

        # Camelot wheel mapping

        camelot_key = self.camelot_wheel.get(key.upper(), "Unknown")

        # Use pre-computed tonnetz from shared_features (already from same audio)
        tonnetz_full = self.shared_features.features["tonnetz"]
        tonnetz_metrics = self._calculate_tonnetz_metrics(tonnetz_full)
        tonnetz_mode = self._classify_mode_from_tonnetz(tonnetz_full)

        logger.info(
            f"Key detected: {key} | Camelot: {camelot_key} | Tonnetz mode: {tonnetz_mode} "
            f"(major={tonnetz_metrics['major_weight']:.3f}, minor={tonnetz_metrics['minor_weight']:.3f})"
        )
        return key, camelot_key, tonnetz_mode
