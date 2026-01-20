"""
Artist and title extractor service.

Extracts and normalizes artist and title from ID3 tags, LLM filename cleaning, 
filename parsing, or simple fallback.
"""

import os
import re
from typing import TYPE_CHECKING, Any, Dict, Optional

from loguru import logger

from src.services.simple_filename_parser import SimpleFilenameParser
from src.services.simple_metadata_extractor import SimpleMetadataExtractor

if TYPE_CHECKING:
    from src.services.base_metadata_extractor import BaseMetadataExtractor


class ArtistTitleExtractor:
    """
    Extracts and normalizes artist and title from multiple sources.

    Priority order:
    1. ID3 tags (highest confidence)
    2. LLM filename cleaning (high confidence, focused extraction)
    3. Filename parsing (medium confidence)
    4. Simple fallback (low confidence)
    """

    def __init__(self, llm_extractor: Optional["BaseMetadataExtractor"] = None):
        """
        Initialize the artist/title extractor.

        Args:
            llm_extractor: Optional LLM-based extractor for filename cleaning
        """
        self.filename_parser = SimpleFilenameParser()
        self.id3_extractor = SimpleMetadataExtractor(self.filename_parser)
        self.llm_extractor = llm_extractor

    def extract_and_normalize(
        self, filename: str, file_path: Optional[str] = None, id3_tags: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extract and normalize artist and title from filename and/or ID3 tags.

        Args:
            filename: Audio filename (with or without extension)
            file_path: Optional path to audio file for ID3 extraction
            id3_tags: Optional pre-extracted ID3 tags

        Returns:
            Dictionary with keys: artist, title, mix, confidence, source
        """
        # Extract basename without extension
        basename = os.path.basename(filename)
        filename_without_ext = os.path.splitext(basename)[0]

        # Try ID3 tags first (highest priority)
        if id3_tags is None and file_path:
            try:
                id3_result = self.id3_extractor.extract_id3_tags(
                    file_path, filename_without_ext
                )
                id3_tags = id3_result.get("id3_tags", {})
            except Exception as e:
                logger.warning(f"Failed to extract ID3 tags: {e}")
                id3_tags = {}

        if id3_tags:
            artist = id3_tags.get("artist", "").strip()
            title = id3_tags.get("title", "").strip()

            if artist and title:
                normalized = self._normalize_artist_title(artist, title)
                normalized["confidence"] = 0.95
                normalized["source"] = "id3"
                logger.info(
                    f"Extracted from ID3: {normalized['artist']} - {normalized['title']}"
                )
                return normalized

        # Try LLM filename cleaning (focused extraction - artist/title only)
        if self.llm_extractor and self.llm_extractor._is_available():
            try:
                llm_result = self._extract_artist_title_with_llm(
                    filename_without_ext, id3_tags
                )
                if llm_result and llm_result.get("artist") and llm_result.get("title"):
                    normalized = self._normalize_artist_title(
                        llm_result["artist"], llm_result["title"]
                    )
                    mix = llm_result.get("mix")
                    if mix:
                        normalized["mix"] = self._apply_cleanup(str(mix))
                    normalized["confidence"] = 0.85
                    normalized["source"] = "llm_filename_cleaning"
                    logger.info(
                        f"Extracted from LLM filename cleaning: {normalized['artist']} - {normalized['title']}"
                    )
                    return normalized
            except Exception as e:
                logger.warning(f"LLM filename cleaning failed: {e}")

        # Try filename parsing
        try:
            parsed = self._parse_filename(filename_without_ext)
            if parsed and parsed.get("artist") and parsed.get("title"):
                normalized = self._normalize_artist_title(
                    parsed["artist"], parsed["title"]
                )
                # Extract mix from parsed data if available
                mix = parsed.get("subtitle", "").strip() or None
                if mix:
                    normalized["mix"] = self._apply_cleanup(mix)
                normalized["confidence"] = 0.75
                normalized["source"] = "filename_parsing"
                logger.info(
                    f"Extracted from filename parsing: {normalized['artist']} - {normalized['title']}"
                )
                return normalized
        except Exception as e:
            logger.warning(f"Filename parsing failed: {e}")

        # Last resort: simple fallback
        normalized = self._normalize_artist_title(
            filename_without_ext, filename_without_ext
        )
        normalized["confidence"] = 0.3
        normalized["source"] = "fallback"
        logger.warning(
            f"Using fallback extraction: {normalized['artist']} - {normalized['title']}"
        )
        return normalized

    def _extract_artist_title_with_llm(
        self, filename: str, id3_tags: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Use LLM to extract and clean artist/title from filename (reduced demand).

        This is a focused extraction that only asks for artist, title, and mix,
        making it faster and cheaper than full metadata extraction.

        Args:
            filename: Filename without extension
            id3_tags: Optional ID3 tags for context

        Returns:
            Dictionary with artist, title, mix, or None if extraction fails
        """
        try:
            # Build simplified prompt focused only on artist/title extraction
            prompt = self._build_artist_title_prompt(filename, id3_tags)

            # Make simplified API call (provider-specific)
            parsed = self._make_simplified_llm_call(prompt)

            if not parsed:
                return None

            # Extract only artist, title, mix
            artist = parsed.get("artist", "").strip()
            title = parsed.get("title", "").strip()
            mix = parsed.get("mix")

            if artist and title:
                return {
                    "artist": artist,
                    "title": title,
                    "mix": mix,
                }

            return None

        except Exception as e:
            logger.debug(f"LLM artist/title extraction error: {e}")
            return None

    def _make_simplified_llm_call(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Make a simplified LLM API call with minimal schema (artist, title, mix only).

        Args:
            prompt: User prompt

        Returns:
            Parsed response with artist, title, mix, or None if failed
        """
        # Check if it's Gemini extractor
        if hasattr(self.llm_extractor, "client") and hasattr(
            self.llm_extractor, "MODEL"
        ):
            try:
                # Try Gemini-specific simplified call
                return self._make_gemini_simplified_call(prompt)
            except Exception as e:
                logger.debug(f"Gemini simplified call failed, trying fallback: {e}")

        # Fallback: use full extractor but extract only what we need
        try:
            response = self.llm_extractor._make_api_call_with_retry(prompt)
            parsed = self.llm_extractor._parse_response(response)
            return parsed
        except Exception as e:
            logger.debug(f"Fallback LLM call failed: {e}")
            return None

    def _make_gemini_simplified_call(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Make a simplified Gemini API call with minimal schema.

        Args:
            prompt: User prompt

        Returns:
            Parsed response or None
        """
        try:
            from google.genai import types

            # Simplified schema - only artist, title, mix
            simplified_schema = {
                "type": "OBJECT",
                "properties": {
                    "artist": {"type": "STRING"},
                    "title": {"type": "STRING"},
                    "mix": {"type": "STRING", "nullable": True},
                },
                "required": ["artist", "title"],
            }

            # Simplified system instruction
            system_instruction = """Extract ONLY the artist name and track title from music filenames.
Remove file extensions, extra metadata, years, labels, or other information.
Identify the artist name and track title, and optionally a remix/mix name.
Return clean, normalized text with proper capitalization."""

            # Make API call with simplified schema
            response = self.llm_extractor.client.models.generate_content(
                model=self.llm_extractor.MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=simplified_schema,
                    temperature=0.1,  # Low temperature for consistency
                ),
            )

            # Parse response
            if hasattr(response, "parsed") and response.parsed:
                return response.parsed
            elif hasattr(response, "text") and response.text:
                import json

                cleaned = self.llm_extractor._clean_json_response(response.text)
                return json.loads(cleaned)

            return None

        except Exception as e:
            logger.debug(f"Gemini simplified call error: {e}")
            return None

    def _build_artist_title_prompt(
        self, filename: str, id3_tags: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build a simplified prompt focused only on extracting artist and title.

        Args:
            filename: Filename without extension
            id3_tags: Optional ID3 tags for context

        Returns:
            Simplified prompt string
        """
        prompt = f'''Extract ONLY the artist and title from this music filename: "{filename}"

Your task is to identify and clean the artist name and track title from the filename.
- Remove file extensions, extra metadata, years, labels, or other information
- Identify the artist name (may be at the beginning, separated by " - ", " – ", or other delimiters)
- Identify the track title (usually after the artist)
- If there's a remix/mix indicator (e.g., "Remix", "Mix", "Edit"), extract it as "mix"
- Normalize the text (proper capitalization, remove extra spaces)

Return ONLY a JSON object with these fields:
- artist: The artist name (cleaned and normalized)
- title: The track title (cleaned and normalized)
- mix: Optional remix/mix name if present (e.g., "Original Mix", "Club Mix", "Remix"), or null
'''

        # Add ID3 context if available (but keep it minimal)
        if id3_tags:
            id3_hints = []
            if id3_tags.get("artist"):
                id3_hints.append(f"ID3 artist: {id3_tags.get('artist')}")
            if id3_tags.get("title"):
                id3_hints.append(f"ID3 title: {id3_tags.get('title')}")

            if id3_hints:
                prompt += "\n\nAdditional context from ID3 tags:\n"
                prompt += "\n".join(id3_hints)
                prompt += "\n\nUse ID3 tags as hints, but prioritize extracting from the filename if it's clearer."

        prompt += "\n\nReturn ONLY valid JSON with artist, title, and mix fields. No explanations."

        return prompt

    def _parse_filename(self, filename: str) -> Optional[Dict[str, str]]:
        """
        Parse filename to extract artist and title.

        Args:
            filename: Filename without extension

        Returns:
            Dictionary with artist, title, subtitle, or None if parsing fails
        """
        try:
            return self.filename_parser.parse_filename_for_metadata(filename)
        except Exception as e:
            logger.debug(f"Filename parsing error: {e}")
            return None

    def _normalize_artist_title(
        self, artist: str, title: str
    ) -> Dict[str, Any]:
        """
        Normalize artist and title text.

        Args:
            artist: Artist name
            title: Title name

        Returns:
            Dictionary with normalized artist, title, and mix
        """
        normalized_artist = self._apply_cleanup(artist)
        normalized_title = self._apply_cleanup(title)

        return {
            "artist": normalized_artist,
            "title": normalized_title,
            "mix": None,
        }

    def _apply_cleanup(self, text: str) -> str:
        """
        Apply text cleanup and normalization.

        Args:
            text: Text to clean

        Returns:
            Cleaned and normalized text
        """
        if not text:
            return ""

        # Remove leading/trailing whitespace
        cleaned = text.strip()

        # Normalize case (smart title case)
        cleaned = self._smart_title_case(cleaned)

        # Normalize whitespace (multiple spaces to single)
        cleaned = re.sub(r"\s+", " ", cleaned)

        # Remove trailing punctuation that might interfere
        cleaned = cleaned.rstrip(".,;:")

        return cleaned

    def _smart_title_case(self, text: str) -> str:
        """
        Apply smart title case normalization.

        Preserves common music industry conventions:
        - Keeps lowercase for common words (a, an, the, of, in, etc.)
        - Capitalizes first letter of each word
        - Preserves all-caps acronyms (e.g., "DJ", "MC", "UK")

        Args:
            text: Text to convert

        Returns:
            Title-cased text
        """
        if not text:
            return ""

        # Common lowercase words in titles
        lowercase_words = {
            "a", "an", "and", "as", "at", "but", "by", "for", "from", "in",
            "into", "nor", "of", "on", "or", "the", "to", "with", "vs", "feat",
            "featuring", "ft", "remix", "mix", "edit", "version"
        }

        # Split into words
        words = text.split()
        result = []

        for i, word in enumerate(words):
            # Check if word is all caps (likely acronym)
            if word.isupper() and len(word) > 1:
                result.append(word)
            # First or last word always capitalized
            elif i == 0 or i == len(words) - 1:
                result.append(word.capitalize())
            # Common words stay lowercase
            elif word.lower() in lowercase_words:
                result.append(word.lower())
            # Otherwise capitalize
            else:
                result.append(word.capitalize())

        return " ".join(result)
