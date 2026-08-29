"""
Base filename-cleaning service with shared functionality.

This module provides a base class for LLM-backed filename-cleaning services.
The broader "extract and enrich metadata" pipeline (OpenAI provider, Vertex-
based Gemini grounding/URL-fetch extraction) has been removed -- only
filename cleaning (raw filename -> "Artist - Title") remains, currently
implemented by GeminiMetadataExtractor via the Gemini Developer API.
"""

import os
import time
from abc import ABC, abstractmethod
from collections import deque
from threading import Lock
from typing import Any, Dict, Optional

from loguru import logger

from src.services.simple_metadata_extractor import SimpleMetadataExtractor


def create_metadata_extractor(provider: str = "GEMINI", api_key: Optional[str] = None):
    """
    Factory function to create a filename-cleaning extractor.

    Args:
        provider: Provider name -- only "GEMINI" is supported.
        api_key: Optional API key. If not provided, will use environment variables.

    Returns:
        Instance of GeminiMetadataExtractor

    Raises:
        ValueError: If provider name is not recognized
    """
    provider_upper = provider.upper()

    if provider_upper == "GEMINI":
        from src.services.gemini_metadata_extractor import GeminiMetadataExtractor

        return GeminiMetadataExtractor(api_key=api_key)
    else:
        raise ValueError(
            f"Unknown provider: {provider}. Supported providers: 'GEMINI'"
        )


class RateLimiter:
    """Thread-safe rate limiter for API calls with exponential backoff."""

    def __init__(
        self,
        max_requests_per_minute: int = 60,
        max_requests_per_day: Optional[int] = None,
    ):
        """
        Initialize rate limiter.

        Args:
            max_requests_per_minute: Maximum requests per minute
            max_requests_per_day: Maximum requests per day (optional)
        """
        self.max_requests_per_minute = max_requests_per_minute
        self.max_requests_per_day = max_requests_per_day
        self.minute_requests: deque = deque()
        self.daily_requests: deque = deque()
        self.lock = Lock()

    def can_make_request(self) -> bool:
        """
        Check if a request can be made without hitting rate limits.

        Returns:
            True if request can be made, False otherwise
        """
        with self.lock:
            now = time.time()

            # Clean up old minute requests
            minute_ago = now - 60
            while self.minute_requests and self.minute_requests[0] < minute_ago:
                self.minute_requests.popleft()

            # Check minute limit
            if len(self.minute_requests) >= self.max_requests_per_minute:
                return False

            # Check daily limit if set
            if self.max_requests_per_day:
                day_ago = now - 86400  # 24 hours
                while self.daily_requests and self.daily_requests[0] < day_ago:
                    self.daily_requests.popleft()

                if len(self.daily_requests) >= self.max_requests_per_day:
                    return False

            return True

    def record_request(self):
        """Record that a request was made."""
        with self.lock:
            now = time.time()
            self.minute_requests.append(now)
            if self.max_requests_per_day:
                self.daily_requests.append(now)

    def get_wait_time(self) -> float:
        """
        Get the time to wait before making the next request.

        Returns:
            Seconds to wait (0 if no wait needed)
        """
        with self.lock:
            if self.can_make_request():
                return 0.0

            if not self.minute_requests:
                return 0.0

            # Calculate time until oldest request expires
            oldest_request = min(self.minute_requests)
            wait_time = 60 - (time.time() - oldest_request)
            return max(0.0, wait_time)


class BaseMetadataExtractor(ABC):
    """
    Base class for LLM-backed filename-cleaning services.

    Provides shared rate-limiting/retry infrastructure. Subclasses implement
    the provider-specific client and the actual cleaning calls.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_requests_per_minute: int = 60,
        max_requests_per_day: Optional[int] = None,
        max_retries: int = 3,
        initial_backoff: float = 1.0,
    ):
        """
        Initialize the base extractor.

        Args:
            api_key: API key for the provider
            max_requests_per_minute: Maximum requests per minute
            max_requests_per_day: Maximum requests per day (optional)
            max_retries: Maximum number of retries
            initial_backoff: Initial backoff time in seconds
        """
        self.api_key = api_key
        self.MAX_RETRIES = max_retries
        self.INITIAL_BACKOFF = initial_backoff

        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            max_requests_per_minute=max_requests_per_minute,
            max_requests_per_day=max_requests_per_day,
        )

        # Initialize ID3 tag extractor -- used by filename-cleaning batch calls
        # to enrich filenames that only contain a title
        self.id3_extractor = SimpleMetadataExtractor()

        # Provider-specific client initialization
        self.client = self._initialize_client()

    @abstractmethod
    def _initialize_client(self):
        """
        Initialize the provider-specific API client.

        Returns:
            API client instance or None if initialization fails
        """
        pass

    @abstractmethod
    def _is_available(self) -> bool:
        """
        Check if the service is available (API key configured and SDK available).

        Returns:
            True if service is available, False otherwise
        """
        pass

    @abstractmethod
    def _clean_filename_with_llm(self, filename: str) -> str:
        """
        Clean and normalize filename using LLM to extract core artist-title format.

        This removes extra metadata like country tags, years in parentheses,
        genre tags, etc., and normalizes the format to "Artist - Title".

        Args:
            filename: Raw filename to clean

        Returns:
            Cleaned filename in normalized format (e.g., "Artist - Title")
        """
        pass

    def get_rate_limit_stats(self) -> Dict[str, Any]:
        """
        Get rate limiting statistics.

        Returns:
            Dictionary with rate limiting information
        """
        wait_time = self.rate_limiter.get_wait_time()
        can_make_request = self.rate_limiter.can_make_request()

        with self.rate_limiter.lock:
            minute_requests = len(self.rate_limiter.minute_requests)
            daily_requests = (
                len(self.rate_limiter.daily_requests)
                if self.rate_limiter.max_requests_per_day
                else None
            )

        return {
            "can_make_request": can_make_request,
            "wait_time_seconds": round(wait_time, 2),
            "current_minute_requests": minute_requests,
            "max_requests_per_minute": self.rate_limiter.max_requests_per_minute,
            "current_daily_requests": daily_requests,
            "max_requests_per_day": self.rate_limiter.max_requests_per_day,
            "minute_utilization_percent": round(
                (minute_requests / self.rate_limiter.max_requests_per_minute) * 100,
                2,
            )
            if self.rate_limiter.max_requests_per_minute > 0
            else 0,
        }

    def _is_retryable_error(self, error_message: str) -> bool:
        """
        Determine if an error is retryable based on error message.

        Args:
            error_message: Error message (lowercase)

        Returns:
            True if error is retryable, False otherwise
        """
        return (
            "500" in error_message
            or "502" in error_message
            or "503" in error_message
            or "504" in error_message
            or "timeout" in error_message
            or "server" in error_message
            or "rate limit" in error_message
            or "quota" in error_message
        )
