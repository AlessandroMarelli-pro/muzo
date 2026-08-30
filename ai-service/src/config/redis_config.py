"""
Redis configuration for caching services.
"""

import os
import time
from typing import Optional

import redis
from loguru import logger

# How long to remember "Redis is unreachable" before trying to connect again.
# Without this, every failed publish/cache call re-runs the full connect + ping
# (5s socket_connect_timeout) -- and on a deployment with no Redis at all
# (REDIS_HOST unset -> localhost, connection refused) the scan path attempts a
# connection dozens of times per file.
_UNAVAILABLE_COOLDOWN_S = 60


class RedisUnavailable(RuntimeError):
    """Raised by RedisConfig.get_client when Redis is disabled for this
    deployment or a recent connection attempt failed (cooldown active). Callers
    already treat any get_client failure as "skip this, it's optional" -- this
    just gives them a specific type and avoids the repeated slow connect."""


def redis_explicitly_disabled() -> bool:
    """True when the deployment has opted out of Redis entirely. On such a
    deployment (e.g. the HF Inference Endpoint) callers should no-op without ever
    attempting a socket connection."""
    if os.getenv("DISABLE_REDIS", "").lower() in ("1", "true", "yes"):
        return True
    # No REDIS_HOST set at all -> there is no Redis to reach (the localhost
    # default only makes sense for local dev / docker-compose, which set it).
    return os.getenv("REDIS_HOST") is None


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
        # Timestamp of the last failed connect, for the negative-result cooldown.
        self._unavailable_since: float = 0.0
        self._disabled = redis_explicitly_disabled()
        if self._disabled:
            logger.debug(
                "Redis disabled (DISABLE_REDIS set or REDIS_HOST unset) -- "
                "cache and scan-progress publishing are no-ops"
            )

    def get_client(self) -> redis.Redis:
        """
        Get Redis client instance.

        Raises RedisUnavailable when Redis is disabled or a recent connect
        failed (within the cooldown) so callers skip the work without eating a
        fresh 5s connect timeout every call.
        """
        if self._disabled:
            raise RedisUnavailable("Redis is disabled for this deployment")

        if self._client is None:
            if (
                self._unavailable_since
                and time.time() - self._unavailable_since < _UNAVAILABLE_COOLDOWN_S
            ):
                raise RedisUnavailable("Redis marked unavailable (cooldown active)")
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
                logger.debug(f"Redis connected successfully to {self.host}:{self.port}")
                self._unavailable_since = 0.0

            except Exception as e:
                self._client = None
                if not self._unavailable_since:
                    # Log at ERROR only on the first failure of a cooldown
                    # window; subsequent skips are silent.
                    logger.error(
                        f"Failed to connect to Redis ({self.host}:{self.port}): {e} "
                        f"-- suppressing further attempts for {_UNAVAILABLE_COOLDOWN_S}s"
                    )
                self._unavailable_since = time.time()
                raise RedisUnavailable(str(e)) from e

        return self._client

    def is_available(self) -> bool:
        """
        Check if Redis is available.

        Returns:
            True if Redis is available, False otherwise
        """
        if self._disabled:
            return False
        try:
            client = self.get_client()
            client.ping()
            return True
        except RedisUnavailable:
            return False
        except Exception as e:
            logger.warning(f"Redis not available: {e}")
            return False

    def close(self):
        """Close Redis connection."""
        if self._client:
            try:
                self._client.close()
                logger.debug("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            finally:
                self._client = None


# Global Redis configuration instance
redis_config = RedisConfig()
