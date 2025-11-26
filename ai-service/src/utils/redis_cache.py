"""
Redis cache utility for Discogs and other services.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional, Union

import redis
from loguru import logger

from src.config.redis_config import redis_config


class RedisCache:
    """Redis cache utility with JSON serialization and key management."""

    def __init__(self, key_prefix: str = "muzo"):
        """
        Initialize Redis cache.

        Args:
            key_prefix: Prefix for all cache keys
        """
        self.key_prefix = key_prefix
        self.redis_config = redis_config
        self._client: Optional[redis.Redis] = None

    def _get_client(self) -> Optional[redis.Redis]:
        """
        Get Redis client with error handling.

        Returns:
            Redis client or None if unavailable
        """
        try:
            if self._client is None:
                self._client = self.redis_config.get_client()
            return self._client
        except Exception as e:
            logger.warning(f"Redis client unavailable: {e}")
            return None

    def _generate_key(self, cache_type: str, identifier: str) -> str:
        """
        Generate a cache key.

        Args:
            cache_type: Type of cache (e.g., 'discogs', 'artist')
            identifier: Unique identifier for the cached item

        Returns:
            Generated cache key
        """
        # Create a hash of the identifier to ensure consistent key length
        identifier_hash = hashlib.md5(identifier.encode()).hexdigest()[:16]
        return f"{self.key_prefix}:{cache_type}:{identifier_hash}"

    def get(self, cache_type: str, identifier: str) -> Optional[Dict[str, List[str]]]:
        """
        Get cached data.

        Args:
            cache_type: Type of cache
            identifier: Unique identifier

        Returns:
            Cached data or None if not found
        """
        client = self._get_client()
        if not client:
            return None

        try:
            key = self._generate_key(cache_type, identifier)
            cached_data = client.get(key)

            if cached_data:
                data = json.loads(cached_data)
                logger.debug(f"Cache hit for {cache_type}: {identifier}")
                return data
            else:
                logger.debug(f"Cache miss for {cache_type}: {identifier}")
                return None

        except Exception as e:
            logger.warning(f"Error getting cache for {cache_type}:{identifier}: {e}")
            return None

    def set(
        self,
        cache_type: str,
        identifier: str,
        data: Dict[str, List[str]],
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Set cached data.

        Args:
            cache_type: Type of cache
            identifier: Unique identifier
            data: Data to cache
            ttl: Time to live in seconds (uses default if None)

        Returns:
            True if successful, False otherwise
        """
        client = self._get_client()
        if not client:
            return False

        try:
            key = self._generate_key(cache_type, identifier)
            json_data = json.dumps(data)

            # Use default TTL if not specified
            if ttl is None:
                if cache_type == "discogs":
                    ttl = self.redis_config.discogs_cache_ttl
                elif cache_type == "artist":
                    ttl = self.redis_config.artist_cache_ttl
                else:
                    ttl = 3600  # Default 1 hour

            result = client.setex(key, ttl, json_data)
            if result:
                logger.debug(f"Cached {cache_type}: {identifier} (TTL: {ttl}s)")
                return True
            else:
                logger.warning(f"Failed to cache {cache_type}: {identifier}")
                return False

        except Exception as e:
            logger.warning(f"Error setting cache for {cache_type}:{identifier}: {e}")
            return False

    def delete(self, cache_type: str, identifier: str) -> bool:
        """
        Delete cached data.

        Args:
            cache_type: Type of cache
            identifier: Unique identifier

        Returns:
            True if successful, False otherwise
        """
        client = self._get_client()
        if not client:
            return False

        try:
            key = self._generate_key(cache_type, identifier)
            result = client.delete(key)
            if result:
                logger.debug(f"Deleted cache for {cache_type}: {identifier}")
                return True
            else:
                logger.debug(f"Cache not found for deletion {cache_type}: {identifier}")
                return False

        except Exception as e:
            logger.warning(f"Error deleting cache for {cache_type}:{identifier}: {e}")
            return False

    def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching a pattern.

        Args:
            pattern: Redis key pattern (e.g., "muzo:discogs:*")

        Returns:
            Number of keys deleted
        """
        client = self._get_client()
        if not client:
            return 0

        try:
            keys = client.keys(pattern)
            if keys:
                deleted = client.delete(*keys)
                logger.info(f"Cleared {deleted} cache keys matching pattern: {pattern}")
                return deleted
            return 0

        except Exception as e:
            logger.warning(f"Error clearing cache pattern {pattern}: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        client = self._get_client()
        if not client:
            return {"available": False, "error": "Redis not available"}

        try:
            info = client.info()
            keys = client.keys(f"{self.key_prefix}:*")

            return {
                "available": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "0B"),
                "total_keys": len(keys),
                "discogs_keys": len(client.keys(f"{self.key_prefix}:discogs:*")),
                "artist_keys": len(client.keys(f"{self.key_prefix}:artist:*")),
            }

        except Exception as e:
            logger.warning(f"Error getting cache stats: {e}")
            return {"available": False, "error": str(e)}

    def is_available(self) -> bool:
        """
        Check if Redis cache is available.

        Returns:
            True if available, False otherwise
        """
        return self.redis_config.is_available()
