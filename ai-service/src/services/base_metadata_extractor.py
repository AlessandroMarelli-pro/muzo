"""
Base metadata extraction service with shared functionality.

This module provides a base class for AI-powered metadata extraction services,
with common functionality shared between different providers (OpenAI, Gemini, etc.).
"""

import os
import random
import re
import time
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from threading import Lock
from typing import Any, Dict, List, Optional

from loguru import logger

from src.config.metadata_config import MetadataConfig
from src.services.artist_title_extractor import ArtistTitleExtractor
from src.services.discogs_enrichment_service import DiscogsEnrichmentService
from src.services.metadata_cache import MetadataCache
from src.services.simple_metadata_extractor import SimpleMetadataExtractor
from src.services.third_parties.discogs import DiscogsConnector
from src.utils.performance_optimizer import monitor_performance


class MetadataExtractionMetrics:
    """Track metrics for metadata extraction operations."""

    def __init__(self):
        """Initialize metrics tracking."""
        self.stage_counts: Dict[str, int] = defaultdict(int)
        self.stage_times: Dict[str, List[float]] = defaultdict(list)
        self.cache_hits = 0
        self.cache_misses = 0
        self.discogs_success = 0
        self.discogs_failures = 0
        self.llm_calls = 0
        self.discogs_calls = 0
        self.fallback_triggers: Dict[str, int] = defaultdict(int)
        self.lock = Lock()

    def record_stage(self, stage: str, duration: float, success: bool = True):
        """Record a stage execution."""
        with self.lock:
            self.stage_counts[stage] += 1
            self.stage_times[stage].append(duration)
            # Keep only last 100 measurements
            if len(self.stage_times[stage]) > 100:
                self.stage_times[stage] = self.stage_times[stage][-100:]

    def record_cache_hit(self):
        """Record a cache hit."""
        with self.lock:
            self.cache_hits += 1

    def record_cache_miss(self):
        """Record a cache miss."""
        with self.lock:
            self.cache_misses += 1

    def record_discogs_call(self, success: bool):
        """Record a Discogs API call."""
        with self.lock:
            self.discogs_calls += 1
            if success:
                self.discogs_success += 1
            else:
                self.discogs_failures += 1

    def record_llm_call(self):
        """Record an LLM API call."""
        with self.lock:
            self.llm_calls += 1

    def record_fallback(self, from_stage: str, to_stage: str):
        """Record a fallback between stages."""
        with self.lock:
            self.fallback_triggers[f"{from_stage}->{to_stage}"] += 1

    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary."""
        with self.lock:
            cache_total = self.cache_hits + self.cache_misses
            cache_hit_rate = (
                (self.cache_hits / cache_total * 100) if cache_total > 0 else 0
            )

            stage_stats = {}
            for stage, times in self.stage_times.items():
                if times:
                    stage_stats[stage] = {
                        "count": len(times),
                        "avg_time": sum(times) / len(times),
                        "min_time": min(times),
                        "max_time": max(times),
                    }

            return {
                "stage_counts": dict(self.stage_counts),
                "stage_statistics": stage_stats,
                "cache": {
                    "hits": self.cache_hits,
                    "misses": self.cache_misses,
                    "hit_rate_percent": round(cache_hit_rate, 2),
                },
                "discogs": {
                    "total_calls": self.discogs_calls,
                    "success": self.discogs_success,
                    "failures": self.discogs_failures,
                    "success_rate_percent": round(
                        (self.discogs_success / self.discogs_calls * 100)
                        if self.discogs_calls > 0
                        else 0,
                        2,
                    ),
                },
                "llm_calls": self.llm_calls,
                "fallback_triggers": dict(self.fallback_triggers),
            }

    def reset(self):
        """Reset all metrics."""
        with self.lock:
            self.stage_counts.clear()
            self.stage_times.clear()
            self.cache_hits = 0
            self.cache_misses = 0
            self.discogs_success = 0
            self.discogs_failures = 0
            self.llm_calls = 0
            self.discogs_calls = 0
            self.fallback_triggers.clear()


# Global metrics instance
_metrics = MetadataExtractionMetrics()


def get_metadata_metrics() -> MetadataExtractionMetrics:
    """Get the global metadata extraction metrics instance."""
    return _metrics


def create_metadata_extractor(provider: str = "OPENAI", api_key: Optional[str] = None):
    """
    Factory function to create a metadata extractor based on provider name.

    Args:
        provider: Provider name - "GEMINI" or "OPENAI" (case-insensitive)
        api_key: Optional API key. If not provided, will use environment variables.

    Returns:
        Instance of the appropriate metadata extractor class

    Raises:
        ValueError: If provider name is not recognized
    """
    provider_upper = provider.upper()

    if provider_upper == "GEMINI":
        from src.services.gemini_metadata_extractor import GeminiMetadataExtractor

        return GeminiMetadataExtractor(api_key=api_key)
    elif provider_upper == "OPENAI" or provider_upper == "OPEN_AI":
        from src.services.openai_metadata_extractor import OpenAIMetadataExtractor

        return OpenAIMetadataExtractor(api_key=api_key)
    else:
        raise ValueError(
            f"Unknown provider: {provider}. Supported providers: 'GEMINI', 'OPENAI'"
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
    Base class for AI-powered metadata extraction services.

    This class provides common functionality shared between different AI providers,
    while allowing subclasses to implement provider-specific API calls and response handling.
    """

    # Common instructions for all providers
    INSTRUCTIONS = [
        "You are a music metadata expert and resolution agent.",
        "Your task is NOT limited to parsing the filename.",
        "You MUST resolve and enrich metadata well-known public music databases (e.g. Youtube, Discogs, Amazon, MusicBrainz, Spotify, Bandcamp, Apple Music, LastFM, Beatport, Tunebat, etc.).",
        "and using your general music knowledge",
        "REQUIRED OUTPUT SCHEMA - You MUST return ONLY the fields provided in the schema.",
        "RULES:",
        "- If ID3 tags are provided, use them as the PRIMARY source for artist, title, year, and genre.",
        "- CRITICAL: If SOURCE LINKS are provided in the prompt (extracted from ID3 description), you MUST:",
        "  1. Visit each link and extract metadata from the linked pages",
        "  2. Use information from these links as the HIGHEST PRIORITY source",
        "  3. Override any conflicting information from other sources with data from these links",
        "  4. These links point directly to authoritative music databases (Discogs, Spotify, Bandcamp, etc.)",
        "- The description field may contain direct links to music databases - these are the most reliable sources and should be prioritized above all other sources.",
        "- Use the filename as a secondary identifier (artist, title, mix) if ID3 tags are not available.",
        "- Populate all other fields using reliable, commonly accepted music metadata.",
        "- If multiple sources disagree, choose the most widely accepted value.",
        "- If no reliable public metadata exists, use null (or [] for arrays).",
        "- Do NOT invent obscure credits or speculative data.",
        "- Prefer canonical release metadata (original year, primary format).",
        "- Return ONLY valid JSON matching the exact schema.",
        "- No explanations, no comments, no markdown, no extra fields.",
        "",
        "TECHNICAL AUDIO FEATURES (audioFeatures):",
        "- BPM: Research the exact BPM from databases like Beatport, Tunebat, or Spotify. If not found, you may estimate based on genre conventions (e.g., House: 120-130 BPM, Techno: 130-140 BPM).",
        "- Key: Research the musical key from databases. Use standard notation (e.g., 'C Minor', '8A' for Camelot wheel). If not found, return null.",
        "- Vocals: Describe the vocals if present (e.g., 'Turkish female vocals', 'Instrumental', 'Chopped samples', 'English male vocals'). If no vocals, use 'Instrumental'.",
        "- Atmosphere: Provide vibe keywords that describe the track's mood and texture (e.g., 'Hypnotic', 'Sparkly', 'Industrial', 'Ethereal', 'Dark').",
        "",
        "CULTURAL CONTEXT (context):",
        "- Background: Research and provide historical or production context (e.g., 'Produced during lockdown', 'Debut EP on Public Possession', 'Remix of classic 1980s track').",
        "- Impact: Describe cultural impact, chart success, or notable achievements (e.g., 'Established her residency at Panorama Bar', 'Reached #1 on Beatport Techno chart').",
        "- For tracks with non-English vocals, identify the language and cultural background when relevant.",
        "",
        "CONFIDENCE POLICY:",
        "- High confidence: widely documented releases → fill all known fields including audioFeatures and context.",
        "- Medium confidence: known artist/track but limited documentation → fill genre/style/audioFeatures, leave context null if unsure.",
        "- Low confidence: obscure or ambiguous tracks → only fill artist/title/mix, others null.",
        "",
        "DESCRIPTION REQUIREMENT:",
        "- If genre, style, or tags are populated, you MUST provide a description.",
        "- The description should be a 2-3 sentence summary of the track's sound and meaning.",
        "- Description should be written in a natural, informative style.",
        "- If genre, style, and tags are all empty/null, description can be null.",
    ]

    TEMPERATURE = 0.1  # Strict temperature: 0-0.2 range for deterministic output

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_requests_per_minute: int = 60,
        max_requests_per_day: Optional[int] = None,
        max_retries: int = 3,
        initial_backoff: float = 1.0,
    ):
        """
        Initialize the base metadata extractor.

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

        # Initialize ID3 tag extractor for more accurate metadata
        self.id3_extractor = SimpleMetadataExtractor()

        # Initialize configuration
        self.config = MetadataConfig()

        # Provider-specific client initialization (needed for DiscogsEnrichmentService)
        self.client = self._initialize_client()

        # Initialize ArtistTitleExtractor (pass self as LLM extractor)
        self.artist_title_extractor = ArtistTitleExtractor(llm_extractor=self)

        # Initialize Discogs and cache services if enabled
        self.discogs_enrichment = None
        self.metadata_cache = None

        if self.config.use_discogs:
            try:
                discogs_connector = DiscogsConnector(enable_cache=True)
                # Use client if available (for DiscogsEnrichmentService)
                gemini_client = self.client if self.client else None

                self.discogs_enrichment = DiscogsEnrichmentService(
                    discogs_connector=discogs_connector,
                    gemini_client=gemini_client,
                    config=self.config,
                )
                logger.info("DiscogsEnrichmentService initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize DiscogsEnrichmentService: {e}")
                self.discogs_enrichment = None

        # Initialize metadata cache
        try:
            self.metadata_cache = MetadataCache(
                default_ttl_hours=self.config.redis_cache_ttl_hours
            )
            if self.metadata_cache.is_available():
                logger.info("MetadataCache initialized")
            else:
                logger.warning("MetadataCache not available (Redis unavailable)")
                self.metadata_cache = None
        except Exception as e:
            logger.warning(f"Failed to initialize MetadataCache: {e}")
            self.metadata_cache = None

        # Initialize metrics tracking
        self.metrics = get_metadata_metrics()

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
    def _make_api_call(self, user_content: str):
        """
        Make a single API call to the provider.

        Args:
            user_content: User message content

        Returns:
            API response object

        Raises:
            Exception: If API call fails
        """
        pass

    @abstractmethod
    def _parse_response(self, response) -> Dict[str, Any]:
        """
        Parse the API response and extract metadata.

        Args:
            response: API response object

        Returns:
            Parsed metadata dictionary

        Raises:
            Exception: If parsing fails
        """
        pass

    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get comprehensive metrics summary for metadata extraction.

        Returns:
            Dictionary with metrics including stage statistics, cache performance,
            API call counts, and fallback triggers
        """
        return self.metrics.get_summary()

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

    def _make_api_call_with_retry(self, user_content: str):
        """
        Make API call with retry logic and rate limiting.

        Args:
            user_content: User message content

        Returns:
            API response object
        """
        last_exception = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                # Check rate limits before making request
                if not self.rate_limiter.can_make_request():
                    wait_time = self.rate_limiter.get_wait_time()
                    if wait_time > 0:
                        logger.warning(
                            f"Rate limit reached. Waiting {wait_time:.2f} seconds before request..."
                        )
                        time.sleep(wait_time)

                # Record request attempt
                self.rate_limiter.record_request()

                # Make API call (provider-specific)
                response = self._make_api_call(user_content)

                # Success - return response
                return response

            except Exception as e:
                last_exception = e
                error_message = str(e).lower()

                # Determine if error is retryable
                is_retryable = self._is_retryable_error(error_message)

                if is_retryable and attempt < self.MAX_RETRIES:
                    backoff_time = self.INITIAL_BACKOFF * (2**attempt)
                    logger.warning(
                        f"API error (attempt {attempt + 1}/{self.MAX_RETRIES + 1}): {e}. "
                        f"Retrying after {backoff_time:.2f} seconds..."
                    )
                    time.sleep(backoff_time)
                    continue
                else:
                    logger.error(f"API error: {e}")
                    raise

        # Should never reach here, but just in case
        if last_exception:
            raise last_exception
        raise Exception("Failed to make API call after retries")

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

    @monitor_performance("metadata_extraction")
    def extract_metadata_from_filename(
        self, filename: str, file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from a filename using multi-stage workflow:
        1. Extract & normalize artist/title
        2. Check cache
        3. Try Discogs enrichment (if enabled)
        4. Fallback to LLM-only (if enabled)
        5. Simple extraction (last resort)
        
        If file_path is provided, ID3 tags will be extracted and used for more accurate results.

        Args:
            filename: Audio filename (with or without extension)
            file_path: Optional path to the audio file for ID3 tag extraction

        Returns:
            Dictionary containing extracted metadata matching the expected schema
        """
        try:
            provider_name = self.__class__.__name__
            logger.info(
                f"Extracting metadata from filename using {provider_name}: {filename}"
            )

            # Extract basename (filename without path) and remove extension
            basename = os.path.basename(filename)
            filename_without_ext = os.path.splitext(basename)[0]

            # Extract ID3 tags if file_path is provided
            id3_tags = None
            if file_path:
                try:
                    id3_result = self.id3_extractor.extract_id3_tags(
                        file_path, filename_without_ext
                    )
                    id3_tags = id3_result.get("id3_tags", {})
                    if id3_tags:
                        logger.info(
                            f"Extracted ID3 tags: {id3_tags.get('title', 'N/A')} - {id3_tags.get('artist', 'N/A')}"
                        )
                except Exception as e:
                    logger.warning(
                        f"Failed to extract ID3 tags from {file_path}: {e}. Continuing with filename only."
                    )

            # ===== STAGE 1: Extract & Normalize Artist/Title =====
            stage1_start = time.time()
            logger.info(
                "Stage 1: Extracting and normalizing artist/title",
                extra={
                    "stage": "stage1_extract_normalize",
                    "filename": filename,
                    "has_id3": id3_tags is not None,
                },
            )
            artist_title_data = self.artist_title_extractor.extract_and_normalize(
                filename, file_path, id3_tags
            )
            artist = artist_title_data.get("artist", "")
            title = artist_title_data.get("title", "")
            mix = artist_title_data.get("mix")
            stage1_duration = time.time() - stage1_start
            self.metrics.record_stage("stage1_extract_normalize", stage1_duration)
            logger.info(
                f"Stage 1 complete: {artist} - {title}"
                + (f" ({mix})" if mix else "")
                + f" [source: {artist_title_data.get('source', 'unknown')}]",
                extra={
                    "stage": "stage1_extract_normalize",
                    "duration_seconds": round(stage1_duration, 3),
                    "artist": artist,
                    "title": title,
                    "mix": mix,
                    "source": artist_title_data.get("source", "unknown"),
                },
            )

            # ===== Check Cache =====
            if self.metadata_cache:
                cached_metadata = self.metadata_cache.get(artist, title, mix)
                if cached_metadata:
                    self.metrics.record_cache_hit()
                    logger.info(
                        "Cache hit: Returning cached metadata",
                        extra={
                            "stage": "cache",
                            "cache_result": "hit",
                            "artist": artist,
                            "title": title,
                        },
                    )
                    return cached_metadata
                self.metrics.record_cache_miss()
                logger.info(
                    "Cache miss: Proceeding with enrichment",
                    extra={
                        "stage": "cache",
                        "cache_result": "miss",
                        "artist": artist,
                        "title": title,
                    },
                )

            # ===== STAGE 2: Try Discogs Enrichment (if enabled) =====
            metadata = None
            # Check gradual rollout percentage
            use_discogs_for_request = (
                self.config.use_discogs
                and self.discogs_enrichment
                and random.randint(1, 100) <= self.config.discogs_rollout_percentage
            )
            if use_discogs_for_request:
                stage2_start = time.time()
                try:
                    logger.info(
                        "Stage 2: Attempting Discogs enrichment",
                        extra={
                            "stage": "stage2_discogs",
                            "artist": artist,
                            "title": title,
                            "rollout_enabled": True,
                        },
                    )
                    metadata = self.discogs_enrichment.enrich_metadata(
                        artist, title, mix, id3_tags
                    )
                    stage2_duration = time.time() - stage2_start
                    if metadata:
                        self.metrics.record_stage("stage2_discogs", stage2_duration, success=True)
                        self.metrics.record_discogs_call(success=True)
                        logger.info(
                            "Stage 2 complete: Discogs enrichment successful",
                            extra={
                                "stage": "stage2_discogs",
                                "duration_seconds": round(stage2_duration, 3),
                                "success": True,
                            },
                        )
                        # Cache the result
                        if self.metadata_cache:
                            self.metadata_cache.set(artist, title, mix, metadata)
                        return self._normalize_metadata(metadata)
                    else:
                        self.metrics.record_stage("stage2_discogs", stage2_duration, success=False)
                        self.metrics.record_discogs_call(success=False)
                        self.metrics.record_fallback("stage2_discogs", "stage3_llm")
                        logger.info(
                            "Stage 2: Discogs enrichment returned no results",
                            extra={
                                "stage": "stage2_discogs",
                                "duration_seconds": round(stage2_duration, 3),
                                "success": False,
                            },
                        )
                except Exception as e:
                    stage2_duration = time.time() - stage2_start
                    self.metrics.record_stage("stage2_discogs", stage2_duration, success=False)
                    self.metrics.record_discogs_call(success=False)
                    self.metrics.record_fallback("stage2_discogs", "stage3_llm")
                    logger.warning(
                        f"Stage 2: Discogs enrichment failed: {e}, falling back to LLM",
                        extra={
                            "stage": "stage2_discogs",
                            "duration_seconds": round(stage2_duration, 3),
                            "error": str(e),
                            "fallback": "stage3_llm",
                        },
                    )
            elif self.config.use_discogs and self.discogs_enrichment:
                # Discogs is enabled but this request was excluded by rollout percentage
                logger.debug(
                    "Stage 2: Discogs enrichment skipped due to gradual rollout",
                    extra={
                        "stage": "stage2_discogs",
                        "rollout_percentage": self.config.discogs_rollout_percentage,
                        "rollout_enabled": False,
                    },
                )

            # ===== STAGE 3: Fallback to LLM-only (if enabled) =====
            if self.config.use_llm_fallback and self._is_available():
                stage3_start = time.time()
                try:
                    logger.info(
                        "Stage 3: Attempting LLM-only extraction",
                        extra={
                            "stage": "stage3_llm",
                            "artist": artist,
                            "title": title,
                            "provider": self.__class__.__name__,
                        },
                    )
                    # Build filename message with ID3 tags if available
                    filename_content = self._build_filename_message(
                        filename_without_ext, id3_tags
                    )

                    # Handle rate limiting and retries
                    response = self._make_api_call_with_retry(filename_content)
                    self.metrics.record_llm_call()

                    # Parse response (provider-specific)
                    metadata = self._parse_response(response)

                    # Normalize and validate metadata
                    normalized_metadata = self._normalize_metadata(metadata)

                    stage3_duration = time.time() - stage3_start
                    self.metrics.record_stage("stage3_llm", stage3_duration, success=True)
                    logger.info(
                        "Stage 3 complete: LLM-only extraction successful",
                        extra={
                            "stage": "stage3_llm",
                            "duration_seconds": round(stage3_duration, 3),
                            "success": True,
                        },
                    )
                    # Cache the result
                    if self.metadata_cache:
                        self.metadata_cache.set(artist, title, mix, normalized_metadata)
                    return normalized_metadata

                except Exception as e:
                    stage3_duration = time.time() - stage3_start
                    self.metrics.record_stage("stage3_llm", stage3_duration, success=False)
                    self.metrics.record_fallback("stage3_llm", "stage4_simple")
                    logger.warning(
                        f"Stage 3: LLM-only extraction failed: {e}, falling back to simple extraction",
                        extra={
                            "stage": "stage3_llm",
                            "duration_seconds": round(stage3_duration, 3),
                            "error": str(e),
                            "fallback": "stage4_simple",
                        },
                    )

            # ===== STAGE 4: Simple Extraction (last resort) =====
            stage4_start = time.time()
            logger.info(
                "Stage 4: Using simple extraction (last resort)",
                extra={
                    "stage": "stage4_simple",
                    "artist": artist,
                    "title": title,
                },
            )
            metadata = self._simple_extraction(artist, title, mix, id3_tags)
            stage4_duration = time.time() - stage4_start
            self.metrics.record_stage("stage4_simple", stage4_duration, success=True)
            logger.info(
                "Stage 4 complete: Simple extraction",
                extra={
                    "stage": "stage4_simple",
                    "duration_seconds": round(stage4_duration, 3),
                },
            )
            # Cache the result (even simple extraction results)
            if self.metadata_cache:
                self.metadata_cache.set(artist, title, mix, metadata)
            return metadata

        except Exception as e:
            provider_name = self.__class__.__name__
            logger.error(f"Failed to extract metadata using {provider_name}: {e}")
            return self._get_empty_metadata()

    def _simple_extraction(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        id3_tags: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Simple extraction using only ID3 tags and filename (no LLM, no Discogs).

        Args:
            artist: Extracted artist name
            title: Extracted title
            mix: Optional mix name
            id3_tags: Optional ID3 tags

        Returns:
            Basic metadata dictionary
        """
        metadata = {
            "artist": artist or "",
            "title": title or "",
            "mix": mix,
            "year": None,
            "country": None,
            "label": None,
            "genre": [],
            "style": [],
            "audioFeatures": None,
            "context": None,
            "description": None,
            "tags": [],
        }

        # Fill in from ID3 tags if available
        if id3_tags:
            if not metadata["year"] and id3_tags.get("year"):
                try:
                    year_str = str(id3_tags.get("year", "")).strip()
                    # Extract 4-digit year from string
                    year_match = re.search(r"\b(19|20)\d{2}\b", year_str)
                    if year_match:
                        metadata["year"] = int(year_match.group())
                except (ValueError, AttributeError):
                    pass

            if not metadata["label"]:
                metadata["label"] = (
                    id3_tags.get("label") or id3_tags.get("publisher") or None
                )

            if id3_tags.get("genre"):
                genre_str = str(id3_tags.get("genre", "")).strip()
                if genre_str:
                    # Split by common separators
                    genres = [
                        g.strip()
                        for g in re.split(r"[,;/|]", genre_str)
                        if g.strip()
                    ]
                    metadata["genre"] = genres[:3]  # Limit to 3 genres

        return self._normalize_metadata(metadata)

    def _normalize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize metadata to ensure it matches the expected schema.

        Args:
            metadata: Raw metadata from AI provider

        Returns:
            Normalized metadata dictionary
        """
        # Ensure all required fields are present
        normalized = {
            "artist": metadata.get("artist") or "",
            "title": metadata.get("title") or "",
            "mix": metadata.get("mix"),
            "year": metadata.get("year"),
            "country": metadata.get("country"),
            "label": metadata.get("label"),
            "genre": metadata.get("genre") or [],
            "style": metadata.get("style") or [],
            "audioFeatures": metadata.get("audioFeatures"),
            "context": metadata.get("context"),
            "description": metadata.get("description"),
            "tags": metadata.get("tags") or [],
        }

        # Ensure genre, style, and tags are lists
        if not isinstance(normalized["genre"], list):
            normalized["genre"] = [normalized["genre"]] if normalized["genre"] else []
        if not isinstance(normalized["style"], list):
            normalized["style"] = [normalized["style"]] if normalized["style"] else []
        if not isinstance(normalized["tags"], list):
            normalized["tags"] = [normalized["tags"]] if normalized["tags"] else []

        # Normalize audioFeatures
        if normalized["audioFeatures"]:
            if not isinstance(normalized["audioFeatures"], dict):
                normalized["audioFeatures"] = {}
            # Ensure atmosphere is a list (handle both string and array inputs)
            if "atmosphere" in normalized["audioFeatures"]:
                atmosphere = normalized["audioFeatures"]["atmosphere"]
                if isinstance(atmosphere, str):
                    # Convert single string to array
                    normalized["audioFeatures"]["atmosphere"] = (
                        [atmosphere] if atmosphere else []
                    )
                elif not isinstance(atmosphere, list):
                    # Convert other types to array
                    normalized["audioFeatures"]["atmosphere"] = (
                        [atmosphere] if atmosphere else []
                    )
                # If it's already a list, keep it as is
            else:
                normalized["audioFeatures"]["atmosphere"] = []
        else:
            # Ensure audioFeatures is present (required field)
            normalized["audioFeatures"] = {
                "bpm": None,
                "key": None,
                "vocals": None,
                "atmosphere": [],
            }

        # Normalize context (optional field)
        if normalized["context"] and not isinstance(normalized["context"], dict):
            normalized["context"] = None

        # Ensure description is populated if genre, style, or tags are present
        has_ai_metadata = (
            normalized["genre"] or normalized["style"] or normalized["tags"]
        )

        if has_ai_metadata and not normalized["description"]:
            # Generate a description based on available metadata
            description_parts = []

            if normalized["genre"]:
                genre_str = ", ".join(
                    normalized["genre"][:3]
                )  # Limit to first 3 genres
                description_parts.append(f"{genre_str} track")

            if normalized["style"]:
                style_str = ", ".join(
                    normalized["style"][:2]
                )  # Limit to first 2 styles
                if description_parts:
                    description_parts.append(f"with {style_str} influences")
                else:
                    description_parts.append(f"{style_str} style")

            if normalized["tags"]:
                # Use tags to add context
                tag_str = ", ".join(normalized["tags"][:2])  # Limit to first 2 tags
                if description_parts:
                    description_parts.append(f"characterized by {tag_str}")

            if description_parts:
                normalized["description"] = ". ".join(description_parts) + "."
                logger.info(
                    f"Generated description from metadata: {normalized['description'][:100]}"
                )

        return normalized

    def _extract_urls_from_text(self, text: str) -> List[str]:
        """
        Extract all URLs from a text string, excluding YouTube links.

        Args:
            text: Text to search for URLs

        Returns:
            List of extracted URLs (YouTube links are filtered out)
        """
        urls = []

        # Pattern to match full URLs with protocol
        url_pattern_with_protocol = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls_with_protocol = re.findall(url_pattern_with_protocol, text, re.IGNORECASE)
        urls.extend(urls_with_protocol)

        # Pattern to match URLs without protocol (common music database domains, excluding YouTube)
        url_pattern_without_protocol = r'(?:discogs|spotify|bandcamp|musicbrainz)\.(?:com|org)/[^\s<>"{}|\\^`\[\]]+'
        urls_without_protocol = re.findall(
            url_pattern_without_protocol,
            text,
            re.IGNORECASE,
        )
        # Add https:// prefix to URLs without protocol
        for url in urls_without_protocol:
            full_url = f"https://{url}"
            if full_url not in urls:
                urls.append(full_url)

        # Filter out YouTube links (youtube.com, youtu.be)
        filtered_urls = [
            url
            for url in urls
            if not re.search(r"youtube\.com|youtu\.be", url, re.IGNORECASE)
        ]

        # Remove duplicates and return
        return list(set(filtered_urls))

    def _build_filename_message(
        self, filename: str, id3_tags: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build the dynamic filename message (only part that changes per request).

        Args:
            filename: Audio filename without extension
            id3_tags: Optional ID3 tags dictionary for more accurate metadata

        Returns:
            Formatted prompt string with filename and ID3 tags if available
        """
        # Use "artist - title" format if both are available in id3_tags
        display_filename = filename
        if id3_tags:
            artist = id3_tags.get("artist", "").strip()
            title = id3_tags.get("title", "").strip()
            if artist and title:
                display_filename = f"{artist} - {title}"

        base_message = f'''Extract and enrich music metadata from this filename: "{display_filename}"'''

        # Extract and highlight links from description FIRST, before other ID3 tags
        extracted_urls = []
        if id3_tags:
            description = id3_tags.get("description", "")
            if description:
                extracted_urls = self._extract_urls_from_text(description)

        # If URLs found, present them prominently at the top
        if extracted_urls:
            base_message += "\n\n" + "=" * 80
            base_message += (
                "\n🚨 CRITICAL: AUTHORITATIVE SOURCE LINKS FOUND IN ID3 DESCRIPTION"
            )
            base_message += "\n" + "=" * 80
            base_message += "\n\nYou MUST visit and extract metadata from these URLs. These are the PRIMARY and HIGHEST PRIORITY sources."
            base_message += "\nIgnore all other sources if these links provide conflicting information."
            base_message += "\n\nSOURCE LINKS TO USE:\n"
            for i, url in enumerate(extracted_urls, 1):
                base_message += f"{i}. {url}\n"
            base_message += "\n" + "=" * 80 + "\n"

        # Add ID3 tag information if available
        if id3_tags:
            id3_info_parts = []
            if id3_tags.get("title"):
                id3_info_parts.append(f"Title: {id3_tags.get('title')}")
            if id3_tags.get("artist"):
                id3_info_parts.append(f"Artist: {id3_tags.get('artist')}")
            if id3_tags.get("album"):
                id3_info_parts.append(f"Album: {id3_tags.get('album')}")
            if id3_tags.get("year") or id3_tags.get("date"):
                year = id3_tags.get("year") or id3_tags.get("date", "")
                if year:
                    id3_info_parts.append(f"Year: {year}")
            if id3_tags.get("genre"):
                id3_info_parts.append(f"Genre: {id3_tags.get('genre')}")
            if id3_tags.get("bpm"):
                id3_info_parts.append(f"BPM: {id3_tags.get('bpm')}")
            if id3_tags.get("description"):
                id3_info_parts.append(f"Description: {id3_tags.get('description')}")

            if id3_info_parts:
                # More concise ID3 tag format
                id3_section = "\n\nID3 tags: " + " | ".join(id3_info_parts)
                base_message += id3_section

            if extracted_urls:
                base_message += "\n\n⚠️ REMINDER: Use the SOURCE LINKS listed above as your PRIMARY data source. Extract all metadata from those URLs first."
            else:
                base_message += "\n\nUse ID3 tags as PRIMARY source for artist, title, year, genre. Enrich with music databases."

        base_message += "\n\nReturn ONLY a JSON object with these exact fields: artist, title, mix, year, country, label, genre, style, audioFeatures (with bpm, key, vocals, atmosphere), context (with background, impact), description, tags."
        base_message += "\nDo NOT include any other fields like album, release_year, track_number, format, duration, albumArt, credits, availability, etc."

        return base_message

    def _clean_json_response(self, content: str) -> str:
        """
        Clean JSON response by removing markdown code blocks and explanations.

        Args:
            content: Raw response content

        Returns:
            Cleaned JSON string
        """
        import re

        # Remove markdown code blocks if present
        content = content.strip()

        # Remove ```json and ``` markers
        content = re.sub(r"```json\s*", "", content)
        content = re.sub(r"```\s*", "", content)
        content = content.strip()

        # Try to extract JSON object if there's extra text
        # Look for first { and last }
        first_brace = content.find("{")
        last_brace = content.rfind("}")

        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            content = content[first_brace : last_brace + 1]

        return content.strip()

    def _get_empty_metadata(self) -> Dict[str, Any]:
        """
        Get empty metadata structure matching the expected schema.

        Returns:
            Empty metadata dictionary with all required fields
        """
        return {
            "artist": "",
            "title": "",
            "mix": None,
            "year": None,
            "country": None,
            "label": None,
            "genre": [],
            "style": [],
            "audioFeatures": {
                "bpm": None,
                "key": None,
                "vocals": None,
                "atmosphere": [],
            },
            "context": None,
            "description": None,
            "tags": [],
        }
