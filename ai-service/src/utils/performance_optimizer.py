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
from src.utils.trace import trace


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
                # Per-step timing trace (INFO, [perf] <step> done in X.XXXs)
                trace(f"{operation} done in {duration:.3f}s", file="perf")

        return wrapper

    return decorator


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
