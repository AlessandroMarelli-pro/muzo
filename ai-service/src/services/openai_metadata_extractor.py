"""
OpenAI-based metadata extraction service for extracting music metadata from filenames.

This service uses OpenAI's structured outputs to extract comprehensive metadata
from audio filenames, including artist, title, genre, style, credits, and more.
"""

import json
import os
import re
from typing import Any, Dict, Optional

from jsonschema import validate
from jsonschema.exceptions import ValidationError
from loguru import logger
from openai import OpenAI

from src.utils.performance_optimizer import monitor_performance


class OpenAIMetadataExtractor:
    """
    OpenAI-based metadata extraction service that extracts comprehensive
    music metadata from filenames using OpenAI's structured outputs.
    """

    # Agent configuration matching TypeScript config
    MODEL = "gpt-4o-mini"
    TEMPERATURE = 0.1  # Strict temperature: 0-0.2 range for deterministic output

    INSTRUCTIONS = [
        "You are a music metadata resolution agent.",
        "Your task is NOT limited to parsing the filename.",
        "You MUST resolve and enrich metadata using your general music knowledge",
        "and well-known public music databases (e.g. Discogs, MusicBrainz, Spotify-style metadata).",
        "",
        "REQUIRED OUTPUT SCHEMA - You MUST return ONLY these exact fields:",
        "- artist (string, required)",
        "- title (string, required)",
        "- mix (string or null)",
        "- year (string, integer, or null) - use 'year', NOT 'release_year'",
        "- country (string or null)",
        "- label (string or null)",
        "- format (string or null)",
        "- genre (array of strings, required)",
        "- style (array of strings, required)",
        "- duration (string or null)",
        "- credits (object with producer, writers, vocals - or null)",
        "- description (string or null)",
        "- availability (object with streaming, physical arrays - or null)",
        "- tags (array of strings, required)",
        "",
        "CRITICAL: Do NOT include any other fields like 'album', 'release_year', 'track_number', etc.",
        "The schema has additionalProperties: false - extra fields will cause validation errors.",
        "",
        "RULES:",
        "- Use the filename only as an identifier (artist, title, mix).",
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

    def _is_available(self) -> bool:
        """Check if the service is available (API key configured)."""
        return self.client is not None

    @monitor_performance("openai_metadata_extraction")
    def extract_metadata_from_filename(self, filename: str) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from a filename using OpenAI.

        Args:
            filename: Audio filename (with or without extension)

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

            # Build filename message (example is commented out for token savings)
            filename_content = self._build_filename_message(filename_without_ext)

            # Make API call with structured outputs
            # Message structure optimized for token efficiency:
            # - System message: static instructions
            # - Example message: static few-shot example
            # - Filename message: dynamic filename (only part that changes)
            # Note: OpenAI has automatic prompt caching for repeated prefixes,
            # but explicit cache_control is not supported in the Python SDK
            response = self.client.chat.completions.create(
                model=self.MODEL,
                temperature=self.TEMPERATURE,
                messages=[
                    {
                        "role": "system",
                        "content": "\n".join(self.INSTRUCTIONS),
                    },
                    # {
                    #    "role": "user",
                    #    "content": example_content,
                    # },
                    {
                        "role": "user",
                        "content": filename_content,
                    },
                ],
                response_format={"type": "json_object"},
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

    def _build_filename_message(self, filename: str) -> str:
        """
        Build the dynamic filename message (only part that changes per request).

        Args:
            filename: Audio filename without extension

        Returns:
            Formatted prompt string with filename
        """
        return f'''Extract and enrich music metadata from this filename: "{filename}"

Return ONLY a JSON object with these exact fields: artist, title, mix, year, country, label, format, genre, style, duration, credits, description, availability, tags.
Do NOT include any other fields like album, release_year, track_number, etc.'''

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
            "credits": None,
            "description": None,
            "availability": None,
            "tags": [],
        }
