"""
Base metadata extraction service with shared functionality.

This module provides a base class for AI-powered metadata extraction services,
with common functionality shared between different providers (OpenAI, Gemini, etc.).
"""

import os
import time
from abc import ABC, abstractmethod
from collections import deque
from threading import Lock
from typing import Any, Dict, Optional

from loguru import logger

from src.services.simple_metadata_extractor import SimpleMetadataExtractor
from src.utils.performance_optimizer import monitor_performance


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
        "You MUST resolve and enrich metadata using your general music knowledge",
        "and well-known public music databases (e.g. Youtube, Discogs, Amazon, MusicBrainz, Spotify, Bandcamp, Apple Music, LastFM, Beatport, Tunebat, etc.).",
        "",
        "REQUIRED OUTPUT SCHEMA - You MUST return ONLY the fields provided in the schema.",
        "RULES:",
        "- If ID3 tags are provided, use them as the PRIMARY source for artist, title, year, and genre.",
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

        # Provider-specific client initialization
        self.client = self._initialize_client()

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
        Extract comprehensive metadata from a filename using AI.
        If file_path is provided, ID3 tags will be extracted and used for more accurate results.

        Args:
            filename: Audio filename (with or without extension)
            file_path: Optional path to the audio file for ID3 tag extraction

        Returns:
            Dictionary containing extracted metadata matching the expected schema
        """
        if not self._is_available():
            provider_name = self.__class__.__name__
            logger.warning(
                f"{provider_name} service not available (missing API key or SDK). Returning empty metadata."
            )
            return self._get_empty_metadata()

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

            # Build filename message with ID3 tags if available
            filename_content = self._build_filename_message(
                filename_without_ext, id3_tags
            )

            # Handle rate limiting and retries
            response = self._make_api_call_with_retry(filename_content)

            # Parse response (provider-specific)
            metadata = self._parse_response(response)

            # Normalize and validate metadata
            normalized_metadata = self._normalize_metadata(metadata)

            logger.info(
                f"Metadata extracted: {normalized_metadata.get('artist', 'N/A')} - {normalized_metadata.get('title', 'N/A')}"
            )
            return normalized_metadata

        except Exception as e:
            provider_name = self.__class__.__name__
            logger.error(f"Failed to extract metadata using {provider_name}: {e}")
            return self._get_empty_metadata()

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
