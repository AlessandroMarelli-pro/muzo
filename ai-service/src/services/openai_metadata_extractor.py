"""
OpenAI-based metadata extraction service for extracting music metadata from filenames.

This service uses OpenAI's structured outputs to extract comprehensive metadata
from audio filenames, including artist, title, genre, style, credits, and more.
"""

import json
import os
import re
import time
from collections import deque
from threading import Lock
from typing import Any, Dict, Optional

from jsonschema import validate
from jsonschema.exceptions import ValidationError
from loguru import logger
from openai import APIError, OpenAI, RateLimitError

from src.services.simple_metadata_extractor import SimpleMetadataExtractor
from src.utils.performance_optimizer import monitor_performance


class RateLimiter:
    """Thread-safe rate limiter for OpenAI API calls with exponential backoff."""

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


class OpenAIMetadataExtractor:
    """
    OpenAI-based metadata extraction service that extracts comprehensive
    music metadata from filenames using OpenAI's structured outputs.
    """

    # Agent configuration matching TypeScript config
    MODEL = "gpt-4o-mini"
    TEMPERATURE = 0.1  # Strict temperature: 0-0.2 range for deterministic output

    # Rate limiting configuration
    MAX_REQUESTS_PER_MINUTE = int(os.getenv("OPENAI_MAX_REQUESTS_PER_MINUTE", "60"))
    MAX_REQUESTS_PER_DAY = (
        int(os.getenv("OPENAI_MAX_REQUESTS_PER_DAY"))
        if os.getenv("OPENAI_MAX_REQUESTS_PER_DAY")
        else None
    )
    MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "3"))
    INITIAL_BACKOFF = float(os.getenv("OPENAI_INITIAL_BACKOFF", "1.0"))

    INSTRUCTIONS = [
        "You are a music metadata resolution agent.",
        "Your task is NOT limited to parsing the filename.",
        "You MUST resolve and enrich metadata using your general music knowledge",
        "and well-known public music databases (e.g. Youtube, Discogs, Amazon, MusicBrainz, Spotify, Bandcamp, Apple Music, LastFM, etc.).",
        "",
        "REQUIRED OUTPUT SCHEMA - You MUST return ONLY the fields provided in the example output.",
        "RULES:",
        "- If ID3 tags are provided, use them as the PRIMARY source for artist, title, year, and genre.",
        "- Use the filename as a secondary identifier (artist, title, mix) if ID3 tags are not available.",
        "- Populate all other fields using reliable, commonly accepted music metadata.",
        "- If multiple sources disagree, choose the most widely accepted value.",
        "- If no reliable public metadata exists, use null (or [] for arrays).",
        "- Do NOT invent obscure credits or speculative data.",
        "- Prefer canonical release metadata (original year, primary format).",
        "- Return ONLY valid JSON matching the exact schema above.",
        "- No explanations, no comments, no markdown, no extra fields.",
        "",
        "CONFIDENCE POLICY:",
        "- High confidence: widely documented releases → fill all known fields.",
        "- Medium confidence: known artist/track but limited documentation → fill genre/style, leave credits null if unsure.",
        "- Low confidence: obscure or ambiguous tracks → only fill artist/title/mix, others null.",
        "",
        "DESCRIPTION REQUIREMENT:",
        "- If genre, style, or tags are populated, you MUST provide a description.",
        "- The description should be a brief, informative text describing the track's characteristics,",
        "  musical style, era, or notable features based on the genre, style, and tags.",
        "- Description should be 1-3 sentences, written in a natural, informative style.",
        "- If genre, style, and tags are all empty/null, description can be null.",
    ]

    # Response schema matching the expected output structure
    # Production-ready: additionalProperties: false to reject extra keys
    RESPONSE_SCHEMA = {
        "type": "object",
        "additionalProperties": False,  # Reject any properties not in schema
        "properties": {
            "artist": {"type": "string"},
            "title": {"type": "string"},
            "mix": {"type": ["string", "null"]},
            "year": {"type": ["string", "integer", "null"]},
            "country": {"type": ["string", "null"]},
            "label": {"type": ["string", "null"]},
            "format": {"type": ["string", "null"]},
            "genre": {
                "type": "array",
                "items": {"type": "string"},
            },
            "style": {
                "type": "array",
                "items": {"type": "string"},
            },
            "albumArt": {"type": ["string", "null"]},
            "duration": {"type": ["string", "null"]},
            "credits": {
                "type": ["object", "null"],
                "additionalProperties": False,  # Reject extra keys in credits
                "properties": {
                    "producer": {"type": ["string", "null"]},
                    "writers": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "vocals": {"type": ["string", "null"]},
                },
            },
            "description": {"type": ["string", "null"]},
            "availability": {
                "type": ["object", "null"],
                "additionalProperties": False,  # Reject extra keys in availability
                "properties": {
                    "streaming": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "physical": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["artist", "title", "genre", "style", "tags"],
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the OpenAI metadata extractor service.

        Args:
            api_key: OpenAI API key. If not provided, will use OPENAI_API_KEY env var.
        """
        logger.info("OpenAIMetadataExtractor initializing")

        # Get API key from parameter or environment
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable."
            )
            self.client = None
        else:
            self.client = OpenAI(api_key=self.api_key)
            logger.info("OpenAI client initialized successfully")

        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            max_requests_per_minute=self.MAX_REQUESTS_PER_MINUTE,
            max_requests_per_day=self.MAX_REQUESTS_PER_DAY,
        )

        # Initialize ID3 tag extractor for more accurate metadata
        self.id3_extractor = SimpleMetadataExtractor()

    def _is_available(self) -> bool:
        """Check if the service is available (API key configured)."""
        return self.client is not None

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

    @monitor_performance("openai_metadata_extraction")
    def extract_metadata_from_filename(
        self, filename: str, file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from a filename using OpenAI.
        If file_path is provided, ID3 tags will be extracted and used for more accurate results.

        Args:
            filename: Audio filename (with or without extension)
            file_path: Optional path to the audio file for ID3 tag extraction

        Returns:
            Dictionary containing extracted metadata matching the expected schema
        """
        if not self._is_available():
            logger.warning(
                "OpenAI service not available (missing API key). Returning empty metadata."
            )
            return self._get_empty_metadata()

        try:
            logger.info(f"Extracting metadata from filename using OpenAI: {filename}")

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
            response = self._make_api_call_with_retry(
                filename_content, filename_without_ext
            )

            # Log token usage for monitoring
            usage = response.usage
            logger.info(
                f"OpenAI token usage - Prompt: {usage.prompt_tokens}, "
                f"Completion: {usage.completion_tokens}, Total: {usage.total_tokens}"
            )

            # Extract the JSON response
            content = response.choices[0].message.content
            if not content:
                logger.warning("Empty response from OpenAI")
                return self._get_empty_metadata()
            # Clean content: remove markdown code blocks if present
            cleaned_content = self._clean_json_response(content)
            # Parse JSON response with strict validation
            try:
                metadata = json.loads(cleaned_content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OpenAI response as JSON: {e}")
                logger.error(f"Response content: {cleaned_content[:500]}")
                return self._get_empty_metadata()

            # Filter out invalid fields before validation (fallback to prevent failures)
            valid_fields = set(self.RESPONSE_SCHEMA["properties"].keys())
            invalid_fields = set(metadata.keys()) - valid_fields
            if invalid_fields:
                logger.warning(
                    f"OpenAI returned invalid fields: {invalid_fields}. "
                    f"Filtering them out before validation."
                )
                metadata = {k: v for k, v in metadata.items() if k in valid_fields}

            # Runtime validation: reject non-JSON and additional properties
            try:
                validate(instance=metadata, schema=self.RESPONSE_SCHEMA)
            except ValidationError as e:
                logger.error(f"Schema validation failed after filtering: {e.message}")
                logger.error(f"Metadata keys after filtering: {list(metadata.keys())}")
                return self._get_empty_metadata()

            # Validate and normalize the response
            normalized_metadata = self._normalize_metadata(metadata)

            logger.info(
                f"Metadata extracted: {normalized_metadata.get('artist', 'Unknown')} - {normalized_metadata.get('title', 'Unknown')}"
            )
            return normalized_metadata

        except Exception as e:
            logger.error(f"Failed to extract metadata using OpenAI: {e}")
            return self._get_empty_metadata()

    def _make_api_call_with_retry(self, filename_content: str, filename: str) -> Any:
        """
        Make API call with rate limiting and exponential backoff retry logic.

        Args:
            filename_content: Formatted filename message
            filename: Original filename for logging

        Returns:
            OpenAI API response

        Raises:
            Exception: If all retries fail
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

                # Make API call with structured outputs
                # Combine example and filename into single user message for efficiency
                combined_user_message = (
                    self._build_example_message() + "\n\n" + filename_content
                )
                response = self.client.chat.completions.create(
                    model=self.MODEL,
                    temperature=self.TEMPERATURE,
                    messages=[
                        {
                            "role": "system",
                            "content": "\n".join(self.INSTRUCTIONS),
                        },
                        {
                            "role": "user",
                            "content": combined_user_message,
                        },
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1500,  # Reasonable limit to speed up generation without truncation
                    timeout=30.0,  # Fail fast if response takes too long
                )

                # Success - return response
                return response

            except RateLimitError as e:
                last_exception = e
                error_message = str(e).lower()

                # Extract retry-after from headers if available
                retry_after = self.INITIAL_BACKOFF * (2**attempt)

                # Check if error message contains retry-after information
                if "retry after" in error_message:
                    try:
                        # Try to extract retry-after seconds from error message
                        import re

                        match = re.search(r"retry after (\d+)", error_message)
                        if match:
                            retry_after = int(match.group(1))
                    except (ValueError, AttributeError):
                        pass

                if attempt < self.MAX_RETRIES:
                    logger.warning(
                        f"Rate limit error (attempt {attempt + 1}/{self.MAX_RETRIES + 1}): {e}. "
                        f"Retrying after {retry_after:.2f} seconds..."
                    )
                    time.sleep(retry_after)
                    continue
                else:
                    logger.error(
                        f"Rate limit error after {self.MAX_RETRIES + 1} attempts: {e}"
                    )
                    raise

            except APIError as e:
                last_exception = e
                error_message = str(e).lower()

                # Determine if error is retryable
                is_retryable = (
                    "500" in error_message
                    or "502" in error_message
                    or "503" in error_message
                    or "504" in error_message
                    or "timeout" in error_message
                    or "server" in error_message
                )

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

            except Exception as e:
                # Non-retryable errors or unexpected errors
                last_exception = e
                logger.error(f"Unexpected error during API call: {e}")
                raise

        # Should never reach here, but just in case
        if last_exception:
            raise last_exception
        raise Exception("Failed to make API call after retries")

    def _normalize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize metadata to ensure it matches the expected schema.

        Args:
            metadata: Raw metadata from OpenAI

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
            "format": metadata.get("format"),
            "genre": metadata.get("genre") or [],
            "style": metadata.get("style") or [],
            "duration": metadata.get("duration"),
            "albumArt": metadata.get("albumArt"),
            "credits": metadata.get("credits"),
            "description": metadata.get("description"),
            "availability": metadata.get("availability"),
            "tags": metadata.get("tags") or [],
        }

        # Ensure genre, style, and tags are lists
        if not isinstance(normalized["genre"], list):
            normalized["genre"] = [normalized["genre"]] if normalized["genre"] else []
        if not isinstance(normalized["style"], list):
            normalized["style"] = [normalized["style"]] if normalized["style"] else []
        if not isinstance(normalized["tags"], list):
            normalized["tags"] = [normalized["tags"]] if normalized["tags"] else []

        # Convert year to string if it's an integer
        if isinstance(normalized["year"], int):
            normalized["year"] = str(normalized["year"])

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

    def _build_example_message(self) -> str:
        """
        Build the static example message that will be cached.

        Returns:
            Formatted example string
        """
        example_input = "Georgie Red - Help the Man (Save Ya Mix) [1985]"
        example_output = {
            "artist": "Georgie Red",
            "title": "Help the Man",
            "mix": "Save Ya Mix",
            "year": 1985,
            "country": "UK",
            "label": "Unknown",
            "format": 'Vinyl, 12"',
            "genre": ["Electronic", "Disco", "Funk"],
            "style": ["Electro", "Boogie", "Dance"],
            "duration": "7:15",
            "albumArt": "https://example.com/album-art-albumArt.jpg",
            "credits": {
                "producer": "Woolfe Bang",
                "writers": ["George Kochbek", "Phill Earl Edwards"],
                "vocals": "Phill Earl Edwards",
            },
            "description": "Extended 12-inch club mix typical of mid-1980s electro-disco releases, designed for DJ use with emphasis on groove and rhythm.",
            "availability": {
                "streaming": ["Spotify", "YouTube"],
                "physical": ["12-inch vinyl"],
            },
            "tags": ["1980s", "club mix", "electro funk", "rare disco"],
        }

        return f"""Example:
Input: "{example_input}"
Output: {json.dumps(example_output, indent=2)}

Now extract metadata from the filename provided in the next message.
Return only the JSON object, no markdown, no explanations."""

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

        base_message += "\n\nReturn ONLY a JSON object with these exact fields: artist, title, mix, year, country, label, format, genre, style, duration, albumArt, credits, description, availability, tags."
        base_message += "\nDo NOT include any other fields like album, release_year, track_number, etc."

        return base_message

    def _clean_json_response(self, content: str) -> str:
        """
        Clean JSON response by removing markdown code blocks and explanations.

        Args:
            content: Raw response content from OpenAI

        Returns:
            Cleaned JSON string
        """
        # Remove markdown code blocks (```json ... ``` or ``` ... ```)
        content = re.sub(r"```json\s*", "", content)
        content = re.sub(r"```\s*", "", content)
        content = content.strip()

        # Try to extract JSON if there's text before/after
        # Look for first { and last } to extract JSON object
        first_brace = content.find("{")
        last_brace = content.rfind("}")

        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            content = content[first_brace : last_brace + 1]

        return content.strip()

    def _get_empty_metadata(self) -> Dict[str, Any]:
        """Return empty metadata structure matching the schema."""
        return {
            "artist": "",
            "title": "",
            "mix": None,
            "year": None,
            "country": None,
            "label": None,
            "format": None,
            "genre": [],
            "style": [],
            "duration": None,
            "albumArt": None,
            "credits": None,
            "description": None,
            "availability": None,
            "tags": [],
        }
