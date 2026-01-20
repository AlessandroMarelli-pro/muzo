"""
Gemini-based metadata extraction service for extracting music metadata from filenames.

This service uses Google's Gemini API with structured outputs to extract comprehensive metadata
from audio filenames, including artist, title, genre, style, credits, and more.
"""

import json
import os
from typing import Any, Dict, List, Optional

from loguru import logger

try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning(
        "Google GenAI SDK not installed. Install with: pip install google-genai"
    )

from src.services.base_metadata_extractor import BaseMetadataExtractor


class GeminiMetadataExtractor(BaseMetadataExtractor):
    """
    Gemini-based metadata extraction service that extracts comprehensive
    music metadata from filenames using Gemini's structured outputs with schema enforcement.
    """

    # Model configuration - using Gemini 2.5 Flash for speed and knowledge
    # Can be upgraded to gemini-3-flash for better results (industry standard for metadata resolution)
    # Set GEMINI_MODEL environment variable to override (e.g., "gemini-3-flash")
    MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Response schema matching the expected output structure
    # Using Gemini's schema format (similar to JSON Schema but with specific types)
    # Updated with audioFeatures and context for detailed insights
    RESPONSE_SCHEMA = {
        "type": "OBJECT",
        "properties": {
            "artist": {"type": "STRING"},
            "title": {"type": "STRING"},
            "mix": {"type": "STRING", "nullable": True},
            "year": {"type": "INTEGER", "nullable": True},
            "country": {"type": "STRING", "nullable": True},
            "label": {"type": "STRING", "nullable": True},
            "genre": {"type": "ARRAY", "items": {"type": "STRING"}},
            "style": {"type": "ARRAY", "items": {"type": "STRING"}},
            "audioFeatures": {
                "type": "OBJECT",
                "nullable": True,
                "properties": {
                    "bpm": {
                        "type": "INTEGER",
                        "nullable": True,
                        "description": "Beats per minute",
                    },
                    "key": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "Musical key (e.g., C Minor, 8A)",
                    },
                    "vocals": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "Description of vocals (e.g., 'Turkish female vocals', 'Instrumental', 'Chopped samples')",
                    },
                    "atmosphere": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Vibe keywords (e.g., 'Hypnotic', 'Sparkly', 'Industrial')",
                    },
                },
            },
            "context": {
                "type": "OBJECT",
                "nullable": True,
                "properties": {
                    "background": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "Historical or production context (e.g., 'Produced during lockdown', 'Debut EP on Public Possession')",
                    },
                    "impact": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "Cultural impact or chart success (e.g., 'Established her residency at Panorama Bar')",
                    },
                },
            },
            "description": {
                "type": "STRING",
                "nullable": True,
                "description": "A 2-3 sentence summary of the track's sound and meaning.",
            },
            "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["artist", "title", "genre", "style", "audioFeatures"],
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini metadata extractor service.

        Args:
            api_key: Gemini API key. If not provided, will use GEMINI_API_KEY env var.
        """
        logger.info("GeminiMetadataExtractor initializing")

        if not GEMINI_AVAILABLE:
            logger.error(
                "Google GenAI SDK not available. Install with: pip install google-genai"
            )
            api_key = None
        else:
            # Get API key from parameter or environment
            api_key = api_key or os.getenv("GEMINI_API_KEY")

        # Rate limiting configuration
        max_requests_per_minute = int(os.getenv("GEMINI_MAX_REQUESTS_PER_MINUTE", "60"))
        max_requests_per_day = (
            int(os.getenv("GEMINI_MAX_REQUESTS_PER_DAY"))
            if os.getenv("GEMINI_MAX_REQUESTS_PER_DAY")
            else None
        )
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
        initial_backoff = float(os.getenv("GEMINI_INITIAL_BACKOFF", "1.0"))

        # Initialize base class
        super().__init__(
            api_key=api_key,
            max_requests_per_minute=max_requests_per_minute,
            max_requests_per_day=max_requests_per_day,
            max_retries=max_retries,
            initial_backoff=initial_backoff,
        )

    def _initialize_client(self):
        """Initialize the Gemini API client."""
        if not GEMINI_AVAILABLE:
            return None
        if not self.api_key:
            logger.warning(
                "Gemini API key not found. Set GEMINI_API_KEY environment variable."
            )
            return None
        try:
            client = genai.Client(api_key=self.api_key)
            logger.info("Gemini client initialized successfully")
            return client
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            return None

    def _is_available(self) -> bool:
        """Check if the service is available (API key configured and SDK available)."""
        return GEMINI_AVAILABLE and self.client is not None

    def _make_api_call(self, user_content: str):
        """
        Make a single API call to Gemini.

        Args:
            user_content: User message content

        Returns:
            Gemini API response

        Raises:
            Exception: If API call fails
        """
        # Build system instruction
        system_instruction = "\n".join(self.INSTRUCTIONS)
        print(system_instruction)
        print(user_content)
        # Make API call with structured outputs using Gemini's native SDK
        response = self.client.models.generate_content(
            model=self.MODEL,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=self.RESPONSE_SCHEMA,
                temperature=self.TEMPERATURE,
            ),
        )
        return response

    def _parse_response(self, response) -> Dict[str, Any]:
        """
        Parse the Gemini API response and extract metadata.

        Args:
            response: Gemini API response object

        Returns:
            Parsed metadata dictionary

        Raises:
            Exception: If parsing fails
        """
        # Parse response - Gemini returns parsed object directly when using response_schema
        if hasattr(response, "parsed") and response.parsed:
            metadata = response.parsed
            logger.info("Successfully extracted metadata using Gemini")
            return metadata
        elif hasattr(response, "text") and response.text:
            # Fallback: parse JSON from text if parsed not available
            try:
                cleaned_content = self._clean_json_response(response.text)
                metadata = json.loads(cleaned_content)
                return metadata
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                raise
        else:
            logger.warning("Empty response from Gemini")
            raise ValueError("Empty response from Gemini")

    def _build_discogs_query_prompt(
        self, artist: str, title: str, mix: Optional[str], id3_tags: Optional[Dict[str, Any]]
    ) -> str:
        """
        Build prompt for Discogs query generation.

        Args:
            artist: Artist name
            title: Title
            mix: Optional mix name
            id3_tags: Optional ID3 tags

        Returns:
            Prompt string for query generation
        """
        prompt_parts = [
            "You are a Discogs search expert. Generate optimized search queries for finding a specific release.",
            "",
            "Input:",
            f"- Artist: {artist}",
            f"- Title: {title}",
        ]

        if mix:
            prompt_parts.append(f"- Mix/Remix: {mix}")

        if id3_tags:
            year = id3_tags.get("year")
            label = id3_tags.get("label") or id3_tags.get("publisher")
            if year:
                prompt_parts.append(f"- Year: {year}")
            if label:
                prompt_parts.append(f"- Label: {label}")

        prompt_parts.extend(
            [
                "",
                "Generate 2-3 optimized Discogs search queries that will help find this release.",
                "Use Discogs query syntax:",
                '- artist:"name" for exact artist match',
                '- release_title:"title" for exact title match',
                "- year:YYYY for year filter",
                '- label:"name" for label filter',
                "",
                "Prioritize queries that:",
                "1. Use exact matches with quotes",
                "2. Include year if available",
                "3. Include label if available",
                "4. Try variations (with/without mix, different formats)",
            ]
        )

        return "\n".join(prompt_parts)

    def _build_discogs_selection_prompt(
        self, results: List[Dict[str, Any]], input_data: Dict[str, Any]
    ) -> str:
        """
        Build prompt for Discogs result selection.

        Args:
            results: List of Discogs release results
            input_data: Original input data (artist, title, etc.)

        Returns:
            Prompt string for result selection
        """
        prompt_parts = [
            "You are a music metadata expert. Select the best matching release from Discogs results.",
            "",
            "Original Input:",
            f"- Artist: {input_data.get('artist', '')}",
            f"- Title: {input_data.get('title', '')}",
        ]

        if input_data.get("mix"):
            prompt_parts.append(f"- Mix: {input_data.get('mix')}")
        if input_data.get("year"):
            prompt_parts.append(f"- Year: {input_data.get('year')}")
        if input_data.get("label"):
            prompt_parts.append(f"- Label: {input_data.get('label')}")

        prompt_parts.extend(
            [
                "",
                "Discogs Results:",
            ]
        )

        for i, result in enumerate(results):
            prompt_parts.append(f"\n[{i}] {result.get('title', 'Unknown')}")
            prompt_parts.append(f"    Artists: {', '.join(result.get('artists', []))}")
            if result.get("year"):
                prompt_parts.append(f"    Year: {result.get('year')}")
            if result.get("label"):
                prompt_parts.append(f"    Label: {result.get('label')}")
            if result.get("genres"):
                prompt_parts.append(f"    Genres: {', '.join(result.get('genres', []))}")

        prompt_parts.extend(
            [
                "",
                "Select the best matching release by index (0-based).",
                "Consider:",
                "1. Artist name match (exact > partial > none)",
                "2. Title match (exact > partial > none)",
                "3. Year match if available",
                "4. Label match if available",
                "5. Return null if no good match (confidence < 0.5)",
                "",
                "Return the index of the best match and a confidence score (0.0-1.0).",
            ]
        )

        return "\n".join(prompt_parts)

    def _build_discogs_schema_mapping_prompt(
        self, release_data: Dict[str, Any], artist: str, title: str, mix: Optional[str]
    ) -> str:
        """
        Build prompt for mapping Discogs release data to metadata schema.

        Args:
            release_data: Full Discogs release details
            artist: Original artist name
            title: Original title
            mix: Optional mix name

        Returns:
            Prompt string for schema mapping
        """
        prompt_parts = [
            "You are a music metadata expert. Map Discogs release data to the required metadata schema.",
            "",
            "Original Input:",
            f"- Artist: {artist}",
            f"- Title: {title}",
        ]
        if mix:
            prompt_parts.append(f"- Mix: {mix}")

        prompt_parts.extend(
            [
                "",
                "Discogs Release Data:",
                json.dumps(release_data, indent=2),
                "",
                "Map this data to the metadata schema. Requirements:",
                "1. Use artist and title from original input (not Discogs)",
                "2. Extract genres and styles from Discogs",
                "3. Extract year, country, label from Discogs",
                "4. For audioFeatures:",
                "   - BPM: Use if available in tracklist or infer from genre/style if confident",
                "   - Key: Use if available or infer if confident",
                "   - Vocals: Infer from tracklist credits or genre knowledge",
                "   - Atmosphere: Generate vibe keywords based on genre/style",
                "5. For context:",
                "   - Background: Use release notes or infer from year/label/genre",
                "   - Impact: Infer from genre/style knowledge if relevant",
                "6. Description: Write 2-3 sentences about the track's sound",
                "7. Tags: Generate relevant tags from genres, styles, and metadata",
                "",
                "Only include fields you're confident about. Use null for uncertain values.",
            ]
        )

        return "\n".join(prompt_parts)
