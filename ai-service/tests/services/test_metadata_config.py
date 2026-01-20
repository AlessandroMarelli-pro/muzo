"""
Unit tests for MetadataConfig configuration system.

Tests all configuration modes, feature flags, and backward compatibility.
"""

import os
from unittest.mock import patch

import pytest

from src.config.metadata_config import MetadataConfig, MetadataMode, MetadataProvider


class TestMetadataConfig:
    """Test MetadataConfig class."""

    def test_default_configuration(self):
        """Test default configuration values."""
        with patch.dict(os.environ, {}, clear=True):
            config = MetadataConfig()

            assert config.provider == MetadataProvider.GEMINI
            assert config.mode == MetadataMode.BALANCED
            assert config.use_discogs is True
            assert config.use_llm_fallback is True
            assert config.discogs_use_llm_selection is True
            assert config.discogs_max_results == 10
            assert config.discogs_min_confidence == 0.7
            assert config.redis_host == "localhost"
            assert config.redis_port == 6379
            assert config.redis_cache_ttl_hours == 24

    def test_provider_configuration(self):
        """Test provider configuration options."""
        # Test GEMINI
        with patch.dict(os.environ, {"METADATA_PROVIDER": "GEMINI"}):
            config = MetadataConfig()
            assert config.provider == MetadataProvider.GEMINI

        # Test OPENAI
        with patch.dict(os.environ, {"METADATA_PROVIDER": "OPENAI"}):
            config = MetadataConfig()
            assert config.provider == MetadataProvider.OPENAI

        # Test invalid provider (should default to GEMINI)
        with patch.dict(os.environ, {"METADATA_PROVIDER": "INVALID"}):
            config = MetadataConfig()
            assert config.provider == MetadataProvider.GEMINI

    def test_mode_configuration(self):
        """Test mode configuration options."""
        # Test fast mode
        with patch.dict(os.environ, {"METADATA_MODE": "fast"}):
            config = MetadataConfig()
            assert config.mode == MetadataMode.FAST
            # Fast mode should disable LLM selection
            assert config.discogs_use_llm_selection is False

        # Test balanced mode
        with patch.dict(os.environ, {"METADATA_MODE": "balanced"}):
            config = MetadataConfig()
            assert config.mode == MetadataMode.BALANCED
            assert config.discogs_use_llm_selection is True

        # Test accurate mode
        with patch.dict(os.environ, {"METADATA_MODE": "accurate"}):
            config = MetadataConfig()
            assert config.mode == MetadataMode.ACCURATE
            assert config.discogs_use_llm_selection is True

        # Test invalid mode (should default to balanced)
        with patch.dict(os.environ, {"METADATA_MODE": "invalid"}):
            config = MetadataConfig()
            assert config.mode == MetadataMode.BALANCED

    def test_feature_flags(self):
        """Test feature flag configurations."""
        # Test Discogs enabled
        with patch.dict(os.environ, {"METADATA_USE_DISCOGS": "true"}):
            config = MetadataConfig()
            assert config.use_discogs is True

        # Test Discogs disabled
        with patch.dict(os.environ, {"METADATA_USE_DISCOGS": "false"}):
            config = MetadataConfig()
            assert config.use_discogs is False

        # Test LLM fallback enabled
        with patch.dict(os.environ, {"METADATA_USE_LLM_FALLBACK": "true"}):
            config = MetadataConfig()
            assert config.use_llm_fallback is True

        # Test LLM fallback disabled
        with patch.dict(os.environ, {"METADATA_USE_LLM_FALLBACK": "false"}):
            config = MetadataConfig()
            assert config.use_llm_fallback is False

    def test_discogs_configuration(self):
        """Test Discogs-specific configuration."""
        with patch.dict(
            os.environ,
            {
                "DISCOGS_USER_TOKEN": "test_token",
                "DISCOGS_USE_LLM_SELECTION": "false",
                "DISCOGS_MAX_RESULTS": "20",
                "DISCOGS_MIN_CONFIDENCE": "0.8",
            },
        ):
            config = MetadataConfig()

            assert config.discogs_user_token == "test_token"
            assert config.discogs_use_llm_selection is False
            assert config.discogs_max_results == 20
            assert config.discogs_min_confidence == 0.8

    def test_discogs_token_validation(self):
        """Test Discogs token validation."""
        # Test with token - should enable Discogs
        with patch.dict(os.environ, {"DISCOGS_USER_TOKEN": "test_token"}):
            config = MetadataConfig()
            assert config.use_discogs is True

        # Test without token - should disable Discogs
        with patch.dict(os.environ, {"METADATA_USE_DISCOGS": "true"}, clear=False):
            config = MetadataConfig()
            assert config.use_discogs is False

    def test_redis_configuration(self):
        """Test Redis cache configuration."""
        with patch.dict(
            os.environ,
            {
                "REDIS_HOST": "redis.example.com",
                "REDIS_PORT": "6380",
                "REDIS_CACHE_TTL_HOURS": "48",
            },
        ):
            config = MetadataConfig()

            assert config.redis_host == "redis.example.com"
            assert config.redis_port == 6380
            assert config.redis_cache_ttl_hours == 48

    def test_validation_confidence_threshold(self):
        """Test confidence threshold validation."""
        # Test valid threshold
        with patch.dict(os.environ, {"DISCOGS_MIN_CONFIDENCE": "0.5"}):
            config = MetadataConfig()
            assert config.discogs_min_confidence == 0.5

        # Test invalid threshold (too high) - should default to 0.7
        with patch.dict(os.environ, {"DISCOGS_MIN_CONFIDENCE": "1.5"}):
            config = MetadataConfig()
            assert config.discogs_min_confidence == 0.7

        # Test invalid threshold (negative) - should default to 0.7
        with patch.dict(os.environ, {"DISCOGS_MIN_CONFIDENCE": "-0.1"}):
            config = MetadataConfig()
            assert config.discogs_min_confidence == 0.7

    def test_validation_max_results(self):
        """Test max results validation."""
        # Test valid max results
        with patch.dict(os.environ, {"DISCOGS_MAX_RESULTS": "25"}):
            config = MetadataConfig()
            assert config.discogs_max_results == 25

        # Test invalid max results (too high) - should default to 10
        with patch.dict(os.environ, {"DISCOGS_MAX_RESULTS": "100"}):
            config = MetadataConfig()
            assert config.discogs_max_results == 10

        # Test invalid max results (too low) - should default to 10
        with patch.dict(os.environ, {"DISCOGS_MAX_RESULTS": "0"}):
            config = MetadataConfig()
            assert config.discogs_max_results == 10

    def test_validation_cache_ttl(self):
        """Test cache TTL validation."""
        # Test valid TTL
        with patch.dict(os.environ, {"REDIS_CACHE_TTL_HOURS": "12"}):
            config = MetadataConfig()
            assert config.redis_cache_ttl_hours == 12

        # Test invalid TTL (too low) - should default to 24
        with patch.dict(os.environ, {"REDIS_CACHE_TTL_HOURS": "0"}):
            config = MetadataConfig()
            assert config.redis_cache_ttl_hours == 24

    def test_get_summary(self):
        """Test configuration summary method."""
        with patch.dict(
            os.environ,
            {
                "METADATA_PROVIDER": "GEMINI",
                "METADATA_MODE": "balanced",
                "DISCOGS_USER_TOKEN": "test_token",
            },
        ):
            config = MetadataConfig()
            summary = config.get_summary()

            assert summary["provider"] == "GEMINI"
            assert summary["mode"] == "balanced"
            assert summary["use_discogs"] is True
            assert summary["use_llm_fallback"] is True
            assert summary["discogs"]["token_configured"] is True
            assert summary["cache"]["host"] == "localhost"
            assert summary["cache"]["port"] == 6379

    def test_backward_compatibility(self):
        """Test backward compatibility with missing environment variables."""
        # Test with minimal environment (should use defaults)
        with patch.dict(os.environ, {}, clear=True):
            config = MetadataConfig()

            # Should have sensible defaults
            assert config.provider == MetadataProvider.GEMINI
            assert config.mode == MetadataMode.BALANCED
            assert config.use_discogs is True  # Default enabled
            assert config.use_llm_fallback is True  # Default enabled

    def test_fast_mode_auto_disable_llm_selection(self):
        """Test that fast mode automatically disables LLM selection."""
        with patch.dict(
            os.environ,
            {
                "METADATA_MODE": "fast",
                "DISCOGS_USE_LLM_SELECTION": "true",  # Explicitly enabled
            },
        ):
            config = MetadataConfig()
            # Fast mode should override and disable LLM selection
            assert config.mode == MetadataMode.FAST
            assert config.discogs_use_llm_selection is False

    def test_all_modes_configuration(self):
        """Test all three modes with full configuration."""
        modes = ["fast", "balanced", "accurate"]

        for mode in modes:
            with patch.dict(
                os.environ,
                {
                    "METADATA_MODE": mode,
                    "METADATA_PROVIDER": "GEMINI",
                    "METADATA_USE_DISCOGS": "true",
                    "METADATA_USE_LLM_FALLBACK": "true",
                    "DISCOGS_USER_TOKEN": "test_token",
                },
            ):
                config = MetadataConfig()

                assert config.mode.value == mode
                assert config.provider == MetadataProvider.GEMINI
                assert config.use_discogs is True
                assert config.use_llm_fallback is True

                # Fast mode should disable LLM selection
                if mode == "fast":
                    assert config.discogs_use_llm_selection is False
                else:
                    assert config.discogs_use_llm_selection is True
