"""
Configuration management for music identification services.

This module provides configuration management for API keys, rate limits,
and other settings for the music identification services.
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from loguru import logger


@dataclass
class AcoustidConfig:
    """Configuration for Acoustid API."""

    api_key: Optional[str] = None
    max_calls_per_second: int = 3
    timeout_seconds: int = 30
    max_retries: int = 3
    base_url: str = "https://api.acoustid.org/v2/"

    def __post_init__(self):
        """Load API key from environment if not provided."""
        if not self.api_key:
            self.api_key = os.getenv("ACOUSTID_API_KEY")
            if self.api_key:
                logger.info("Acoustid API key loaded from environment")
            else:
                logger.warning("No Acoustid API key found in environment")


@dataclass
class MusicBrainzConfig:
    """Configuration for MusicBrainz API."""

    user_agent: str = "MuzoMusicIdentification/1.0"
    max_calls_per_second: int = 1
    timeout_seconds: int = 30
    max_retries: int = 3
    base_url: str = "https://musicbrainz.org/ws/2/"

    def __post_init__(self):
        """Set up user agent."""
        logger.info(f"MusicBrainz user agent set to: {self.user_agent}")


@dataclass
class IdentificationConfig:
    """Configuration for music identification service."""

    acoustid: AcoustidConfig = field(default_factory=AcoustidConfig)
    musicbrainz: MusicBrainzConfig = field(default_factory=MusicBrainzConfig)

    # General settings
    min_confidence_threshold: float = 0.8
    max_search_results: int = 10
    enable_fallback_search: bool = True
    cache_results: bool = True
    cache_ttl_seconds: int = 3600  # 1 hour

    # Performance settings
    max_audio_duration_seconds: int = 600  # 10 minutes
    min_audio_duration_seconds: float = 1.0  # 1 second

    def __post_init__(self):
        """Validate configuration."""
        self._validate_config()

    def _validate_config(self):
        """Validate configuration values."""
        if not 0.0 <= self.min_confidence_threshold <= 1.0:
            raise ValueError("min_confidence_threshold must be between 0.0 and 1.0")

        if self.max_search_results <= 0:
            raise ValueError("max_search_results must be positive")

        if self.max_audio_duration_seconds <= self.min_audio_duration_seconds:
            raise ValueError(
                "max_audio_duration_seconds must be greater than min_audio_duration_seconds"
            )

        logger.info("Configuration validation passed")


def load_config_from_env() -> IdentificationConfig:
    """
    Load configuration from environment variables.

    Returns:
        IdentificationConfig with values from environment
    """
    config = IdentificationConfig()

    # Load Acoustid settings
    if os.getenv("ACOUSTID_MAX_CALLS_PER_SECOND"):
        config.acoustid.max_calls_per_second = int(
            os.getenv("ACOUSTID_MAX_CALLS_PER_SECOND")
        )

    if os.getenv("ACOUSTID_TIMEOUT_SECONDS"):
        config.acoustid.timeout_seconds = int(os.getenv("ACOUSTID_TIMEOUT_SECONDS"))

    if os.getenv("ACOUSTID_MAX_RETRIES"):
        config.acoustid.max_retries = int(os.getenv("ACOUSTID_MAX_RETRIES"))

    # Load MusicBrainz settings
    if os.getenv("MUSICBRAINZ_USER_AGENT"):
        config.musicbrainz.user_agent = os.getenv("MUSICBRAINZ_USER_AGENT")

    if os.getenv("MUSICBRAINZ_MAX_CALLS_PER_SECOND"):
        config.musicbrainz.max_calls_per_second = int(
            os.getenv("MUSICBRAINZ_MAX_CALLS_PER_SECOND")
        )

    if os.getenv("MUSICBRAINZ_TIMEOUT_SECONDS"):
        config.musicbrainz.timeout_seconds = int(
            os.getenv("MUSICBRAINZ_TIMEOUT_SECONDS")
        )

    # Load general settings
    if os.getenv("MIN_CONFIDENCE_THRESHOLD"):
        config.min_confidence_threshold = float(os.getenv("MIN_CONFIDENCE_THRESHOLD"))

    if os.getenv("MAX_SEARCH_RESULTS"):
        config.max_search_results = int(os.getenv("MAX_SEARCH_RESULTS"))

    if os.getenv("ENABLE_FALLBACK_SEARCH"):
        config.enable_fallback_search = (
            os.getenv("ENABLE_FALLBACK_SEARCH").lower() == "true"
        )

    if os.getenv("CACHE_RESULTS"):
        config.cache_results = os.getenv("CACHE_RESULTS").lower() == "true"

    if os.getenv("CACHE_TTL_SECONDS"):
        config.cache_ttl_seconds = int(os.getenv("CACHE_TTL_SECONDS"))

    logger.info("Configuration loaded from environment variables")
    return config


def get_default_config() -> IdentificationConfig:
    """
    Get default configuration.

    Returns:
        Default IdentificationConfig
    """
    return IdentificationConfig()


# Global configuration instance
_config: Optional[IdentificationConfig] = None


def get_config() -> IdentificationConfig:
    """
    Get the global configuration instance.

    Returns:
        Global IdentificationConfig instance
    """
    global _config
    if _config is None:
        _config = load_config_from_env()
    return _config


def set_config(config: IdentificationConfig):
    """
    Set the global configuration instance.

    Args:
        config: Configuration to set as global
    """
    global _config
    _config = config
    logger.info("Global configuration updated")


def reset_config():
    """Reset the global configuration to default."""
    global _config
    _config = None
    logger.info("Global configuration reset")
