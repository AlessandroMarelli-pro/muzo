"""
Configuration system for metadata extraction.

Loads and validates configuration from environment variables with sensible defaults.
"""

import os
from enum import Enum
from typing import Optional

from loguru import logger


class MetadataProvider(str, Enum):
    """Supported metadata providers."""

    GEMINI = "GEMINI"
    OPENAI = "OPENAI"


class MetadataMode(str, Enum):
    """Metadata extraction modes."""

    FAST = "fast"  # Minimal LLM usage
    BALANCED = "balanced"  # Default, balanced LLM usage
    ACCURATE = "accurate"  # Maximum LLM usage for best accuracy


class MetadataConfig:
    """
    Configuration for metadata extraction service.

    Loads settings from environment variables with sensible defaults.
    """

    def __init__(self):
        """Initialize configuration from environment variables."""
        # Provider configuration
        provider_str = os.getenv("METADATA_PROVIDER", "GEMINI").upper()
        try:
            self.provider = MetadataProvider(provider_str)
        except ValueError:
            logger.warning(
                f"Invalid METADATA_PROVIDER '{provider_str}', defaulting to GEMINI"
            )
            self.provider = MetadataProvider.GEMINI

        # Mode configuration
        mode_str = os.getenv("METADATA_MODE", "balanced").lower()
        try:
            self.mode = MetadataMode(mode_str)
        except ValueError:
            logger.warning(
                f"Invalid METADATA_MODE '{mode_str}', defaulting to balanced"
            )
            self.mode = MetadataMode.BALANCED

        # Feature flags
        self.use_discogs = (
            os.getenv("METADATA_USE_DISCOGS", "true").lower() == "true"
        )
        self.use_llm_fallback = (
            os.getenv("METADATA_USE_LLM_FALLBACK", "true").lower() == "true"
        )

        # Discogs configuration
        self.discogs_user_token = os.getenv("DISCOGS_USER_TOKEN")
        self.discogs_use_llm_selection = (
            os.getenv("DISCOGS_USE_LLM_SELECTION", "true").lower() == "true"
        )
        self.discogs_max_results = int(
            os.getenv("DISCOGS_MAX_RESULTS", "10")
        )
        self.discogs_min_confidence = float(
            os.getenv("DISCOGS_MIN_CONFIDENCE", "0.7")
        )

        # Redis cache configuration
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_cache_ttl_hours = int(
            os.getenv("REDIS_CACHE_TTL_HOURS", "24")
        )

        # Gradual rollout configuration
        # Percentage of requests to use Discogs enrichment (0-100)
        # Useful for gradual rollout and A/B testing
        rollout_percentage = int(os.getenv("METADATA_DISCOGS_ROLLOUT_PERCENTAGE", "100"))
        self.discogs_rollout_percentage = max(0, min(100, rollout_percentage))

        # Validate configuration
        self._validate()

    def _validate(self):
        """Validate configuration and log warnings for issues."""
        # Validate Discogs token if Discogs is enabled
        if self.use_discogs and not self.discogs_user_token:
            logger.warning(
                "METADATA_USE_DISCOGS is enabled but DISCOGS_USER_TOKEN is not set. "
                "Discogs enrichment will be disabled."
            )
            self.use_discogs = False

        # Validate mode-specific settings
        if self.mode == MetadataMode.FAST:
            # Fast mode should minimize LLM usage
            if self.discogs_use_llm_selection:
                logger.info(
                    "Fast mode: Disabling LLM selection for Discogs (using simple matching)"
                )
                self.discogs_use_llm_selection = False

        # Validate confidence threshold
        if not 0.0 <= self.discogs_min_confidence <= 1.0:
            logger.warning(
                f"DISCOGS_MIN_CONFIDENCE {self.discogs_min_confidence} is out of range [0.0, 1.0]. "
                "Defaulting to 0.7"
            )
            self.discogs_min_confidence = 0.7

        # Validate max results
        if self.discogs_max_results < 1 or self.discogs_max_results > 50:
            logger.warning(
                f"DISCOGS_MAX_RESULTS {self.discogs_max_results} is out of range [1, 50]. "
                "Defaulting to 10"
            )
            self.discogs_max_results = 10

        # Validate cache TTL
        if self.redis_cache_ttl_hours < 1:
            logger.warning(
                f"REDIS_CACHE_TTL_HOURS {self.redis_cache_ttl_hours} is less than 1. "
                "Defaulting to 24"
            )
            self.redis_cache_ttl_hours = 24

        # Log rollout percentage if not 100%
        if self.discogs_rollout_percentage < 100:
            logger.info(
                f"Discogs gradual rollout enabled: {self.discogs_rollout_percentage}% of requests "
                "will use Discogs enrichment"
            )

    def get_summary(self) -> dict:
        """
        Get a summary of current configuration.

        Returns:
            Dictionary with configuration summary
        """
        return {
            "provider": self.provider.value,
            "mode": self.mode.value,
            "use_discogs": self.use_discogs,
            "use_llm_fallback": self.use_llm_fallback,
            "discogs": {
                "use_llm_selection": self.discogs_use_llm_selection,
                "max_results": self.discogs_max_results,
                "min_confidence": self.discogs_min_confidence,
                "token_configured": bool(self.discogs_user_token),
            },
            "cache": {
                "host": self.redis_host,
                "port": self.redis_port,
                "ttl_hours": self.redis_cache_ttl_hours,
            },
            "rollout": {
                "discogs_percentage": self.discogs_rollout_percentage,
            },
        }

    def __repr__(self) -> str:
        """String representation of configuration."""
        return (
            f"MetadataConfig(provider={self.provider.value}, "
            f"mode={self.mode.value}, "
            f"use_discogs={self.use_discogs}, "
            f"use_llm_fallback={self.use_llm_fallback})"
        )
