"""
Simple Discogs API connector for retrieving genre information.

This service uses the Discogs API to fetch genre and subgenre information
for music tracks based on artist and title extracted from filenames.
"""

import os
import time
from enum import Enum
from typing import Any, Dict, List, Optional

import discogs_client
from loguru import logger
from src.config.settings import Config
from src.services.simple_filename_parser import SimpleFilenameParser
from src.utils.performance_optimizer import monitor_performance
from src.utils.redis_cache import RedisCache


class DiscogsErrorType(Enum):
    """Types of Discogs API errors."""

    RATE_LIMIT = "rate_limit"
    NETWORK_ERROR = "network_error"
    AUTHENTICATION_ERROR = "authentication_error"
    SERVER_ERROR = "server_error"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


class CircuitBreakerState(Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Circuit is open, failing fast
    HALF_OPEN = "half_open"  # Testing if service is back


class DiscogsError(Exception):
    """Custom exception for Discogs API errors."""

    def __init__(
        self,
        error_type: DiscogsErrorType,
        message: str,
        retry_after: Optional[int] = None,
    ):
        self.error_type = error_type
        self.retry_after = retry_after
        super().__init__(message)


class RateLimiter:
    """Simple rate limiter to prevent hitting Discogs API limits."""

    def __init__(self, max_requests_per_minute: int = 60):
        """
        Initialize rate limiter.

        Args:
            max_requests_per_minute: Maximum requests per minute (Discogs allows 60/min)
        """
        self.max_requests = max_requests_per_minute
        self.requests = []
        self.window_size = 60  # 1 minute window

    def can_make_request(self) -> bool:
        """
        Check if we can make a request without hitting rate limits.

        Returns:
            True if request can be made, False otherwise
        """
        now = time.time()

        # Remove requests older than 1 minute
        self.requests = [
            req_time for req_time in self.requests if now - req_time < self.window_size
        ]

        # Check if we're under the limit
        return len(self.requests) < self.max_requests

    def record_request(self):
        """Record that a request was made."""
        self.requests.append(time.time())

    def get_wait_time(self) -> float:
        """
        Get the time to wait before making the next request.

        Returns:
            Seconds to wait (0 if no wait needed)
        """
        if self.can_make_request():
            return 0.0

        if not self.requests:
            return 0.0

        # Calculate time until oldest request expires
        oldest_request = min(self.requests)
        wait_time = self.window_size - (time.time() - oldest_request)
        return max(0.0, wait_time)


class DiscogsConnector:
    """
    Enhanced Discogs API connector with multiple API keys, circuit breaker, and caching.

    Features:
    - Multiple API key load balancing with round-robin distribution
    - Circuit breaker pattern for fault tolerance
    - Redis caching for improved performance
    - Proactive rate limiting per API key
    - Comprehensive error handling and retry logic
    - Service status monitoring and statistics
    """

    def __init__(self, api_keys: Optional[List[str]] = None, enable_cache: bool = True):
        """
        Initialize the Discogs connector with multiple API keys.

        Args:
            api_keys: List of Discogs API keys for load balancing
            enable_cache: Whether to enable Redis caching (default: True)
        """
        # Get API keys from parameter, environment, or config
        if api_keys:
            self.api_keys = api_keys
        else:
            # Try environment variable first
            env_keys = os.getenv("DISCOGS_API_KEYS", "").split(",")
            env_keys = [key.strip() for key in env_keys if key.strip()]

            if env_keys:
                self.api_keys = env_keys
            else:
                # Fallback to single token
                single_token = os.getenv("DISCOGS_USER_TOKEN")
                self.api_keys = [single_token] if single_token else []

        self.enable_cache = enable_cache
        self.current_key_index = 0

        # Initialize Redis cache
        if self.enable_cache:
            try:
                self.cache = RedisCache(key_prefix="discogs")
                if self.cache.is_available():
                    logger.info("Redis cache enabled for Discogs service")
                else:
                    logger.warning(
                        "Redis cache unavailable, falling back to no caching"
                    )
                    self.enable_cache = False
            except Exception as e:
                logger.warning(f"Failed to initialize Redis cache: {e}")
                self.enable_cache = False
        else:
            self.cache = None
            logger.info("Redis cache disabled for Discogs service")

        # Initialize multiple clients and rate limiters
        self.clients = []
        self.key_rate_limiters = []
        self.circuit_breakers = {}

        # Circuit breaker configuration
        self.circuit_breaker_enabled = Config.DISCOGS_CIRCUIT_BREAKER_ENABLED
        self.failure_threshold = Config.DISCOGS_FAILURE_THRESHOLD
        self.recovery_timeout = Config.DISCOGS_RECOVERY_TIMEOUT

        for i, api_key in enumerate(self.api_keys):
            try:
                # Create client for this API key
                client = discogs_client.Client("MuzoMusicApp/1.0", user_token=api_key)
                # Disable built-in rate limiting since we handle it manually
                client.backoff_enabled = False
                self.clients.append(client)

                # Create rate limiter for this key
                rate_limiter = RateLimiter(max_requests_per_minute=60)
                self.key_rate_limiters.append(rate_limiter)

                # Initialize circuit breaker for this key
                self.circuit_breakers[i] = {
                    "state": CircuitBreakerState.CLOSED,
                    "failure_count": 0,
                    "last_failure_time": None,
                    "success_count": 0,
                    "total_requests": 0,
                }

                logger.info(
                    f"Initialized Discogs client {i + 1}/{len(self.api_keys)} (key: {api_key[:8]}...)"
                )

            except Exception as e:
                logger.error(f"Failed to initialize Discogs client {i + 1}: {e}")
                # Remove failed client
                if len(self.clients) > i:
                    self.clients.pop()
                if len(self.key_rate_limiters) > i:
                    self.key_rate_limiters.pop()

        if not self.clients:
            logger.warning(
                "No valid Discogs API keys found, using unauthenticated client"
            )
            client = discogs_client.Client("MuzoMusicApp/1.0")
            # Disable built-in rate limiting since we handle it manually
            client.backoff_enabled = False
            self.clients = [client]
            self.key_rate_limiters = [RateLimiter(max_requests_per_minute=60)]
            self.circuit_breakers[0] = {
                "state": CircuitBreakerState.CLOSED,
                "failure_count": 0,
                "last_failure_time": None,
                "success_count": 0,
                "total_requests": 0,
            }

        self.filename_parser = SimpleFilenameParser()
        logger.info(
            f"DiscogsConnector initialized with {len(self.clients)} API keys and circuit breaker"
        )

    def _is_circuit_open(self, key_index: int) -> bool:
        """Check if circuit breaker is open for a key."""
        if not self.circuit_breaker_enabled:
            return False

        breaker = self.circuit_breakers[key_index]

        if breaker["state"] == CircuitBreakerState.OPEN:
            # Check if recovery timeout has passed
            if (time.time() - breaker["last_failure_time"]) > self.recovery_timeout:
                breaker["state"] = CircuitBreakerState.HALF_OPEN
                breaker["failure_count"] = 0
                logger.info(f"Circuit breaker for key {key_index} moved to HALF_OPEN")
                return False
            return True

        return False

    def _update_circuit_breaker(self, key_index: int, success: bool):
        """Update circuit breaker state based on request result."""
        if not self.circuit_breaker_enabled:
            return

        breaker = self.circuit_breakers[key_index]
        breaker["total_requests"] += 1

        if success:
            breaker["success_count"] += 1
            if breaker["state"] == CircuitBreakerState.HALF_OPEN:
                breaker["state"] = CircuitBreakerState.CLOSED
                logger.info(f"Circuit breaker for key {key_index} moved to CLOSED")
        else:
            breaker["failure_count"] += 1
            breaker["last_failure_time"] = time.time()

            # Open circuit if failure threshold reached
            if breaker["failure_count"] >= self.failure_threshold:
                breaker["state"] = CircuitBreakerState.OPEN
                logger.warning(f"Circuit breaker opened for API key {key_index}")

    def _get_available_client(self) -> Optional[tuple]:
        """Get next available client that's not rate limited or circuit broken."""
        # Try all keys starting from current index
        for i in range(len(self.clients)):
            key_index = (self.current_key_index + i) % len(self.clients)

            # Skip if circuit breaker is open
            if self._is_circuit_open(key_index):
                continue

            # Skip if rate limited
            if not self.key_rate_limiters[key_index].can_make_request():
                continue

            # Found an available key - update current index for next time
            self.current_key_index = (key_index + 1) % len(self.clients)
            return self.clients[key_index], key_index

        return None, None

    def get_key_rotation_status(self) -> Dict[str, Any]:
        """
        Get current key rotation status for debugging.

        Returns:
            Dictionary with key rotation information
        """
        status = {
            "current_key_index": self.current_key_index,
            "total_keys": len(self.clients),
            "key_status": [],
        }

        for i in range(len(self.clients)):
            breaker = self.circuit_breakers[i]
            limiter = self.key_rate_limiters[i]

            key_status = {
                "key_index": i,
                "is_current": i == self.current_key_index,
                "circuit_state": breaker["state"].value,
                "can_make_request": limiter.can_make_request(),
                "requests_last_minute": len(
                    [
                        req_time
                        for req_time in limiter.requests
                        if time.time() - req_time < 60
                    ]
                ),
                "rate_limit_utilization": len(
                    [
                        req_time
                        for req_time in limiter.requests
                        if time.time() - req_time < 60
                    ]
                )
                / limiter.max_requests,
            }
            status["key_status"].append(key_status)

        return status

    def force_key_rotation(self) -> int:
        """
        Force rotation to the next key for testing purposes.

        Returns:
            The new current key index
        """
        self.current_key_index = (self.current_key_index + 1) % len(self.clients)
        logger.info(f"Forced key rotation to index {self.current_key_index}")
        return self.current_key_index

    def reset_rate_limiters(self) -> None:
        """
        Reset all rate limiters for testing purposes.
        """
        for i, limiter in enumerate(self.key_rate_limiters):
            limiter.requests.clear()
            logger.info(f"Reset rate limiter for key {i}")

    def _make_api_call_with_retry(
        self,
        query: str,
        search_type: str = "release",
        artist: Optional[str] = None,
        title: Optional[str] = None,
        year: Optional[int] = None,
        max_retries: int = 1,
    ) -> Any:
        """
        Make API call with multi-key load balancing and circuit breaker protection.

        Args:
            query: Main search query (typically the title)
            search_type: Type of search (release, master, etc.)
            artist: Optional artist name to filter by
            title: Optional title to search for (if different from query)
            year: Optional year to filter by
            max_retries: Maximum number of retries across different keys

        Returns:
            Search results

        Raises:
            DiscogsError: If API call fails after retries
        """
        last_exception = None
        attempted_keys = set()

        # Store attempted keys for debugging
        self._last_attempted_keys = attempted_keys

        for attempt in range(max_retries + 1):
            # Get available client
            client, key_index = self._get_available_client()

            if client is None:
                # All clients are rate limited or circuit broken
                wait_times = [
                    limiter.get_wait_time() for limiter in self.key_rate_limiters
                ]
                min_wait = min(wait_times) if wait_times else 60

                # Only wait if this is not the first attempt (to avoid unnecessary delays)
                if attempt > 0:
                    logger.warning(
                        f"All API keys unavailable, waiting {min_wait:.2f} seconds"
                    )
                    time.sleep(min_wait)
                    client, key_index = self._get_available_client()
                else:
                    # First attempt and all keys unavailable - this shouldn't happen with proper rotation
                    logger.error(
                        "All API keys unavailable on first attempt - check key configuration"
                    )
                    raise DiscogsError(
                        DiscogsErrorType.RATE_LIMIT,
                        "All API keys are rate limited or circuit broken",
                    )

                if client is None:
                    raise DiscogsError(
                        DiscogsErrorType.RATE_LIMIT,
                        "All API keys are rate limited or circuit broken",
                    )

            # Skip if we've already tried this key
            if key_index in attempted_keys:
                logger.debug(f"Skipping key {key_index} - already tried")
                continue
            attempted_keys.add(key_index)

            logger.debug(
                f"Attempting request with key {key_index} (attempt {attempt + 1}/{max_retries + 1})"
            )

            try:
                # Build search parameters according to Discogs API client format
                # Format: client.search(query, type='release', artist='...', year=...)
                search_kwargs = {"type": search_type}
                if artist:
                    search_kwargs["artist"] = artist
                if year:
                    search_kwargs["year"] = year
                
                # Use title if provided, otherwise use query
                search_query_text = title if title else query
                
                # Make the API call
                logger.info(
                    f"Discogs API call attempt {attempt + 1} with key {key_index}: "
                    f"query='{search_query_text}', {search_kwargs}"
                )
                paginated_results = client.search(search_query_text, **search_kwargs)
                self.key_rate_limiters[key_index].record_request()
                self._update_circuit_breaker(key_index, True)

                # Discogs returns a paginated result object - get the first page
                if paginated_results:
                    try:
                        results = paginated_results.page(1)
                        logger.info(
                            f"Discogs API call successful with key {key_index}: {len(results) if results else 0} results"
                        )
                        return results
                    except Exception as e:
                        logger.warning(f"Error getting page 1 from paginated results: {e}")
                        # Try to iterate directly if page() doesn't work
                        try:
                            results = list(paginated_results)
                            logger.info(
                                f"Discogs API call successful with key {key_index}: {len(results) if results else 0} results (direct iteration)"
                            )
                            return results
                        except Exception as e2:
                            logger.error(f"Could not extract results from paginated object: {e2}")
                            return []
                else:
                    logger.info(f"Discogs API call returned no results with key {key_index}")
                    return []

            except Exception as e:
                last_exception = e
                self._update_circuit_breaker(key_index, False)
                error_str = str(e).lower()

                # Determine error type
                if (
                    "429" in str(e)
                    or "rate limit" in error_str
                    or "too many requests" in error_str
                ):
                    error_type = DiscogsErrorType.RATE_LIMIT
                    retry_after = 60  # Wait 1 minute for rate limit
                elif (
                    "401" in str(e)
                    or "authenticate" in error_str
                    or "unauthorized" in error_str
                ):
                    error_type = DiscogsErrorType.AUTHENTICATION_ERROR
                    retry_after = None
                elif "timeout" in error_str or "timed out" in error_str:
                    error_type = DiscogsErrorType.TIMEOUT
                    retry_after = 5
                elif (
                    "500" in str(e)
                    or "502" in str(e)
                    or "503" in str(e)
                    or "504" in str(e)
                ):
                    error_type = DiscogsErrorType.SERVER_ERROR
                    retry_after = 10
                elif "network" in error_str or "connection" in error_str:
                    error_type = DiscogsErrorType.NETWORK_ERROR
                    retry_after = 5
                else:
                    error_type = DiscogsErrorType.UNKNOWN
                    retry_after = 5

                logger.warning(
                    f"Discogs API error with key {key_index} (attempt {attempt + 1}/{max_retries + 1}): {error_type.value} - {e}"
                )

                # Don't retry authentication errors
                if error_type == DiscogsErrorType.AUTHENTICATION_ERROR:
                    raise DiscogsError(error_type, f"Authentication failed: {e}")

                # Don't retry if this was the last attempt or we've tried all keys
                if attempt == max_retries or len(attempted_keys) >= len(self.clients):
                    raise DiscogsError(
                        error_type,
                        f"API call failed after trying {len(attempted_keys)} keys: {e}",
                        retry_after,
                    )

                # For rate limit errors, try next key immediately instead of waiting
                if error_type == DiscogsErrorType.RATE_LIMIT:
                    logger.info(
                        f"Rate limit hit on key {key_index}, trying next available key..."
                    )
                    # Mark this key as rate limited by adding fake requests to force it to wait
                    for _ in range(self.key_rate_limiters[key_index].max_requests):
                        self.key_rate_limiters[key_index].record_request()
                    continue  # Skip to next iteration to try another key

                # For other errors, wait before retry
                if retry_after:
                    logger.info(f"Retrying in {retry_after} seconds...")
                    time.sleep(retry_after)

        # This should never be reached, but just in case
        raise DiscogsError(
            DiscogsErrorType.UNKNOWN, f"Unexpected error: {last_exception}"
        )

    @monitor_performance("discogs_genre_lookup")
    def get_genre_from_filepath(self, filepath: str) -> Dict[str, List[str]]:
        """
        Extract genre and subgenre information from a filepath using Discogs API.

        Args:
            filepath: Path to the audio file

        Returns:
            Dictionary containing 'genres' and 'subgenres' lists
        """
        try:
            # Extract filename from path
            filename = os.path.basename(filepath)
            logger.info(f"Looking up genre for file: {filename}")

            # Parse filename to get artist and title
            metadata = self.filename_parser.parse_filename_for_metadata(filename)
            artist = metadata.get("artist", "").strip()
            title = metadata.get("title", "").strip()

            if not artist or not title:
                logger.warning(
                    f"Insufficient metadata extracted: artist='{artist}', title='{title}'"
                )
                return {"genres": [], "subgenres": []}

            # Create cache key for this artist-title combination
            cache_key = f"{artist.lower()}|{title.lower()}"

            # Try to get from cache first
            if self.enable_cache and self.cache:
                cached_result = self.cache.get("discogs", cache_key)
                if cached_result is not None:
                    logger.info(f"Cache hit for Discogs lookup: {artist} - {title}")
                    return cached_result

            logger.info(f"Searching Discogs for: Artist='{artist}', Title='{title}'")

            # Search for releases matching artist and title
            # Use title as main query, artist as filter parameter
            search_query = f"{artist} {title}"
            try:
                results = self._make_api_call_with_retry(
                    query=title, search_type="release", artist=artist
                )
            except DiscogsError as e:
                logger.error(
                    f"Discogs API failed for '{search_query}': {e.error_type.value} - {e}"
                )

                # Cache the failure to avoid repeated attempts
                failure_result = {
                    "genres": [],
                    "subgenres": [],
                    "error": e.error_type.value,
                }
                if self.enable_cache and self.cache:
                    # Cache failures for shorter time to allow retry later
                    cache_ttl = (
                        300 if e.error_type == DiscogsErrorType.RATE_LIMIT else 1800
                    )  # 5 min for rate limit, 30 min for others
                    self.cache.set("discogs", cache_key, failure_result, ttl=cache_ttl)

                return {"genres": [], "subgenres": []}

            if not results or len(results) == 0:
                logger.warning(f"No results found for: {search_query}")
                # Cache empty result to avoid repeated API calls
                empty_result = {"genres": [], "subgenres": []}
                if self.enable_cache and self.cache:
                    self.cache.set(
                        "discogs", cache_key, empty_result, ttl=1800
                    )  # 30 min for empty results
                return empty_result

            # Get the first result
            release = results[0]
            logger.info(
                f"Found release: {release.title} by {release.artists[0].name if release.artists else 'Unknown'}"
            )

            # Extract genres and styles (subgenres)
            genres = getattr(release, "genres", []) or []
            styles = getattr(release, "styles", []) or []

            # Convert to lists and clean up
            genre_list = [str(g).strip() for g in genres if g]
            subgenre_list = [str(s).strip() for s in styles if s]

            result = {"genres": genre_list, "subgenres": subgenre_list}

            # Cache the result
            if self.enable_cache and self.cache:
                self.cache.set("discogs", cache_key, result)

            logger.info(f"Found genres: {genre_list}, subgenres: {subgenre_list}")

            return result

        except Exception as e:
            logger.error(f"Failed to get genre from filepath {filepath}: {e}")
            return {"genres": [], "subgenres": []}

    def search_artist_genres(self, artist_name: str) -> Dict[str, List[str]]:
        """
        Search for an artist's typical genres on Discogs.

        Args:
            artist_name: Name of the artist to search for

        Returns:
            Dictionary containing 'genres' and 'subgenres' lists
        """
        try:
            # Create cache key for this artist
            cache_key = f"artist:{artist_name.lower().strip()}"

            # Try to get from cache first
            if self.enable_cache and self.cache:
                cached_result = self.cache.get("artist", cache_key)
                if cached_result is not None:
                    logger.info(f"Cache hit for artist lookup: {artist_name}")
                    return cached_result

            logger.info(f"Searching Discogs for artist: {artist_name}")

            # Search for artist
            try:
                results = self._make_api_call_with_retry(
                    query=artist_name, search_type="artist"
                )
            except DiscogsError as e:
                logger.error(
                    f"Discogs API failed for artist '{artist_name}': {e.error_type.value} - {e}"
                )

                # Cache the failure to avoid repeated attempts
                failure_result = {
                    "genres": [],
                    "subgenres": [],
                    "error": e.error_type.value,
                }
                if self.enable_cache and self.cache:
                    # Cache failures for shorter time to allow retry later
                    cache_ttl = (
                        300 if e.error_type == DiscogsErrorType.RATE_LIMIT else 1800
                    )  # 5 min for rate limit, 30 min for others
                    self.cache.set("artist", cache_key, failure_result, ttl=cache_ttl)

                return {"genres": [], "subgenres": []}

            if not results or len(results) == 0:
                logger.warning(f"No artist found for: {artist_name}")
                # Cache empty result to avoid repeated API calls
                empty_result = {"genres": [], "subgenres": []}
                if self.enable_cache and self.cache:
                    self.cache.set(
                        "artist", cache_key, empty_result, ttl=1800
                    )  # 30 min for empty results
                return empty_result

            # Get the first artist result
            artist = results[0]
            logger.info(f"Found artist: {artist.name}")

            # Get artist's releases to determine common genres
            releases = artist.releases
            all_genres = set()
            all_styles = set()

            # Sample first few releases to get genre patterns
            for i, release in enumerate(releases):
                if i >= 5:  # Limit to first 5 releases for performance
                    break

                try:
                    genres = getattr(release, "genres", []) or []
                    styles = getattr(release, "styles", []) or []

                    all_genres.update(str(g).strip() for g in genres if g)
                    all_styles.update(str(s).strip() for s in styles if s)

                except Exception as e:
                    logger.debug(f"Error processing release {i}: {e}")
                    continue

            genre_list = list(all_genres)
            subgenre_list = list(all_styles)

            result = {"genres": genre_list, "subgenres": subgenre_list}

            # Cache the result
            if self.enable_cache and self.cache:
                self.cache.set("artist", cache_key, result)

            logger.info(
                f"Artist {artist_name} genres: {genre_list}, subgenres: {subgenre_list}"
            )

            return result

        except Exception as e:
            logger.error(f"Failed to search artist genres for {artist_name}: {e}")
            return {"genres": [], "subgenres": []}

    def clear_cache(self, cache_type: Optional[str] = None) -> int:
        """
        Clear cache entries.

        Args:
            cache_type: Type of cache to clear ('discogs', 'artist', or None for all)

        Returns:
            Number of keys deleted
        """
        if not self.enable_cache or not self.cache:
            logger.warning("Cache is not enabled")
            return 0

        try:
            if cache_type:
                pattern = f"discogs:{cache_type}:*"
                deleted = self.cache.clear_pattern(pattern)
                logger.info(f"Cleared {deleted} {cache_type} cache entries")
                return deleted
            else:
                # Clear all discogs cache entries
                pattern = "discogs:*"
                deleted = self.cache.clear_pattern(pattern)
                logger.info(f"Cleared {deleted} total cache entries")
                return deleted
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        if not self.enable_cache or not self.cache:
            return {"enabled": False, "message": "Cache is not enabled"}

        try:
            stats = self.cache.get_stats()
            stats["enabled"] = True
            stats["cache_type"] = "discogs"
            return stats
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"enabled": True, "error": str(e)}

    def invalidate_artist_cache(self, artist_name: str) -> bool:
        """
        Invalidate cache for a specific artist.

        Args:
            artist_name: Name of the artist to invalidate

        Returns:
            True if successful, False otherwise
        """
        if not self.enable_cache or not self.cache:
            return False

        try:
            cache_key = f"artist:{artist_name.lower().strip()}"
            result = self.cache.delete("artist", cache_key)
            if result:
                logger.info(f"Invalidated cache for artist: {artist_name}")
            return result
        except Exception as e:
            logger.error(f"Failed to invalidate artist cache for {artist_name}: {e}")
            return False

    def invalidate_track_cache(self, artist: str, title: str) -> bool:
        """
        Invalidate cache for a specific track.

        Args:
            artist: Artist name
            title: Track title

        Returns:
            True if successful, False otherwise
        """
        if not self.enable_cache or not self.cache:
            return False

        try:
            cache_key = f"{artist.lower()}|{title.lower()}"
            result = self.cache.delete("discogs", cache_key)
            if result:
                logger.info(f"Invalidated cache for track: {artist} - {title}")
            return result
        except Exception as e:
            logger.error(
                f"Failed to invalidate track cache for {artist} - {title}: {e}"
            )
            return False

    def get_rate_limit_stats(self) -> Dict[str, Any]:
        """
        Get rate limiting statistics for all API keys.

        Returns:
            Dictionary with rate limiting statistics
        """
        now = time.time()
        total_requests = 0
        total_max_requests = 0
        key_stats = []

        for i, limiter in enumerate(self.key_rate_limiters):
            recent_requests = [
                req_time for req_time in limiter.requests if now - req_time < 60
            ]
            total_requests += len(recent_requests)
            total_max_requests += limiter.max_requests

            breaker = self.circuit_breakers[i]
            key_stats.append(
                {
                    "key_index": i,
                    "requests_last_minute": len(recent_requests),
                    "max_requests_per_minute": limiter.max_requests,
                    "can_make_request": limiter.can_make_request(),
                    "wait_time_if_limited": limiter.get_wait_time(),
                    "rate_limit_utilization": len(recent_requests)
                    / limiter.max_requests,
                    "circuit_breaker_state": breaker["state"].value,
                    "failure_count": breaker["failure_count"],
                    "success_count": breaker["success_count"],
                    "total_requests": breaker["total_requests"],
                }
            )

        return {
            "total_requests_last_minute": total_requests,
            "total_max_requests_per_minute": total_max_requests,
            "overall_rate_limit_utilization": total_requests
            / max(total_max_requests, 1),
            "available_keys": len(
                [
                    s
                    for s in key_stats
                    if s["can_make_request"] and s["circuit_breaker_state"] == "closed"
                ]
            ),
            "total_keys": len(self.clients),
            "key_details": key_stats,
        }

    def is_discogs_blocked(self) -> bool:
        """
        Check if Discogs service should be skipped due to recent failures.

        Returns:
            True if Discogs should be skipped, False otherwise
        """
        if not self.enable_cache or not self.cache:
            return False

        try:
            # Check for recent rate limit errors in cache
            rate_limit_keys = self.cache.redis_client.keys(
                f"{self.cache.key_prefix}:*:rate_limit"
            )
            if rate_limit_keys:
                logger.warning(
                    f"Found {len(rate_limit_keys)} recent rate limit errors, skipping Discogs"
                )
                return True

            # Check if all keys are rate limited or circuit broken
            available_keys = 0
            for i in range(len(self.clients)):
                if (
                    not self._is_circuit_open(i)
                    and self.key_rate_limiters[i].can_make_request()
                ):
                    available_keys += 1

            if available_keys == 0:
                logger.warning(
                    "All API keys are rate limited or circuit broken, skipping Discogs"
                )
                return True

            return False

        except Exception as e:
            logger.warning(f"Error checking if Discogs is blocked: {e}")
            return False

    def get_service_status(self) -> Dict[str, Any]:
        """
        Get comprehensive service status including rate limiting and error information.

        Returns:
            Dictionary with service status information
        """
        rate_stats = self.get_rate_limit_stats()
        cache_stats = (
            self.get_cache_stats() if self.enable_cache else {"enabled": False}
        )

        return {
            "service_available": not self.is_discogs_blocked(),
            "total_api_keys": len(self.clients),
            "available_api_keys": rate_stats["available_keys"],
            "circuit_breaker_enabled": self.circuit_breaker_enabled,
            "rate_limiting": rate_stats,
            "caching": cache_stats,
            "authentication_configured": len(self.api_keys) > 0,
        }

    def normalize_query_text(self, text: str) -> str:
        """
        Normalize text for Discogs search queries.

        Cleans and formats text to be suitable for Discogs API search:
        - Removes special characters that might interfere with search
        - Handles quotes properly
        - Normalizes whitespace

        Args:
            text: Text to normalize

        Returns:
            Normalized text suitable for Discogs search
        """
        if not text:
            return ""

        # Remove leading/trailing whitespace
        normalized = text.strip()

        # Replace multiple spaces with single space
        normalized = " ".join(normalized.split())

        # Escape quotes for Discogs query syntax
        # Discogs uses quotes for exact phrases, so we need to handle them carefully
        normalized = normalized.replace('"', '\\"')

        return normalized

    @monitor_performance("discogs_search_release")
    def search_release(
        self, artist: str, title: str, year: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for releases matching artist and title on Discogs.

        Args:
            artist: Artist name
            title: Release/track title
            year: Optional year to narrow search

        Returns:
            List of release dictionaries with structured data
        """
        try:
            # Normalize inputs (but don't escape quotes - Discogs client handles this)
            artist_normalized = artist.strip() if artist else ""
            title_normalized = title.strip() if title else ""

            if not artist_normalized or not title_normalized:
                logger.warning(
                    f"Insufficient search parameters: artist='{artist_normalized}', title='{title_normalized}'"
                )
                return []

            logger.info(
                f"Searching Discogs for: artist='{artist_normalized}', title='{title_normalized}'"
                + (f", year={year}" if year else "")
            )

            # Make API call using proper Discogs client format
            # Format: client.search(title, type='release', artist='artist', year=year)
            try:
                results = self._make_api_call_with_retry(
                    query=title_normalized,
                    search_type="release",
                    artist=artist_normalized,
                    year=year,
                )
            except DiscogsError as e:
                logger.error(
                    f"Discogs API failed for artist='{artist_normalized}', title='{title_normalized}': "
                    f"{e.error_type.value} - {e}"
                )
                return []

            if not results:
                logger.info(
                    f"No results found for: artist='{artist_normalized}', title='{title_normalized}'"
                )
                return []
            # Discogs search returns a list of Release objects after calling .page(1)
            # Each Release object has attributes like .id, .title, .artists, .formats, etc.
            # According to docs: https://python3-discogs-client.readthedocs.io/en/latest/fetching_data.html
            # - formats is a list of dicts: [{'name': 'Vinyl', 'qty': '1', 'text': '...', 'descriptions': [...]}]
            # - artists is a list of Artist objects with .name attribute
            # - labels is a list of Label objects with .name attribute
            structured_results = []
            for release in results:
                try:
                    # Check if release is a dict or a Release object
                    if isinstance(release, dict):
                        # Handle dictionary format
                        artists = []
                        if "artists" in release:
                            for artist in release["artists"]:
                                if isinstance(artist, dict):
                                    artists.append(artist.get("name", ""))
                                else:
                                    artists.append(getattr(artist, "name", str(artist)))
                        
                        labels = []
                        if "label" in release:
                            labels.append(release["label"])
                        elif "labels" in release:
                            for label in release["labels"]:
                                if isinstance(label, dict):
                                    labels.append(label.get("name", ""))
                                else:
                                    labels.append(getattr(label, "name", str(label)))
                        
                        formats = []
                        if "format" in release:
                            format_val = release["format"]
                            if isinstance(format_val, str):
                                formats.append(format_val)
                            elif isinstance(format_val, list):
                                formats.extend([str(f) for f in format_val])
                            else:
                                formats.append(str(format_val))
                        elif "formats" in release:
                            for fmt in release["formats"]:
                                if isinstance(fmt, dict):
                                    # Try different possible keys for format name
                                    format_name = (
                                        fmt.get("name") or 
                                        fmt.get("format") or 
                                        fmt.get("qty") or 
                                        str(fmt)
                                    )
                                    formats.append(format_name)
                                elif isinstance(fmt, str):
                                    formats.append(fmt)
                                else:
                                    # Try to get format as attribute, fallback to string
                                    format_name = getattr(fmt, "format", None) or getattr(fmt, "name", None) or str(fmt)
                                    formats.append(format_name)
                        
                        release_dict = {
                            "id": release.get("id"),
                            "title": release.get("title", ""),
                            "artists": artists,
                            "year": release.get("year"),
                            "country": release.get("country"),
                            "label": labels[0] if labels else None,
                            "format": ", ".join(formats) if formats else None,
                            "genres": release.get("genre", []) or release.get("genres", []),
                            "styles": release.get("style", []) or release.get("styles", []),
                            "thumb": release.get("thumb") or release.get("cover_image"),
                        }
                    else:
                        # Handle Release object format (Discogs client returns Release objects)
                        # According to docs: formats is a list of dicts with 'name', 'qty', 'text', 'descriptions'
                        artists = []
                        if hasattr(release, "artists") and release.artists:
                            for artist in release.artists:
                                if hasattr(artist, "name"):
                                    artists.append(artist.name)
                                else:
                                    artists.append(str(artist))
                        
                        labels = []
                        if hasattr(release, "labels") and release.labels:
                            for label in release.labels:
                                if hasattr(label, "name"):
                                    labels.append(label.name)
                                else:
                                    labels.append(str(label))
                        
                        formats = []
                        if hasattr(release, "formats") and release.formats:
                            # Formats is a list of dicts: [{'name': 'Vinyl', 'qty': '1', 'text': '...', 'descriptions': [...]}]
                            for fmt in release.formats:
                                if isinstance(fmt, dict):
                                    # Extract format name from dict
                                    format_name = fmt.get("name", "")
                                    if format_name:
                                        formats.append(format_name)
                                else:
                                    # Fallback if format is not a dict
                                    format_name = getattr(fmt, "name", None) or str(fmt)
                                    formats.append(format_name)
                        
                        release_dict = {
                            "id": getattr(release, "id", None),
                            "title": getattr(release, "title", ""),
                            "artists": artists,
                            "year": getattr(release, "year", None),
                            "country": getattr(release, "country", None),
                            "label": labels[0] if labels else None,
                            "format": ", ".join(formats) if formats else None,
                            "genres": (
                                [str(g) for g in release.genres]
                                if hasattr(release, "genres") and release.genres
                                else []
                            ),
                            "styles": (
                                [str(s) for s in release.styles]
                                if hasattr(release, "styles") and release.styles
                                else []
                            ),
                            "thumb": getattr(release, "thumb", None),
                        }
                    structured_results.append(release_dict)
                except Exception as e:
                    logger.warning(f"Error processing release result: {e}", exc_info=True)
                    continue

            logger.info(
                f"Found {len(structured_results)} structured release results for: "
                f"artist='{artist_normalized}', title='{title_normalized}'"
            )
            return structured_results

        except Exception as e:
            logger.error(f"Failed to search Discogs releases: {e}")
            return []

    @monitor_performance("discogs_get_release_details")
    def get_release_details(self, release_id: int) -> Optional[Dict[str, Any]]:
        """
        Get full release details from Discogs by release ID.

        Args:
            release_id: Discogs release ID

        Returns:
            Dictionary with full release details or None if failed
        """
        try:
            logger.info(f"Fetching Discogs release details for ID: {release_id}")

            # Get available client
            client, key_index = self._get_available_client()
            if client is None:
                logger.error("No available Discogs client for release details")
                return None

            # Make API call to get release
            try:
                release = client.release(release_id)
                self.key_rate_limiters[key_index].record_request()
                self._update_circuit_breaker(key_index, True)
            except Exception as e:
                self._update_circuit_breaker(key_index, False)
                logger.error(f"Failed to fetch release {release_id}: {e}")
                return None

            # Extract comprehensive release data
            release_data = {
                "id": release.id,
                "title": release.title,
                "artists": [
                    {
                        "name": artist.name,
                        "id": artist.id if hasattr(artist, "id") else None,
                    }
                    for artist in (release.artists or [])
                ],
                "year": release.year if hasattr(release, "year") else None,
                "country": release.country if hasattr(release, "country") else None,
                "labels": [
                    {
                        "name": label.name,
                        "catno": label.data.get("catno") if hasattr(label, "data") else None,
                    }
                    for label in (release.labels or [])
                ],
                "formats": [
                    {
                        "name": fmt.get("name", ""),
                        "qty": fmt.get("qty", ""),
                        "descriptions": fmt.get("descriptions", []),
                    }
                    for fmt in (release.formats or [])
                ],
                "genres": (
                    [str(g) for g in release.genres]
                    if hasattr(release, "genres") and release.genres
                    else []
                ),
                "styles": (
                    [str(s) for s in release.styles]
                    if hasattr(release, "styles") and release.styles
                    else []
                ),
                "tracklist": [
                    {
                        "position": track.position if hasattr(track, "position") else "",
                        "title": track.title if hasattr(track, "title") else "",
                        "duration": track.duration if hasattr(track, "duration") else "",
                    }
                    for track in (release.tracklist or [])
                ],
                "credits": (
                    [
                        {
                            "name": credit.name if hasattr(credit, "name") else "",
                            "role": credit.role if hasattr(credit, "role") else "",
                        }
                        for credit in release.extraartists
                    ]
                    if hasattr(release, "extraartists") and release.extraartists
                    else []
                ),
                "images": [
                    {
                        "uri": img.get("uri", "") if isinstance(img, dict) else "",
                        "uri150": img.get("uri150", "") if isinstance(img, dict) else "",
                        "type": img.get("type", "") if isinstance(img, dict) else "",
                    }
                    for img in (release.images or [])
                ],
                "thumb": release.thumb if hasattr(release, "thumb") else None,
                "uri": release.uri if hasattr(release, "uri") else None,
            }

            logger.info(f"Successfully fetched release details for ID: {release_id}")
            return release_data

        except Exception as e:
            logger.error(f"Failed to get release details for {release_id}: {e}")
            return None
