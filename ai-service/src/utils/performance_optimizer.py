"""
Performance optimization configuration for the AI service.

This module provides performance monitoring and optimization utilities
to ensure efficient audio processing and API response times.
"""

import time
from functools import wraps
from typing import Any, Callable, Dict, Optional

import numpy as np
from loguru import logger

from src.config.settings import Config


class PerformanceMonitor:
    """Monitor and track performance metrics for audio processing operations."""

    def __init__(self):
        """Initialize performance monitoring."""
        self.metrics: Dict[str, list] = {
            "audio_loading": [],
            "feature_extraction": [],
            "fingerprint_generation": [],
            "genre_classification": [],
            "api_response": [],
        }

    def record_metric(self, operation: str, duration: float):
        """Record a performance metric."""
        if operation in self.metrics:
            self.metrics[operation].append(duration)

            # Keep only last 100 measurements to prevent memory growth
            if len(self.metrics[operation]) > 100:
                self.metrics[operation] = self.metrics[operation][-100:]

    def get_average_time(self, operation: str) -> Optional[float]:
        """Get average time for an operation."""
        if operation in self.metrics and self.metrics[operation]:
            return np.mean(self.metrics[operation])
        return None

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        summary = {}
        for operation, times in self.metrics.items():
            if times:
                summary[operation] = {
                    "count": len(times),
                    "average": float(np.mean(times)),
                    "min": float(np.min(times)),
                    "max": float(np.max(times)),
                    "std": float(np.std(times)),
                }
        return summary


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def monitor_performance(operation: str):
    """
    Decorator to monitor performance of audio processing operations.

    Args:
        operation: Name of the operation being monitored
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                performance_monitor.record_metric(operation, duration)

                # Log slow operations
                if duration > Config.SLOW_OPERATION_THRESHOLD:  # 5 seconds threshold
                    logger.warning(
                        f"Slow operation detected: {operation} took {duration:.2f}s"
                    )
                else:
                    logger.debug(f"{operation} completed in {duration:.2f}s")

        return wrapper

    return decorator


class AudioProcessingOptimizer:
    """Optimization utilities for audio processing operations."""

    @staticmethod
    def optimize_librosa_config() -> Dict[str, Any]:
        """
        Get optimized librosa configuration for better performance.

        Returns:
            Dictionary with optimized librosa parameters
        """
        return {
            "sr": 22050,  # Standard sample rate for music analysis
            "hop_length": 512,  # Balanced between resolution and speed
            "n_mels": 128,  # Standard mel filter bank size
            "n_mfcc": 13,  # Standard MFCC coefficient count
            "n_fft": 2048,  # FFT window size for good frequency resolution
        }

    @staticmethod
    def batch_process_features(
        audio_data: np.ndarray, sr: int
    ) -> Dict[str, np.ndarray]:
        """
        Process multiple audio features in a single pass for efficiency.

        Args:
            audio_data: Audio data array
            sr: Sample rate

        Returns:
            Dictionary containing all extracted features
        """
        config = AudioProcessingOptimizer.optimize_librosa_config()

        # Extract all features in one pass to minimize librosa calls
        features = {}

        # Spectral features
        features["spectral_centroid"] = librosa.feature.spectral_centroid(
            y=audio_data, sr=sr, hop_length=config["hop_length"]
        )[0]
        features["spectral_rolloff"] = librosa.feature.spectral_rolloff(
            y=audio_data, sr=sr, hop_length=config["hop_length"]
        )[0]
        features["spectral_bandwidth"] = librosa.feature.spectral_bandwidth(
            y=audio_data, sr=sr, hop_length=config["hop_length"]
        )[0]

        # MFCC features
        features["mfcc"] = librosa.feature.mfcc(
            y=audio_data,
            sr=sr,
            n_mfcc=config["n_mfcc"],
            hop_length=config["hop_length"],
        )

        # Mel spectrogram
        features["mel_spectrogram"] = librosa.feature.melspectrogram(
            y=audio_data,
            sr=sr,
            n_mels=config["n_mels"],
            hop_length=config["hop_length"],
        )

        # Chroma features
        features["chroma"] = librosa.feature.chroma_stft(
            y=audio_data, sr=sr, hop_length=config["hop_length"]
        )

        # Rhythm features
        features["zcr"] = librosa.feature.zero_crossing_rate(
            audio_data, hop_length=config["hop_length"]
        )[0]

        return features

    @staticmethod
    def vectorized_statistics(features: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """
        Calculate statistics for multiple features using vectorized operations.

        Args:
            features: Dictionary of feature arrays

        Returns:
            Dictionary containing mean and std for each feature
        """
        stats = {}

        for feature_name, feature_data in features.items():
            if feature_data.ndim == 1:
                # 1D features (time series)
                stats[f"{feature_name}_mean"] = float(np.mean(feature_data))
                stats[f"{feature_name}_std"] = float(np.std(feature_data))
            elif feature_data.ndim == 2:
                # 2D features (time-frequency)
                stats[f"{feature_name}_mean"] = np.mean(feature_data, axis=1).tolist()
                stats[f"{feature_name}_std"] = np.std(feature_data, axis=1).tolist()

        return stats


def get_performance_recommendations() -> Dict[str, str]:
    """
    Get performance optimization recommendations based on current metrics.

    Returns:
        Dictionary of recommendations for performance improvement
    """
    summary = performance_monitor.get_performance_summary()
    recommendations = {}

    for operation, metrics in summary.items():
        if metrics["average"] > 10.0:  # 10 second threshold
            recommendations[operation] = (
                f"Consider optimizing {operation} - "
                f"average time: {metrics['average']:.2f}s"
            )
        elif metrics["std"] > metrics["average"] * 0.5:  # High variance
            recommendations[operation] = (
                f"High variance in {operation} - consider caching or preprocessing"
            )

    return recommendations
