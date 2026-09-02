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
        "2b. A leading single letter A-F, optionally followed by one digit "
        '("A", "B", "A1", "B2", "A2"), is a VINYL SIDE MARKER, not an artist. Drop it.',
        '   - "A - Circulation - Purple (Mix 1)" -> "Circulation - Purple (Mix 1)"',
        '   - "B1 - Mental Generation - Cafe Del Mar (Original Mix)" -> "Mental Generation - Cafe Del Mar (Original Mix)"',
        '   - "A4 - Hypnotised" -> "Unknown Artist - Hypnotised"',
        "   - Only that exact shape. Short real artist names are NOT markers:",
        '     "Sade - Smooth Operator", "Moby - Go", "404 - Der", "7FO - Healing Sword" all keep their artist.',
        "",
        "2c. Strip trailing label, catalog, genre and year junk from the title, "
        "but ALWAYS keep mix/remix credits:",
        '   - "Up To Date - Shadows (House) [BV3013]" -> "Up To Date - Shadows"',
        '   - "ABA Structure - Over Unity [2002] {Progressive House}" -> "ABA Structure - Over Unity"',
        '   - "Kolo - Track One (Steve Porter Remix) |Fade Records| 2000" -> "Kolo - Track One (Steve Porter Remix)"',
        '   - "Bullitt - Cried To Dream (Amazonian Vocal) 1996, VC Recordings - VCRTDJ 11" -> "Bullitt - Cried To Dream (Amazonian Vocal)"',
        '   - "Betina Bager & Brian O - Singing In The Rain (Love Baby) [Walther Remix] - 0401" -> "Betina Bager & Brian O - Singing In The Rain (Love Baby) [Walther Remix]"',
        '   - Keep "(Original Mix)", "(Vocal Mix)", "[Walther Remix]", "(Steve Porter Remix)".',
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
        '- "A - Circulation - Purple (Mix 1)" -> "Circulation - Purple (Mix 1)"',
        '- "Full Proof // Nasty Habit (Enrico & Ton TB Remix)" -> "Full Proof - Nasty Habit (Enrico & Ton TB Remix)"',
        '- "Nino - El Ritmo Del Tambor (Vocal Mix)(2002)" -> "Nino - El Ritmo Del Tambor (Vocal Mix)"',
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
        logger.debug("GeminiMetadataExtractor initializing")

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
            logger.debug("Gemini client initialized via Developer API")
            return client
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Developer API client: {e}")
            return None

    def _is_available(self) -> bool:
        """Check if the service is available (SDK installed and client built)."""
        return GEMINI_AVAILABLE and self.client is not None

    def _clean_filename_with_llm(
        self, filename: str, id3_hint: Optional[str] = None
    ) -> str:
        """
        Clean and normalize filename using LLM to extract core artist-title format.

        This removes extra metadata like country tags, years in parentheses,
        genre tags, etc., and normalizes the format to "Artist - Title".

        Args:
            filename: Raw filename to clean
            id3_hint: Optional "artist=...; title=..." string from the file's ID3
                tags; used only as a fallback when the filename doesn't already
                contain a clear "Artist - Title" -- never to override a good filename.

        Returns:
            Cleaned filename in normalized format (e.g., "Artist - Title")
        """
        if not self._is_available():
            return filename

        try:
            hint_line = (
                f"\nID3 tags for this file: {id3_hint}\n"
                "Use these ONLY if the filename doesn't already contain a clear "
                '"Artist - Title". If the filename is already well-formed, keep it '
                "as-is and ignore the ID3 tags (they may name a compiler/DJ, not "
                "the track artist).\n"
                if id3_hint
                else ""
            )
            cleaning_prompt = f"""Clean and normalize this music filename to extract only the core artist and title information.
{hint_line}

Remove:
- Country tags in brackets like [nigeria], [uk], [us]
- Years in parentheses like (1979), (1985)
- Genre/style tags like "soul", "funk", "electronic" when they appear as separate tags
- Extra metadata, labels, catalog numbers, or identifiers
- A leading vinyl side marker: a single letter A-F optionally followed by one
  digit ("A", "B1", "A2"). Only that exact shape -- short real artist names
  like "Sade", "Moby", "404", "7FO" are NOT markers and must be kept.

Keep:
- Artist name (normalize case to Title Case)
- Title name (normalize case to Title Case)
- Mix names in parentheses if they're part of the title (e.g., "Remix", "Extended Mix")

Format the output as: "Artist - Title" or "Artist - Title (Mix Name)"

Examples:
- "t-fire - say a prayer [nigeria] soul (1979)" -> "T-Fire - Say A Prayer"
- "T-Fire - Say A Prayer" -> "T-Fire - Say A Prayer"
- "artist - title (remix) [2020]" -> "Artist - Title (Remix)"
- "A - Circulation - Purple (Mix 1)" -> "Circulation - Purple (Mix 1)"
- "Up To Date - Shadows (House) [BV3013]" -> "Up To Date - Shadows"
- "Sade - Smooth Operator" -> "Sade - Smooth Operator"

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

            raw_text = response.text if hasattr(response, "text") else None
            logger.debug(
                f"LLM filename clean: model={self.cleaning_model} "
                f"in={filename!r} id3_hint={id3_hint!r} raw_response={raw_text!r}"
            )

            if raw_text:
                cleaned = raw_text.strip()
                cleaned = cleaned.strip('"').strip("'").strip()
                cleaned = cleaned.replace("```", "").strip()
                logger.debug(f"LLM filename clean: {filename!r} -> {cleaned!r}")
                return cleaned
            else:
                logger.warning(
                    f"Empty LLM response for filename {filename!r}, using original"
                )
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
        Every filename is sent to the LLM; ID3 artist/title (when present) are
        passed alongside as hints the model can use or correct.

        Args:
            filenames: List of raw filenames to clean
            file_paths: Optional list of file paths (same order as filenames) for ID3 tag extraction

        Returns:
            List of cleaned filenames in normalized format
        """
        if not self._is_available() or not filenames:
            return filenames

        try:
            # The LLM cleans every filename; pre_cleaned_filenames stays all-None
            # (kept so the response-mapping code below is unchanged) and each
            # filename gets an optional ID3 hint string.
            pre_cleaned_filenames = [None] * len(filenames)
            filenames_to_clean_with_llm = list(filenames)
            indices_to_clean = list(range(len(filenames)))
            id3_hints: List[Optional[str]] = [None] * len(filenames)

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
                        id3_hints[idx] = f"artist={id3_artist}; title={id3_title}"
                    elif id3_artist:
                        id3_hints[idx] = f"artist={id3_artist}"
                    elif id3_title:
                        id3_hints[idx] = f"title={id3_title}"

            def _format_entry(i: int, fn: str) -> str:
                hint = id3_hints[i]
                if hint:
                    return f"{i + 1}. {fn}  (ID3 tags: {hint})"
                return f"{i + 1}. {fn}"

            filenames_list = "\n".join(
                _format_entry(i, fn)
                for i, fn in enumerate(filenames_to_clean_with_llm)
            )
            user_content = f"""Filenames to clean:
{filenames_list}

Some entries include "ID3 tags". Use those ONLY as a fallback when the filename doesn't already contain a clear "Artist - Title". If a filename is already well-formed, keep it as-is and ignore its ID3 tags (they may name a compiler/DJ, not the track artist).

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

            raw_text = response.text if hasattr(response, "text") else None
            logger.debug(
                f"LLM batch filename clean: model={self.cleaning_model} "
                f"count={len(filenames_to_clean_with_llm)} raw_response={raw_text!r}"
            )

            def _individual_fallback():
                llm_cleaned = [
                    self._clean_filename_with_llm(fn, id3_hints[indices_to_clean[i]])
                    for i, fn in enumerate(filenames_to_clean_with_llm)
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
                                f"LLM batch cleaned {len(cleaned_list)} filenames"
                            )
                            for src, dst in zip(
                                filenames_to_clean_with_llm, cleaned_list
                            ):
                                logger.debug(
                                    f"LLM filename clean: {src!r} -> {dst!r}"
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
                self._clean_filename_with_llm(fn, id3_hints[indices_to_clean[i]])
                for i, fn in enumerate(filenames_to_clean_with_llm)
            ]
            final_cleaned = pre_cleaned_filenames.copy()
            for llm_idx, original_idx in enumerate(indices_to_clean):
                final_cleaned[original_idx] = llm_cleaned[llm_idx]
            return final_cleaned
