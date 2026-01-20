"""
Unit tests for MetadataCache service.

Tests Redis-based caching with mocked Redis dependencies.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from src.services.metadata_cache import MetadataCache


class TestMetadataCache:
    """Test MetadataCache class."""

    def test_make_key_without_mix(self):
        """Test cache key generation without mix."""
        cache = MetadataCache()
        key = cache._make_key("artist", "title")

        assert key == "artist:title"

    def test_make_key_with_mix(self):
        """Test cache key generation with mix."""
        cache = MetadataCache()
        key = cache._make_key("artist", "title", "remix")

        assert key == "artist:title:remix"

    def test_make_key_normalization(self):
        """Test cache key normalization."""
        cache = MetadataCache()
        key = cache._make_key("  ARTIST  ", "  TITLE  ", "  MIX  ")

        assert key == "artist:title:mix"

    def test_get_cache_hit(self):
        """Test getting cached metadata (cache hit)."""
        cache = MetadataCache()

        # Mock Redis cache
        mock_cached_data = {"metadata": {"artist": "Artist", "title": "Title"}}

        with patch.object(cache.redis_cache, "get", return_value=mock_cached_data):
            result = cache.get("artist", "title")

            assert result is not None
            assert result["artist"] == "Artist"
            assert result["title"] == "Title"

    def test_get_cache_miss(self):
        """Test getting cached metadata (cache miss)."""
        cache = MetadataCache()

        # Mock Redis cache to return None
        with patch.object(cache.redis_cache, "get", return_value=None):
            result = cache.get("artist", "title")

            assert result is None

    def test_get_legacy_format(self):
        """Test getting cached metadata in legacy format."""
        cache = MetadataCache()

        # Mock Redis cache with direct metadata (no wrapper)
        mock_cached_data = {"artist": "Artist", "title": "Title"}

        with patch.object(cache.redis_cache, "get", return_value=mock_cached_data):
            result = cache.get("artist", "title")

            assert result is not None
            assert result["artist"] == "Artist"
            assert result["title"] == "Title"

    def test_set_cache(self):
        """Test setting cached metadata."""
        cache = MetadataCache()

        metadata = {"artist": "Artist", "title": "Title"}

        with patch.object(cache.redis_cache, "set", return_value=True) as mock_set:
            result = cache.set("artist", "title", None, metadata)

            assert result is True
            mock_set.assert_called_once()
            # Verify the call includes wrapped metadata
            call_args = mock_set.call_args
            assert "metadata" in call_args[0][2]

    def test_set_cache_with_mix(self):
        """Test setting cached metadata with mix."""
        cache = MetadataCache()

        metadata = {"artist": "Artist", "title": "Title", "mix": "Remix"}

        with patch.object(cache.redis_cache, "set", return_value=True):
            result = cache.set("artist", "title", "remix", metadata)

            assert result is True

    def test_set_cache_with_custom_ttl(self):
        """Test setting cached metadata with custom TTL."""
        cache = MetadataCache(default_ttl_hours=24)

        metadata = {"artist": "Artist", "title": "Title"}

        with patch.object(cache.redis_cache, "set", return_value=True) as mock_set:
            cache.set("artist", "title", None, metadata, ttl_hours=48)

            # Verify TTL was converted to seconds
            call_args = mock_set.call_args
            assert call_args[1]["ttl"] == 48 * 3600

    def test_set_cache_error(self):
        """Test error handling when setting cache fails."""
        cache = MetadataCache()

        metadata = {"artist": "Artist", "title": "Title"}

        with patch.object(cache.redis_cache, "set", side_effect=Exception("Redis error")):
            result = cache.set("artist", "title", None, metadata)

            assert result is False

    def test_get_cache_error(self):
        """Test error handling when getting cache fails."""
        cache = MetadataCache()

        with patch.object(cache.redis_cache, "get", side_effect=Exception("Redis error")):
            result = cache.get("artist", "title")

            assert result is None

    def test_clear_pattern(self):
        """Test clearing cache entries by pattern."""
        cache = MetadataCache()

        with patch.object(cache.redis_cache, "clear_pattern", return_value=5) as mock_clear:
            result = cache.clear_pattern("artist:*")

            assert result == 5
            mock_clear.assert_called_once()
            # Verify pattern includes prefix
            call_args = mock_clear.call_args
            assert "metadata:artist:*" in call_args[0][0]

    def test_clear_pattern_error(self):
        """Test error handling when clearing cache fails."""
        cache = MetadataCache()

        with patch.object(
            cache.redis_cache, "clear_pattern", side_effect=Exception("Redis error")
        ):
            result = cache.clear_pattern("artist:*")

            assert result == 0

    def test_is_available(self):
        """Test checking if Redis cache is available."""
        cache = MetadataCache()

        with patch.object(cache.redis_cache, "is_available", return_value=True):
            assert cache.is_available() is True

        with patch.object(cache.redis_cache, "is_available", return_value=False):
            assert cache.is_available() is False

    def test_default_ttl(self):
        """Test default TTL configuration."""
        cache = MetadataCache(default_ttl_hours=12)

        assert cache.default_ttl_seconds == 12 * 3600

    def test_key_prefix(self):
        """Test key prefix configuration."""
        cache = MetadataCache(key_prefix="test_prefix")

        assert cache.key_prefix == "test_prefix"
