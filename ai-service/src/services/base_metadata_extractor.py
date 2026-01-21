"""
Base metadata extraction service with shared functionality.

This module provides a base class for AI-powered metadata extraction services,
with common functionality shared between different providers (OpenAI, Gemini, etc.).
"""

import os
import re
import time
from abc import ABC, abstractmethod
from collections import deque
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

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
        "Your task is to extract and enrich metadata for music tracks with comprehensive detail.",
        "You MUST resolve and enrich metadata from well-known public music databases (e.g. Discogs, Amazon, MusicBrainz, Spotify, Bandcamp, Apple Music, LastFM, Beatport, etc.).",
        "and using your general music knowledge",
        "REQUIRED OUTPUT SCHEMA - You MUST return ONLY the fields provided in the schema.",
        "",
        "=== FEW-SHOT EXAMPLE ===",
        "",
        "### EXAMPLE INPUT:",
        'Track: "The Funkees - Akula Owu Onyeara"',
        "URL: https://www.discogs.com/release/12345678-The-Funkees-Akula-Owu-Onyeara",
        "",
        "### EXAMPLE OUTPUT (JSON):",
        "{",
        '  "artist": "The Funkees",',
        '  "title": "Akula Owu Onyeara",',
        '  "mix": null,',
        '  "year": 1973,',
        '  "country": "Nigeria",',
        '  "label": "EMI Nigeria",',
        '  "genre": ["Funk", "Afrobeat", "Soul"],',
        '  "style": ["Nigerian Funk", "Afro-Funk", "Highlife Fusion"],',
        '  "audioFeatures": {',
        '    "vocals": "Ibo male vocals with call-and-response patterns",',
        '    "atmosphere": ["Groovy", "Energetic", "Rhythmic", "Soulful", "Danceable"]',
        "  },",
        '  "context": {',
        '    "background": "Formed in the late 1960s in Aba, Nigeria, The Funkees became a leading force in the post-Biafran war music scene. This track was recorded during their peak period at EMI Nigeria studios in Lagos, featuring the band\'s signature blend of American funk influences with traditional Igbo highlife rhythms. The song showcases the group\'s tight horn arrangements and infectious grooves that defined the Nigerian funk movement of the early 1970s.",',
        '    "impact": "Akula Owu Onyeara has become a sought-after collector\'s item, with original pressings fetching high prices. The track has been sampled by contemporary producers and featured in compilations celebrating African funk. It represents a pivotal moment in Nigerian music history, bridging traditional highlife with modern funk sensibilities."',
        "  },",
        '  "tags": ["1970s", "Nigerian Funk", "Afrobeat", "Collector\'s Item", "EMI Nigeria"]',
        "}",
        "",
        "=== END EXAMPLE ===",
        "",
        "RULES:",
        "- CRITICAL: If source URLs have been automatically fetched (via URL context tool), you MUST:",
        "  1. Use information from the fetched URL content as the HIGHEST PRIORITY source",
        "  2. Override any conflicting information from other sources with data from the fetched URLs",
        "  3. These URLs point directly to authoritative music databases (Discogs, Spotify, Bandcamp, etc.)",
        "  4. Extract EVERY detail from the fetched pages: recording dates, studio information, personnel, release history, cultural context",
        "- If Google Search (grounding) is enabled, use it to find missing information:",
        "  1. Search for auction prices on Discogs, mentions in music blogs (Vinyl Factory, Resident Advisor, etc.), archival radio playlists, reissue history",
        "  2. Find cultural impact details, DJ sets, samples, compilation appearances that may not be in the provided URLs",
        "  3. Use search results to enrich the 'context.impact' field with specific examples (e.g., 'Featured in Gilles Peterson's 2023 compilation', 'Sampled by producer X in 2020')",
        "  4. Prioritize URL context content over search results when both are available",
        "- If ID3 tags are provided (album, genre), use them as supplementary information but prioritize URL context if available.",
        "- Extract artist, title, and mix from the track identifier provided in the prompt.",
        "- Populate all other fields using reliable, commonly accepted music metadata.",
        "- If multiple sources disagree, choose the most widely accepted value.",
        "- If no reliable public metadata exists, use null (or [] for arrays).",
        "- Do NOT invent obscure credits or speculative data.",
        "- Prefer canonical release metadata (original year, primary format).",
        "- Return ONLY valid JSON matching the exact schema.",
        "- No explanations, no comments, no markdown, no extra fields.",
        "- CRITICAL: Before generating the JSON, analyze the fetched URL content in silence to extract every detail. Then, populate the schema using the most comprehensive information discovered to ensure maximum richness in the context and audioFeatures fields.",
        "",
        "TECHNICAL AUDIO FEATURES (audioFeatures):",
        "- Vocals: Provide detailed description (e.g., 'Ibo male vocals with call-and-response patterns', 'Turkish female vocals with traditional instrumentation', 'Instrumental with sampled vocal chops'). If no vocals, use 'Instrumental'.",
        "- Atmosphere: Provide 3-5 specific vibe keywords that describe the track's mood and texture (e.g., 'Hypnotic', 'Sparkly', 'Industrial', 'Ethereal', 'Dark', 'Groovy', 'Energetic').",
        "",
        "CULTURAL CONTEXT (context):",
        "- Background: MUST be a comprehensive narrative of at least 150 characters. Include: recording studio, featured musicians, historical context of the era, production details, and cultural significance. Example: 'Formed in the late 1960s in Aba, Nigeria, The Funkees became a leading force...'",
        "- Impact: MUST detail the cultural significance, rarity, reissue history, and specific mentions in modern music culture (e.g., charts, samples, or iconic DJ sets). Include collector value, compilation appearances, and contemporary influence.",
        "- For tracks with non-English vocals, identify the language and cultural background when relevant.",
        "",
        "CONFIDENCE POLICY:",
        "- High confidence: widely documented releases → fill all known fields including audioFeatures and context with rich detail (150+ characters for context fields).",
        "- Medium confidence: known artist/track but limited documentation → fill genre/style/audioFeatures, provide context if available but mark as less certain.",
        "- Low confidence: obscure or ambiguous tracks → only fill artist/title/mix, others null.",
        "",
        "QUALITY STANDARDS:",
        "- Context.background and context.impact must be comprehensive narratives, not single sentences.",
        "- Extract maximum detail from URL sources - don't summarize, be specific.",
        "- Match the depth and richness shown in the example above.",
        "",    ]

    TEMPERATURE = 0  # Strict temperature: 0 for maximum determinism (stops hallucination)
    TOP_P = 0.1  # Nucleus sampling: 0.1 forces model to stick to most statistically likely facts from fetched URLs
    TOP_K = 1  # Top-k sampling: 1 = only most likely token (use with temp=0 for determinism)
    SEED = None  # Fixed seed for reproducibility (set to integer for deterministic outputs)

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_requests_per_minute: int = 60,
        max_requests_per_day: Optional[int] = None,
        max_retries: int = 3,
        initial_backoff: float = 1.0,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        seed: Optional[int] = None,
    ):
        """
        Initialize the base metadata extractor.

        Args:
            api_key: API key for the provider
            max_requests_per_minute: Maximum requests per minute
            max_requests_per_day: Maximum requests per day (optional)
            max_retries: Maximum number of retries
            initial_backoff: Initial backoff time in seconds
            temperature: Override temperature (0.0 for maximum determinism)
            top_p: Override top_p (1.0 = all tokens, lower = more focused)
            top_k: Override top_k (1 = only most likely token)
            seed: Fixed seed for reproducibility (integer, None = random)
        """
        self.api_key = api_key
        self.MAX_RETRIES = max_retries
        self.INITIAL_BACKOFF = initial_backoff
        
        # Determinism parameters (can be overridden via constructor or env vars)
        self.temperature = temperature if temperature is not None else self.TEMPERATURE
        self.top_p = top_p if top_p is not None else self.TOP_P
        self.top_k = top_k if top_k is not None else self.TOP_K
        self.seed = seed if seed is not None else self.SEED

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
    def _make_api_call(self, user_content: str, urls: Optional[List[str]] = None):
        """
        Make a single API call to the provider.

        Args:
            user_content: User message content
            urls: Optional list of URLs to fetch using URL context tool

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

    @abstractmethod
    def _clean_filename_with_llm(self, filename: str) -> str:
        """
        Clean and normalize filename using LLM to extract core artist-title format.
        
        This removes extra metadata like country tags, years in parentheses, 
        genre tags, etc., and normalizes the format to "Artist - Title".

        Args:
            filename: Raw filename to clean

        Returns:
            Cleaned filename in normalized format (e.g., "Artist - Title")
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

    def _make_api_call_with_retry(self, user_content: str, urls: Optional[List[str]] = None):
        """
        Make API call with retry logic and rate limiting.

        Args:
            user_content: User message content
            urls: Optional list of URLs to fetch using URL context tool

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
                response = self._make_api_call(user_content, urls)

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

            # Clean and normalize filename using LLM to extract core artist-title
            # This ensures similar filenames produce consistent results
            try:
                cleaned_filename = self._clean_filename_with_llm(filename_without_ext)
                logger.info(
                    f"Filename cleaned: '{filename_without_ext}' -> '{cleaned_filename}'"
                )
                filename_without_ext = cleaned_filename
            except Exception as e:
                logger.warning(
                    f"Failed to clean filename with LLM: {e}. Using original filename."
                )
                # Continue with original filename if cleaning fails

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
            filename_content, extracted_urls = self._build_filename_message(
                filename_without_ext, id3_tags
            )
            # Log URLs if found
            if extracted_urls:
                logger.info(
                    f"Found {len(extracted_urls)} URL(s) in ID3 description. Using URL context tool to fetch content: {extracted_urls}"
                )

            # Handle rate limiting and retries
            response = self._make_api_call_with_retry(filename_content, extracted_urls)

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
                "vocals": None,
                "atmosphere": [],
            }

        # Normalize context (optional field)
        if normalized["context"] and not isinstance(normalized["context"], dict):
            normalized["context"] = None

     
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
        url_pattern_without_protocol = r'(?:discogs|bandcamp|tidal)\.(?:com|org)/[^\s<>"{}|\\^`\[\]]+'
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
    ) -> Tuple[str, List[str]]:
        """
        Build the dynamic filename message (only part that changes per request).

        Args:
            filename: Audio filename without extension
            id3_tags: Optional ID3 tags dictionary for more accurate metadata

        Returns:
            Tuple of (formatted prompt string, list of extracted URLs)
        """
        # Use "artist - title" format if both are available in id3_tags
        display_filename = filename

        base_message = f'''Extract and enrich music metadata from this track: "{display_filename}"'''

        # Extract URLs from multiple ID3 tag fields: description, url, and purl
        extracted_urls = []
        if id3_tags:
            # Extract URLs from description field
            description = id3_tags.get("description", "")
            if description:
                urls_from_description = self._extract_urls_from_text(description)
                extracted_urls.extend(urls_from_description)
            
            # Extract URLs from url field (if present)
            # The url field might be a direct URL string or contain URLs in text
            url_field = id3_tags.get("url", "")
            if url_field:
                url_str = str(url_field).strip()
                # Check if it's already a valid URL (starts with http:// or https://)
                if url_str.startswith(("http://", "https://")):
                    # It's already a valid URL, add it directly
                    extracted_urls.append(url_str)
                else:
                    # Extract URLs from the text (might contain multiple URLs or be embedded in text)
                    urls_from_url = self._extract_urls_from_text(url_str)
                    extracted_urls.extend(urls_from_url)
            
            # Extract URLs from purl field (ID3v2.4+ URL frame)
            # purl is typically a direct URL, but we'll handle both cases
            purl_field = id3_tags.get("purl", "")
            if purl_field:
                purl_str = str(purl_field).strip()
                # Check if it's already a valid URL
                if purl_str.startswith(("http://", "https://")):
                    extracted_urls.append(purl_str)
                else:
                    urls_from_purl = self._extract_urls_from_text(purl_str)
                    extracted_urls.extend(urls_from_purl)
            
            # Remove duplicates while preserving order
            seen = set()
            extracted_urls = [
                url for url in extracted_urls 
                if url not in seen and not seen.add(url)
            ]

        # If URLs are found, they MUST be explicitly mentioned in the prompt
        # for Gemini's URL context tool to detect and fetch them
        if extracted_urls:
            base_message += "\n\nCRITICAL: Extract metadata from these authoritative source URLs (they will be automatically fetched):"
            for i, url in enumerate(extracted_urls, 1):
                base_message += f"\n{i}. {url}"
            base_message += "\n\nThese URLs contain the PRIMARY and HIGHEST PRIORITY metadata. Use information from these fetched pages to override any conflicting data from other sources."

        # Add ID3 tag information if available
        artist = display_filename.split(" - ")[0]
        title = display_filename.split(" - ")[1]
        if id3_tags:
            id3_info_parts = []
            if artist:
                id3_info_parts.append(f"Artist: {artist}")
            if title:
                id3_info_parts.append(f"Title: {title}")
            if id3_tags.get("album"):
                id3_info_parts.append(f"Album: {id3_tags.get('album')}")
            if id3_tags.get("genre"):
                id3_info_parts.append(f"Genre: {id3_tags.get('genre')}")
         
            if id3_info_parts:
                # More concise ID3 tag format
                id3_section = "\n\nID3 tags: " + " | ".join(id3_info_parts)
                base_message += id3_section

            if not extracted_urls:
                base_message += "\n\nUse ID3 tags as PRIMARY source for artist, title, year, genre. Enrich with music databases."

        base_message += "\n\nReturn ONLY a JSON object with these exact fields: artist, title, mix, year, country, label, genre, style, audioFeatures (with vocals, atmosphere), context (with background, impact), tags."
        base_message += "\nDo NOT include any other fields like album, release_year, track_number, format, duration, albumArt, credits, availability, etc."

        return base_message, extracted_urls

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
                "vocals": None,
                "atmosphere": [],
            },
            "context": None,
            "tags": [],
        }
