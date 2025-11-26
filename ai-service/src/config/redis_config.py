"""
Redis configuration for caching services.
"""

import os
from typing import Optional

import redis
from loguru import logger


class RedisConfig:
    """Redis configuration and connection management."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        password: Optional[str] = None,
        db: Optional[int] = None,
        decode_responses: bool = True,
        socket_timeout: int = 5,
        socket_connect_timeout: int = 5,
        retry_on_timeout: bool = True,
        health_check_interval: int = 30,
    ):
        """
        Initialize Redis configuration.

        Args:
            host: Redis host (default: localhost)
            port: Redis port (default: 6379)
            password: Redis password (optional)
            db: Redis database number (default: 0)
            decode_responses: Whether to decode responses (default: True)
            socket_timeout: Socket timeout in seconds (default: 5)
            socket_connect_timeout: Socket connect timeout in seconds (default: 5)
            retry_on_timeout: Whether to retry on timeout (default: True)
            health_check_interval: Health check interval in seconds (default: 30)
        """
        self.host = host or os.getenv("REDIS_HOST", "localhost")
        self.port = port or int(os.getenv("REDIS_PORT", "6379"))
        self.password = password or os.getenv("REDIS_PASSWORD")
        self.db = db or int(os.getenv("REDIS_DB", "0"))
        self.decode_responses = decode_responses
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout
        self.retry_on_timeout = retry_on_timeout
        self.health_check_interval = health_check_interval

        # Cache TTL settings
        self.discogs_cache_ttl = int(os.getenv("DISCOGS_CACHE_TTL", "3600"))  # 1 hour
        self.artist_cache_ttl = int(os.getenv("ARTIST_CACHE_TTL", "7200"))  # 2 hours

        self._client: Optional[redis.Redis] = None

    def get_client(self) -> redis.Redis:
        """
        Get Redis client instance.

        Returns:
            Redis client instance
        """
        if self._client is None:
            try:
                self._client = redis.Redis(
                    host=self.host,
                    port=self.port,
                    password=self.password,
                    db=self.db,
                    decode_responses=self.decode_responses,
                    socket_timeout=self.socket_timeout,
                    socket_connect_timeout=self.socket_connect_timeout,
                    retry_on_timeout=self.retry_on_timeout,
                    health_check_interval=self.health_check_interval,
                )

                # Test connection
                self._client.ping()
                logger.info(f"Redis connected successfully to {self.host}:{self.port}")

            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise

        return self._client

    def is_available(self) -> bool:
        """
        Check if Redis is available.

        Returns:
            True if Redis is available, False otherwise
        """
        try:
            client = self.get_client()
            client.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis not available: {e}")
            return False

    def close(self):
        """Close Redis connection."""
        if self._client:
            try:
                self._client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            finally:
                self._client = None


# Global Redis configuration instance
redis_config = RedisConfig()
