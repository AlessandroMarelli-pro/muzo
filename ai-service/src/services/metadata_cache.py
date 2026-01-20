"""
Metadata cache service for storing and retrieving metadata extraction results.

This service provides Redis-based caching for metadata results, using normalized
artist/title/mix combinations as cache keys.
"""

import json
from typing import Any, Dict, Optional

from loguru import logger

from src.utils.redis_cache import RedisCache


class MetadataCache:
    """
    Redis-based cache for metadata extraction results.

    Uses normalized artist/title/mix combinations as cache keys to ensure
    consistent caching across different input formats.
    """

    def __init__(self, key_prefix: str = "metadata", default_ttl_hours: int = 24):
        """
        Initialize metadata cache.

        Args:
            key_prefix: Prefix for cache keys (default: "metadata")
            default_ttl_hours: Default TTL in hours (default: 24)
        """
        self.key_prefix = key_prefix
        self.default_ttl_seconds = default_ttl_hours * 3600
        self.redis_cache = RedisCache(key_prefix=key_prefix)

    def _make_key(self, artist: str, title: str, mix: Optional[str] = None) -> str:
        """
        Generate a normalized cache key from artist, title, and optional mix.

        Args:
            artist: Normalized artist name
            title: Normalized title
            mix: Optional mix/remix name

        Returns:
            Normalized cache key string
        """
        # Normalize components
        artist_norm = artist.lower().strip() if artist else ""
        title_norm = title.lower().strip() if title else ""
        mix_norm = mix.lower().strip() if mix else ""

        # Build key: artist:title:mix (mix omitted if empty)
        if mix_norm:
            key = f"{artist_norm}:{title_norm}:{mix_norm}"
        else:
            key = f"{artist_norm}:{title_norm}"

        return key

    def get(
        self, artist: str, title: str, mix: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached metadata for artist/title/mix combination.

        Args:
            artist: Normalized artist name
            title: Normalized title
            mix: Optional mix/remix name

        Returns:
            Cached metadata dictionary or None if not found
        """
        try:
            cache_key = self._make_key(artist, title, mix)
            cached_data = self.redis_cache.get("metadata", cache_key)

            if cached_data:
                # Extract metadata from wrapper if present
                if isinstance(cached_data, dict) and "metadata" in cached_data:
                    metadata = cached_data["metadata"]
                else:
                    # Handle legacy format or direct metadata
                    metadata = cached_data

                logger.debug(
                    f"Cache hit for metadata: {artist} - {title}"
                    + (f" ({mix})" if mix else "")
                )
                return metadata
            else:
                logger.debug(
                    f"Cache miss for metadata: {artist} - {title}"
                    + (f" ({mix})" if mix else "")
                )
                return None

        except Exception as e:
            logger.warning(f"Error getting metadata cache: {e}")
            return None

    def set(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        metadata: Dict[str, Any],
        ttl_hours: Optional[int] = None,
    ) -> bool:
        """
        Cache metadata for artist/title/mix combination.

        Args:
            artist: Normalized artist name
            title: Normalized title
            mix: Optional mix/remix name
            metadata: Metadata dictionary to cache
            ttl_hours: Optional TTL in hours (uses default if None)

        Returns:
            True if successful, False otherwise
        """
        try:
            cache_key = self._make_key(artist, title, mix)
            ttl_seconds = (
                ttl_hours * 3600 if ttl_hours else self.default_ttl_seconds
            )

            # Wrap metadata in a structure that RedisCache can handle
            # RedisCache uses json.loads/dumps, so any JSON-serializable dict works
            cache_data = {"metadata": metadata}

            result = self.redis_cache.set("metadata", cache_key, cache_data, ttl=ttl_seconds)
            if result:
                logger.debug(
                    f"Cached metadata: {artist} - {title}"
                    + (f" ({mix})" if mix else "")
                    + f" (TTL: {ttl_seconds}s)"
                )
            return result

        except Exception as e:
            logger.warning(f"Error setting metadata cache: {e}")
            return False

    def clear_pattern(self, pattern: str) -> int:
        """
        Clear cache entries matching a pattern.

        Args:
            pattern: Pattern to match (e.g., "artist:*" or "*:title:*")

        Returns:
            Number of keys deleted
        """
        try:
            # Build full pattern with prefix
            full_pattern = f"{self.key_prefix}:metadata:{pattern}"
            return self.redis_cache.clear_pattern(full_pattern)

        except Exception as e:
            logger.warning(f"Error clearing metadata cache pattern: {e}")
            return 0

    def is_available(self) -> bool:
        """
        Check if Redis cache is available.

        Returns:
            True if available, False otherwise
        """
        return self.redis_cache.is_available()
