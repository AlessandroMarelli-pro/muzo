"""
Simple fingerprint generator for creating audio fingerprints.

This service provides fingerprint generation functionality using file hashing
and audio sample hashing for identification purposes.
"""

import hashlib
from typing import Any, Dict

import numpy as np
from loguru import logger

from src.utils.performance_optimizer import monitor_performance


class SimpleFingerprintGenerator:
    """
    Simple fingerprint generator that provides audio fingerprinting
    capabilities using file and audio sample hashing.
    """

    def __init__(self):
        """Initialize the fingerprint generator service."""
        logger.info("SimpleFingerprintGenerator initialized")

    @monitor_performance("simple_fingerprint")
    def generate_simple_fingerprint(
        self, file_path: str, y: np.ndarray, sr: int
    ) -> Dict[str, Any]:
        """
        Generate a simple fingerprint using file hash.

        Args:
            file_path: Path to audio file
            y: Audio data array
            sr: Sample rate

        Returns:
            Dictionary containing fingerprint information
        """
        try:
            logger.info(f"Generating simple fingerprint: {file_path}")

            # Simple file hash
            with open(file_path, "rb") as f:
                file_hash = hashlib.md5(f.read()).hexdigest()

            # Simple audio hash (first and last 1000 samples from the loaded sample)
            if len(y) > 2000:
                audio_sample = np.concatenate([y[:1000], y[-1000:]])
                audio_hash = hashlib.md5(audio_sample.tobytes()).hexdigest()
            else:
                audio_hash = hashlib.md5(y.tobytes()).hexdigest()

            fingerprint = {
                "fingerprint": {
                    "file_hash": file_hash,
                    "audio_hash": audio_hash,
                    "method": "simple_md5",
                }
            }

            logger.info(f"Simple fingerprint generated: {file_hash[:8]}...")
            return fingerprint

        except Exception as e:
            logger.error(f"Failed to generate simple fingerprint: {e}")
            raise
