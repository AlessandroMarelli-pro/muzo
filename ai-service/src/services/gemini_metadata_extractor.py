"""
Gemini-based filename cleaning service.

This service uses Google's Gemini API (Developer API / AI Studio, plain API
key auth) to clean and normalize raw audio filenames into "Artist - Title"
format. The broader "extract and enrich metadata" pipeline (artist/title/
genre/style/tags resolution against public music databases, via Vertex AI
with grounding/URL-fetch) has been removed -- genre/style/tags are now sourced
from this filename-cleaning call plus the discogs-effnet classifiers
elsewhere in the ai-service pipeline instead.
"""

import os
from typing import List, Optional

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
    Gemini-based filename cleaning service. Despite the class name (kept for
    compatibility with create_metadata_extractor(provider="GEMINI")), this no
    longer extracts/enriches full track metadata -- only filename cleaning.
    """

    # Filename cleaning system instructions
    FILENAME_CLEANING_INSTRUCTIONS = [
        "Clean and normalize music filenames to extract only the core artist and title information.",
        "",
        "Remove from each:",
        "- Country tags in brackets like [nigeria], [uk], [us]",
        "- Years in parentheses like (1979), (1985)",
        '- Genre/style tags like "soul", "funk", "electronic" when they appear as separate tags',
        "- Extra metadata, labels, or identifiers",
        "",
        "Keep:",
        "- Artist name (normalize case to Title Case)",
        "- Title name (normalize case to Title Case)",
        '- Mix names in parentheses if they\'re part of the title (e.g., "Remix", "Extended Mix")',
        "",
        "IMPORTANT RULES:",
        '1. Always convert separators to " - " (dash with spaces). Handle these separators:',
        '   - " - " (already correct)',
        '   - ":" (colon) -> convert to " - "',
        '   - " – " (en dash) -> convert to " - "',
        '   - " — " (em dash) -> convert to " - "',
        '   - Any other separator -> convert to " - "',
        "",
        '2. If a filename only contains a title (no artist), use "Unknown Artist - Filename Title" format',
        "",
        '3. Format each output as: "Artist - Title" or "Artist - Title (Mix Name)"',
        "   - NEVER return just a title without an artist",
        '   - If artist cannot be determined, use "Unknown Artist"',
        "",
        "Examples:",
        '- "t-fire - say a prayer [nigeria] soul (1979)" -> "T-Fire - Say A Prayer"',
        '- "T-Fire - Say A Prayer" -> "T-Fire - Say A Prayer"',
        '- "artist - title (remix) [2020]" -> "Artist - Title (Remix)"',
        '- \'Jessie Allen Cooper: "Soft Wave"\' -> "Jessie Allen Cooper - Soft Wave"',
        '- "Artist: Title" -> "Artist - Title"',
        '- "Song Title.mp3" (no ID3 tags) -> "Unknown Artist - Song Title"',
    ]

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini filename-cleaning service.

        Auth is a plain Gemini Developer API key (GOOGLE_API_KEY, or
        GEMINI_API_KEY as a fallback name) -- no GCP project or ADC needed.

        Args:
            api_key: Optional explicit API key, overriding the environment
                variables. Kept for create_metadata_extractor(api_key=...)
                callers.
        """
        logger.info("GeminiMetadataExtractor initializing")

        if not GEMINI_AVAILABLE:
            logger.error(
                "Google GenAI SDK not available. Install with: pip install google-genai"
            )

        self._explicit_api_key = api_key

        # Model used for filename cleaning. "gemini-2.5-flash-lite" is rejected
        # (404) for new API-key users -- verified live this session --
        # "gemini-flash-lite-latest" is the Developer API's rolling alias to
        # whatever the current cheapest Flash-Lite model is, avoiding this same
        # deprecation churn going forward.
        self.cleaning_model = os.getenv(
            "GEMINI_CLEANING_MODEL", "gemini-flash-lite-latest"
        )

        max_requests_per_minute = int(os.getenv("GEMINI_MAX_REQUESTS_PER_MINUTE", "60"))
        max_requests_per_day = (
            int(os.getenv("GEMINI_MAX_REQUESTS_PER_DAY"))
            if os.getenv("GEMINI_MAX_REQUESTS_PER_DAY")
            else None
        )
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
        initial_backoff = float(os.getenv("GEMINI_INITIAL_BACKOFF", "1.0"))

        super().__init__(
            api_key=api_key,
            max_requests_per_minute=max_requests_per_minute,
            max_requests_per_day=max_requests_per_day,
            max_retries=max_retries,
            initial_backoff=initial_backoff,
        )

    def _initialize_client(self):
        """
        Initialize the Gemini Developer API client (plain API key auth).

        Returns None if the SDK isn't installed or no key is configured;
        callers degrade to returning filenames unchanged in that case.
        """
        if not GEMINI_AVAILABLE:
            return None

        api_key = (
            self._explicit_api_key
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GEMINI_API_KEY")
        )
        if not api_key:
            logger.warning(
                "GOOGLE_API_KEY (or GEMINI_API_KEY) is not set. Filename cleaning via "
                "the Gemini Developer API is disabled; filenames will be used as-is. "
                "Get a key at https://aistudio.google.com/apikey"
            )
            return None

        try:
            client = genai.Client(api_key=api_key)
            logger.info("Gemini client initialized via Developer API")
            return client
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Developer API client: {e}")
            return None

    def _is_available(self) -> bool:
        """Check if the service is available (SDK installed and client built)."""
        return GEMINI_AVAILABLE and self.client is not None

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

            # Fast, cheap, deterministic -- system_instruction is sent inline every
            # call rather than cached: Flash-Lite pricing makes the extra plumbing
            # not worth it for a prompt this short.
            config = types.GenerateContentConfig(
                temperature=0.0,
                system_instruction="\n".join(self.FILENAME_CLEANING_INSTRUCTIONS),
            )

            response = self.client.models.generate_content(
                model=self.cleaning_model,
                contents=cleaning_prompt,
                config=config,
            )

            if hasattr(response, "text") and response.text:
                cleaned = response.text.strip()
                cleaned = cleaned.strip('"').strip("'").strip()
                cleaned = cleaned.replace("```", "").strip()
                return cleaned
            else:
                logger.warning("Empty response from filename cleaning, using original")
                return filename

        except Exception as e:
            logger.warning(
                f"Failed to clean filename with LLM: {e}. Using original filename."
            )
            return filename

    def _clean_filenames_batch(
        self, filenames: List[str], file_paths: Optional[List[Optional[str]]] = None
    ) -> List[str]:
        """
        Clean and normalize multiple filenames in a single API call for efficiency.

        This batches filename cleaning to reduce API calls and improve throughput.
        Uses ID3 tags when available to enrich filenames that only contain titles.

        Args:
            filenames: List of raw filenames to clean
            file_paths: Optional list of file paths (same order as filenames) for ID3 tag extraction

        Returns:
            List of cleaned filenames in normalized format
        """
        if not self._is_available() or not filenames:
            return filenames

        try:
            # Extract ID3 tags for files that have paths
            pre_cleaned_filenames = []
            filenames_to_clean_with_llm = []
            indices_to_clean = []

            if file_paths and len(file_paths) == len(filenames):
                for idx, (filename, file_path) in enumerate(zip(filenames, file_paths)):
                    id3_tags = None
                    if file_path:
                        try:
                            id3_result = self.id3_extractor.extract_id3_tags(
                                file_path, ""
                            )
                            id3_tags = id3_result.get("id3_tags", {})
                        except Exception as e:
                            logger.debug(
                                f"Failed to extract ID3 tags from {file_path}: {e}"
                            )

                    id3_artist = id3_tags.get("artist") if id3_tags else None
                    id3_title = id3_tags.get("title") if id3_tags else None

                    if id3_artist and id3_title:
                        cleaned = f"{id3_artist} - {id3_title}"
                        pre_cleaned_filenames.append(cleaned)
                        logger.debug(
                            f"Using ID3 tags for '{filename}': '{id3_artist} - {id3_title}'"
                        )
                    elif id3_artist:
                        cleaned = f"{id3_artist} - {filename}"
                        pre_cleaned_filenames.append(cleaned)
                        logger.debug(
                            f"Using ID3 artist for '{filename}': '{id3_artist} - {filename}'"
                        )
                    elif id3_title:
                        cleaned = f"{filename} - {id3_title}"
                        pre_cleaned_filenames.append(cleaned)
                        logger.debug(
                            f"Using ID3 title for '{filename}': '{filename} - {id3_title}'"
                        )
                    else:
                        pre_cleaned_filenames.append(None)
                        filenames_to_clean_with_llm.append(filename)
                        indices_to_clean.append(idx)
            else:
                pre_cleaned_filenames = [None] * len(filenames)
                filenames_to_clean_with_llm = filenames
                indices_to_clean = list(range(len(filenames)))

            if not filenames_to_clean_with_llm:
                logger.info(
                    f"All {len(filenames)} filenames cleaned using ID3 tags, skipping LLM"
                )
                return pre_cleaned_filenames

            filenames_list = "\n".join(
                [f"{i + 1}. {fn}" for i, fn in enumerate(filenames_to_clean_with_llm)]
            )
            user_content = f"""Filenames to clean:
{filenames_list}

Return ONLY a JSON array of cleaned filenames in the same order, nothing else. Format: ["Artist - Title", "Artist2 - Title2", ...]"""

            config = types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                system_instruction="\n".join(self.FILENAME_CLEANING_INSTRUCTIONS),
            )

            response = self.client.models.generate_content(
                model=self.cleaning_model,
                contents=user_content,
                config=config,
            )

            def _individual_fallback():
                llm_cleaned = [
                    self._clean_filename_with_llm(fn)
                    for fn in filenames_to_clean_with_llm
                ]
                final_cleaned = pre_cleaned_filenames.copy()
                for llm_idx, original_idx in enumerate(indices_to_clean):
                    final_cleaned[original_idx] = llm_cleaned[llm_idx]
                return final_cleaned

            if hasattr(response, "text") and response.text:
                import json
                import re

                try:
                    response_text = response.text.strip()
                    response_text = re.sub(r"```(?:json)?\s*\n?", "", response_text)
                    response_text = re.sub(r"```\s*$", "", response_text)
                    response_text = response_text.strip()

                    array_match = re.search(r"\[.*\]", response_text, re.DOTALL)
                    if array_match:
                        response_text = array_match.group(0)

                    cleaned_list = json.loads(response_text)

                    if isinstance(cleaned_list, list):
                        cleaned_list = [
                            str(item).strip() if item else "" for item in cleaned_list
                        ]

                        if len(cleaned_list) == len(filenames_to_clean_with_llm):
                            logger.debug(
                                f"Successfully batch cleaned {len(cleaned_list)} filenames with LLM"
                            )
                            final_cleaned = pre_cleaned_filenames.copy()
                            for llm_idx, original_idx in enumerate(indices_to_clean):
                                final_cleaned[original_idx] = cleaned_list[llm_idx]
                            return final_cleaned
                        else:
                            logger.warning(
                                f"Batch cleaning returned {len(cleaned_list)} items, expected {len(filenames_to_clean_with_llm)}. "
                                "Falling back to individual cleaning."
                            )
                            return _individual_fallback()
                    else:
                        logger.warning(
                            f"Batch cleaning returned non-list type: {type(cleaned_list)}. "
                            "Falling back to individual cleaning."
                        )
                        return _individual_fallback()
                except json.JSONDecodeError as e:
                    logger.warning(
                        f"Failed to parse batch cleaning response as JSON: {e}. "
                        f"Response text: {response.text[:200] if hasattr(response, 'text') else 'N/A'}. "
                        "Falling back to individual cleaning."
                    )
                    return _individual_fallback()
            else:
                logger.warning(
                    "Empty response from batch filename cleaning, falling back to individual cleaning"
                )
                return _individual_fallback()

        except Exception as e:
            logger.warning(
                f"Failed to clean filenames in batch: {e}. Falling back to individual cleaning."
            )
            llm_cleaned = [
                self._clean_filename_with_llm(fn) for fn in filenames_to_clean_with_llm
            ]
            final_cleaned = pre_cleaned_filenames.copy()
            for llm_idx, original_idx in enumerate(indices_to_clean):
                final_cleaned[original_idx] = llm_cleaned[llm_idx]
            return final_cleaned
