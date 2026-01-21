"""
OpenAI-based metadata extraction service for extracting music metadata from filenames.

This service uses OpenAI's structured outputs to extract comprehensive metadata
from audio filenames, including artist, title, genre, style, credits, and more.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional

from jsonschema import validate
from jsonschema.exceptions import ValidationError
from loguru import logger
from openai import APIError, OpenAI, RateLimitError

from src.services.base_metadata_extractor import BaseMetadataExtractor


class OpenAIMetadataExtractor(BaseMetadataExtractor):
    """
    OpenAI-based metadata extraction service that extracts comprehensive
    music metadata from filenames using OpenAI's structured outputs.
    """

    # Agent configuration matching TypeScript config
    MODEL = "gpt-4o-mini"

    # Response schema matching the expected output structure
    # Production-ready: additionalProperties: false to reject extra keys
    # Updated with audioFeatures and context for detailed insights
    RESPONSE_SCHEMA = {
        "type": "object",
        "additionalProperties": False,  # Reject any properties not in schema
        "properties": {
            "artist": {"type": "string"},
            "title": {"type": "string"},
            "mix": {"type": ["string", "null"]},
            "year": {"type": ["integer", "null"]},
            "country": {"type": ["string", "null"]},
            "label": {"type": ["string", "null"]},
            "genre": {
                "type": "array",
                "items": {"type": "string"},
            },
            "style": {
                "type": "array",
                "items": {"type": "string"},
            },
            "audioFeatures": {
                "type": ["object", "null"],
                "additionalProperties": False,
                "properties": {
                    "bpm": {
                        "type": ["integer", "null"],
                        "description": "Beats per minute",
                    },
                    "key": {
                        "type": ["string", "null"],
                        "description": "Musical key (e.g., C Minor, 8A)",
                    },
                    "vocals": {
                        "type": ["string", "null"],
                        "description": "Description of vocals (e.g., 'Turkish female vocals', 'Instrumental', 'Chopped samples')",
                    },
                    "atmosphere": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Vibe keywords (e.g., 'Hypnotic', 'Sparkly', 'Industrial')",
                    },
                },
            },
            "context": {
                "type": ["object", "null"],
                "additionalProperties": False,
                "properties": {
                    "background": {
                        "type": ["string", "null"],
                        "description": "Historical or production context (e.g., 'Produced during lockdown', 'Debut EP on Public Possession')",
                    },
                    "impact": {
                        "type": ["string", "null"],
                        "description": "Cultural impact or chart success (e.g., 'Established her residency at Panorama Bar')",
                    },
                },
            },
            "description": {
                "type": ["string", "null"],
                "description": "A 2-3 sentence summary of the track's sound and meaning.",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["artist", "title", "genre", "style", "audioFeatures"],
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the OpenAI metadata extractor service.

        Args:
            api_key: OpenAI API key. If not provided, will use OPENAI_API_KEY env var.
        """
        logger.info("OpenAIMetadataExtractor initializing")

        # Get API key from parameter or environment
        api_key = api_key or os.getenv("OPENAI_API_KEY")

        # Rate limiting configuration
        max_requests_per_minute = int(os.getenv("OPENAI_MAX_REQUESTS_PER_MINUTE", "60"))
        max_requests_per_day = (
            int(os.getenv("OPENAI_MAX_REQUESTS_PER_DAY"))
            if os.getenv("OPENAI_MAX_REQUESTS_PER_DAY")
            else None
        )
        max_retries = int(os.getenv("OPENAI_MAX_RETRIES", "3"))
        initial_backoff = float(os.getenv("OPENAI_INITIAL_BACKOFF", "1.0"))

        # Determinism parameters from environment (for maximum consistency)
        temperature = (
            float(os.getenv("OPENAI_TEMPERATURE"))
            if os.getenv("OPENAI_TEMPERATURE")
            else None
        )
        top_p = (
            float(os.getenv("OPENAI_TOP_P"))
            if os.getenv("OPENAI_TOP_P")
            else None
        )
        seed = (
            int(os.getenv("OPENAI_SEED"))
            if os.getenv("OPENAI_SEED")
            else None
        )
        frequency_penalty = (
            float(os.getenv("OPENAI_FREQUENCY_PENALTY", "0.0"))
        )
        presence_penalty = (
            float(os.getenv("OPENAI_PRESENCE_PENALTY", "0.0"))
        )

        # Initialize base class
        super().__init__(
            api_key=api_key,
            max_requests_per_minute=max_requests_per_minute,
            max_requests_per_day=max_requests_per_day,
            max_retries=max_retries,
            initial_backoff=initial_backoff,
            temperature=temperature,
            top_p=top_p,
            seed=seed,
        )
        
        # OpenAI-specific parameters
        self.frequency_penalty = frequency_penalty
        self.presence_penalty = presence_penalty

    def _initialize_client(self):
        """Initialize the OpenAI API client."""
        if not self.api_key:
            logger.warning(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable."
            )
            return None
        else:
            client = OpenAI(api_key=self.api_key)
            logger.info("OpenAI client initialized successfully")
            return client

    def _is_available(self) -> bool:
        """Check if the service is available (API key configured)."""
        return self.client is not None

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
        if not self._is_available():
            # Fallback to original filename if service unavailable
            return filename

        try:
            cleaning_prompt = f"""Clean and normalize this music filename to extract only the core artist and title information.

Remove:
- Country tags in brackets like [nigeria], [uk], [us]
- Years in parentheses like (1979), (1985)
- Genre/style tags like "soul", "funk", "electronic" when they appear as separate tags
- Extra metadata, labels, or identifiers

Keep:
- Artist name (normalize case to Title Case)
- Title name (normalize case to Title Case)
- Mix names in parentheses if they're part of the title (e.g., "Remix", "Extended Mix")

Format the output as: "Artist - Title" or "Artist - Title (Mix Name)"

Examples:
- "t-fire - say a prayer [nigeria] soul (1979)" -> "T-Fire - Say A Prayer"
- "T-Fire - Say A Prayer" -> "T-Fire - Say A Prayer"
- "artist - title (remix) [2020]" -> "Artist - Title (Remix)"

Filename to clean: "{filename}"

Return ONLY the cleaned filename, nothing else. No explanations, no markdown, just the cleaned filename."""
            
            response = self.client.chat.completions.create(
                model=self.MODEL,
                temperature=0.0,  # Deterministic output
                messages=[
                    {
                        "role": "user",
                        "content": cleaning_prompt,
                    },
                ],
                max_tokens=100,  # Short response needed
                timeout=10.0,  # Fast timeout for this lightweight task
            )
            
            # Extract cleaned filename from response
            content = response.choices[0].message.content
            if content:
                cleaned = content.strip()
                # Remove any quotes if present
                cleaned = cleaned.strip('"').strip("'").strip()
                # Remove markdown code blocks if present
                cleaned = cleaned.replace("```", "").strip()
                return cleaned
            else:
                logger.warning("Empty response from filename cleaning, using original")
                return filename
                
        except Exception as e:
            logger.warning(f"Failed to clean filename with LLM: {e}. Using original filename.")
            return filename

    def _make_api_call(self, user_content: str, urls: Optional[List[str]] = None):
        """
        Make a single API call to OpenAI.

        Args:
            user_content: User message content
            urls: Optional list of URLs (not used by OpenAI, but kept for interface compatibility)

        Returns:
            OpenAI API response

        Raises:
            Exception: If API call fails
        """
        # Note: OpenAI doesn't have a URL context tool like Gemini,
        # so URLs are already included in the user_content prompt
        # Combine example and filename into single user message for efficiency
        combined_user_message = self._build_example_message() + "\n\n" + user_content
        
        # Configure for maximum determinism
        request_params = {
            "model": self.MODEL,
            "temperature": self.temperature,
            "messages": [
                {
                    "role": "system",
                    "content": "\n".join(self.INSTRUCTIONS),
                },
                {
                    "role": "user",
                    "content": combined_user_message,
                },
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 1500,  # Fixed limit for consistency
            "timeout": 30.0,
            "top_p": self.top_p,
            "frequency_penalty": self.frequency_penalty,
            "presence_penalty": self.presence_penalty,
        }
        
        # Add seed if provided (for reproducibility)
        if self.seed is not None:
            request_params["seed"] = self.seed
        
        response = self.client.chat.completions.create(**request_params)
        return response

    def _parse_response(self, response) -> Dict[str, Any]:
        """
        Parse the OpenAI API response and extract metadata.

        Args:
            response: OpenAI API response object

        Returns:
            Parsed metadata dictionary

        Raises:
            Exception: If parsing fails
        """
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
            raise ValueError("Empty response from OpenAI")

        # Clean content: remove markdown code blocks if present
        cleaned_content = self._clean_json_response(content)

        # Parse JSON response with strict validation
        try:
            metadata = json.loads(cleaned_content)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            logger.error(f"Response content: {cleaned_content[:500]}")
            raise

        # Filter out invalid fields before validation (fallback to prevent failures)
        valid_fields = set(self.RESPONSE_SCHEMA["properties"].keys())
        invalid_fields = set(metadata.keys()) - valid_fields
        if invalid_fields:
            logger.warning(
                f"OpenAI returned invalid fields: {invalid_fields}. "
                f"Filtering them out before validation."
            )
            metadata = {k: v for k, v in metadata.items() if k in valid_fields}

        # Normalize audioFeatures.atmosphere to array if it's a string
        if (
            metadata.get("audioFeatures")
            and isinstance(metadata["audioFeatures"], dict)
            and "atmosphere" in metadata["audioFeatures"]
        ):
            atmosphere = metadata["audioFeatures"]["atmosphere"]
            if isinstance(atmosphere, str):
                metadata["audioFeatures"]["atmosphere"] = [atmosphere]
                logger.debug(
                    f"Normalized atmosphere from string to array: {atmosphere}"
                )
            elif not isinstance(atmosphere, list):
                metadata["audioFeatures"]["atmosphere"] = (
                    [atmosphere] if atmosphere else []
                )

        # Runtime validation: reject non-JSON and additional properties
        try:
            validate(instance=metadata, schema=self.RESPONSE_SCHEMA)
        except ValidationError as e:
            logger.error(f"Schema validation failed after filtering: {e.message}")
            logger.error(f"Metadata keys after filtering: {list(metadata.keys())}")
            raise

        return metadata

    def _is_retryable_error(self, error_message: str) -> bool:
        """
        Determine if an error is retryable based on error message.
        Override to handle OpenAI-specific errors like RateLimitError.

        Args:
            error_message: Error message (lowercase)

        Returns:
            True if error is retryable, False otherwise
        """
        # Check for rate limit errors
        if "retry after" in error_message or "rate limit" in error_message:
            return True
        return super()._is_retryable_error(error_message)

    def _make_api_call_with_retry(self, user_content: str, urls: Optional[List[str]] = None):
        """
        Override to handle RateLimitError with custom retry logic.

        Args:
            user_content: User message content
            urls: Optional list of URLs (passed through to _make_api_call for compatibility)

        Returns:
            API response object
        """
        import time

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

                # Make API call
                response = self._make_api_call(user_content, urls)
                return response

            except RateLimitError as e:
                last_exception = e
                error_message = str(e).lower()

                # Extract retry-after from headers if available
                retry_after = self.INITIAL_BACKOFF * (2**attempt)

                # Check if error message contains retry-after information
                if "retry after" in error_message:
                    try:
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

            except (APIError, Exception) as e:
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

        if last_exception:
            raise last_exception
        raise Exception("Failed to make API call after retries")

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
