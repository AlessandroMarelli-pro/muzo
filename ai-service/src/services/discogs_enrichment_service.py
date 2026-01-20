"""
Discogs + LLM Hybrid Metadata Enrichment Service.

This service orchestrates the Discogs + LLM workflow for metadata enrichment:
1. Build optimized Discogs queries using LLM
2. Search Discogs API
3. Select best match using LLM
4. Get full release details
5. Map to metadata schema using LLM
"""

import json
import os
import re
from typing import Any, Dict, List, Optional

from loguru import logger

from src.config.metadata_config import MetadataConfig, MetadataMode
from src.services.third_parties.discogs import DiscogsConnector, DiscogsError

try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("Google GenAI SDK not installed. LLM features will be limited.")


class DiscogsEnrichmentService:
    """
    Service for enriching metadata using Discogs API with LLM assistance.

    Orchestrates the workflow:
    - LLM-assisted query building
    - Discogs API search
    - LLM-assisted result selection
    - Release details retrieval
    - LLM-assisted schema mapping
    """

    # Schema for query building response
    QUERY_BUILDING_SCHEMA = {
        "type": "OBJECT",
        "properties": {
            "queries": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "List of optimized Discogs search queries",
            },
            "reasoning": {
                "type": "STRING",
                "nullable": True,
                "description": "Brief explanation of query strategy",
            },
        },
        "required": ["queries"],
    }

    # Schema for result selection response
    SELECTION_SCHEMA = {
        "type": "OBJECT",
        "properties": {
            "selected_index": {
                "type": "INTEGER",
                "nullable": True,
                "description": "Index of best matching release (0-based, null if none match)",
            },
            "confidence": {
                "type": "NUMBER",
                "description": "Confidence score between 0.0 and 1.0",
            },
            "reasoning": {
                "type": "STRING",
                "nullable": True,
                "description": "Explanation of selection",
            },
        },
        "required": ["selected_index", "confidence"],
    }

    # Schema for metadata mapping (same as GeminiMetadataExtractor)
    METADATA_SCHEMA = {
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
                    "bpm": {"type": "INTEGER", "nullable": True},
                    "key": {"type": "STRING", "nullable": True},
                    "vocals": {"type": "STRING", "nullable": True},
                    "atmosphere": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
            },
            "context": {
                "type": "OBJECT",
                "nullable": True,
                "properties": {
                    "background": {"type": "STRING", "nullable": True},
                    "impact": {"type": "STRING", "nullable": True},
                },
            },
            "description": {"type": "STRING", "nullable": True},
            "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["artist", "title", "genre", "style", "audioFeatures"],
    }

    def __init__(
        self,
        discogs_connector: DiscogsConnector,
        gemini_client: Optional[Any] = None,
        config: Optional[MetadataConfig] = None,
    ):
        """
        Initialize Discogs enrichment service.

        Args:
            discogs_connector: DiscogsConnector instance
            gemini_client: Optional Gemini client (will create if not provided)
            config: Optional MetadataConfig (will create if not provided)
        """
        self.discogs = discogs_connector
        self.config = config or MetadataConfig()
        self.gemini_client = gemini_client

        # Initialize Gemini client if not provided
        if not self.gemini_client and GEMINI_AVAILABLE:
            try:
                api_key = os.getenv("GEMINI_API_KEY")
                if api_key:
                    self.gemini_client = genai.Client(api_key=api_key)
                    logger.info("DiscogsEnrichmentService: Gemini client initialized")
                else:
                    logger.warning(
                        "DiscogsEnrichmentService: GEMINI_API_KEY not set, LLM features disabled"
                    )
            except Exception as e:
                logger.warning(f"DiscogsEnrichmentService: Failed to initialize Gemini: {e}")

        logger.info(
            f"DiscogsEnrichmentService initialized (mode={self.config.mode.value}, "
            f"use_llm_selection={self.config.discogs_use_llm_selection})"
        )

    def enrich_metadata(
        self,
        artist: str,
        title: str,
        mix: Optional[str] = None,
        id3_tags: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Enrich metadata using Discogs + LLM workflow.

        Args:
            artist: Normalized artist name
            title: Normalized title
            mix: Optional mix/remix name
            id3_tags: Optional ID3 tags for context

        Returns:
            Enriched metadata dictionary or None if enrichment failed
        """
        try:
            logger.info(f"Starting Discogs enrichment for: {artist} - {title}")

            # Stage 1: Build queries
            queries = self._build_queries(artist, title, mix, id3_tags)
            if not queries:
                logger.warning("No queries generated, skipping Discogs enrichment")
                return None

            # Stage 2: Search Discogs
            results = self._search_discogs(queries)
            if not results:
                logger.info("No Discogs results found")
                return None

            # Stage 3: Select best match
            best_match = self._select_best_match(results, artist, title, id3_tags)
            if not best_match:
                logger.info("No suitable match found (confidence too low)")
                return None

            # If we found the track in the release's tracklist, use the track title
            # instead of the album/release title
            track_title = title  # Default to original title
            if best_match.get("track_match"):
                matched_track_title = best_match.get("matched_track_title")
                if matched_track_title:
                    track_title = matched_track_title
                    logger.info(
                        f"Using track title '{track_title}' from tracklist instead of release title"
                    )

            # Stage 4: Get release details
            release_data = self._get_release_details(best_match)
            if not release_data:
                logger.warning("Failed to get release details")
                return None

            # Stage 5: Map to schema (use track_title if we found it in tracklist)
            metadata = self._map_to_schema(release_data, artist, track_title, mix)
            if not metadata:
                logger.warning("Failed to map release data to schema")
                return None

            logger.info(f"Successfully enriched metadata for: {artist} - {title}")
            return metadata

        except Exception as e:
            logger.error(f"Discogs enrichment failed: {e}")
            return None

    def _build_queries(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        id3_tags: Optional[Dict[str, Any]],
    ) -> List[str]:
        """
        Build optimized Discogs search queries using LLM (if enabled).

        Args:
            artist: Artist name
            title: Title
            mix: Optional mix name
            id3_tags: Optional ID3 tags

        Returns:
            List of search queries to try (in priority order)
        """
        # Fast mode: single simple query, no LLM
        if self.config.mode == MetadataMode.FAST:
            query = self._build_simple_query(artist, title, mix)
            return [query]

        # Balanced/Accurate mode: use LLM to generate queries
        if not self.gemini_client:
            logger.warning("Gemini client not available, using simple query")
            return [self._build_simple_query(artist, title, mix)]

        try:
            prompt = self._build_query_prompt(artist, title, mix, id3_tags)
            response = self._make_gemini_call(
                prompt, self.QUERY_BUILDING_SCHEMA, "query building"
            )

            if response and "queries" in response:
                queries = response["queries"]
                # Limit number of queries based on mode
                if self.config.mode == MetadataMode.BALANCED:
                    queries = queries[:2]  # Max 2 queries for balanced
                elif self.config.mode == MetadataMode.ACCURATE:
                    queries = queries[:3]  # Max 3 queries for accurate

                logger.info(f"Generated {len(queries)} Discogs queries using LLM")
                return queries
            else:
                logger.warning("LLM query building returned invalid response, using simple query")
                return [self._build_simple_query(artist, title, mix)]

        except Exception as e:
            logger.warning(f"LLM query building failed: {e}, using simple query")
            return [self._build_simple_query(artist, title, mix)]

    def _build_simple_query(self, artist: str, title: str, mix: Optional[str]) -> str:
        """Build a simple Discogs query without LLM."""
        query_parts = [f'artist:"{artist}"', f'release_title:"{title}"']
        if mix:
            query_parts.append(f'release_title:"{mix}"')
        return " AND ".join(query_parts)

    def _build_query_prompt(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        id3_tags: Optional[Dict[str, Any]],
    ) -> str:
        """Build prompt for LLM query generation."""
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
                "- artist:\"name\" for exact artist match",
                "- release_title:\"title\" for exact title match",
                "- year:YYYY for year filter",
                "- label:\"name\" for label filter",
                "",
                "Prioritize queries that:",
                "1. Use exact matches with quotes",
                "2. Include year if available",
                "3. Include label if available",
                "4. Try variations (with/without mix, different formats)",
            ]
        )

        if self.config.mode == MetadataMode.ACCURATE:
            prompt_parts.append(
                "5. Include detailed reasoning for each query strategy"
            )

        return "\n".join(prompt_parts)

    def _search_discogs(self, queries: List[str]) -> List[Dict[str, Any]]:
        """
        Search Discogs using multiple queries and aggregate results.

        Args:
            queries: List of queries to try (in priority order)

        Returns:
            List of unique release results
        """
        all_results = []
        seen_ids = set()

        for query in queries:
            try:
                # Extract artist and title from query for search_release
                # Query format: artist:"..." AND release_title:"..."
                artist_match = None
                title_match = None

                # Simple parsing - extract from query string
                artist_match = re.search(r'artist:"([^"]+)"', query)
                title_match = re.search(r'release_title:"([^"]+)"', query)

                if artist_match and title_match:
                    artist = artist_match.group(1)
                    title = title_match.group(1)

                    # Extract year if present
                    year_match = re.search(r"year:(\d{4})", query)
                    year = int(year_match.group(1)) if year_match else None

                    results = self.discogs.search_release(artist, title, year)
                else:
                    # Fallback: use query as-is (simple text search)
                    logger.warning(f"Could not parse query, using simple text search: {query}")
                    try:
                        # Use query as the main search text
                        results = self.discogs._make_api_call_with_retry(
                            query=query, search_type="release"
                        )
                        # Convert to structured format
                        structured_results = []
                        for release in results:
                            if release.id not in seen_ids:
                                structured_results.append(
                                    {
                                        "id": release.id,
                                        "title": release.title,
                                        "artists": [
                                            a.name for a in (release.artists or [])
                                        ],
                                        "year": release.year if hasattr(release, "year") else None,
                                        "country": release.country
                                        if hasattr(release, "country")
                                        else None,
                                        "label": (
                                            release.labels[0].name
                                            if hasattr(release, "labels")
                                            and release.labels
                                            else None
                                        ),
                                        "genres": (
                                            [str(g) for g in release.genres]
                                            if hasattr(release, "genres") and release.genres
                                            else []
                                        ),
                                        "styles": (
                                            [str(s) for s in release.styles]
                                            if hasattr(release, "styles") and release.styles
                                            else []
                                        ),
                                    }
                                )
                                seen_ids.add(release.id)
                        results = structured_results
                    except DiscogsError as e:
                        logger.warning(f"Discogs search failed for query '{query}': {e}")
                        continue

                # Add unique results
                for result in results:
                    if isinstance(result, dict) and result.get("id") not in seen_ids:
                        all_results.append(result)
                        seen_ids.add(result["id"])

                # Stop if we have enough results
                if len(all_results) >= self.config.discogs_max_results:
                    break

            except Exception as e:
                logger.warning(f"Error searching Discogs with query '{query}': {e}")
                continue

        logger.info(f"Found {len(all_results)} unique Discogs results")
        return all_results[: self.config.discogs_max_results]

    def _check_tracklist_match(
        self, release_id: int, requested_title: str
    ) -> Optional[Dict[str, Any]]:
        """
        Check if the requested track title exists in a release's tracklist.

        Args:
            release_id: Discogs release ID
            requested_title: The track title we're looking for

        Returns:
            Track dict if found, None otherwise
        """
        try:
            # Get full release details (includes tracklist)
            release_details = self.discogs.get_release_details(release_id)
            if not release_details:
                return None

            tracklist = release_details.get("tracklist", [])
            if not tracklist:
                return None

            # Normalize requested title for comparison
            requested_normalized = requested_title.lower().strip()

            # Check each track in the tracklist
            for track in tracklist:
                track_title = track.get("title", "")
                if not track_title:
                    continue

                track_normalized = track_title.lower().strip()

                # Exact match
                if track_normalized == requested_normalized:
                    logger.info(
                        f"Found exact track match in release {release_id}: '{track_title}'"
                    )
                    return track

                # Partial match (requested title is contained in track title or vice versa)
                if (
                    requested_normalized in track_normalized
                    or track_normalized in requested_normalized
                ):
                    logger.info(
                        f"Found partial track match in release {release_id}: '{track_title}'"
                    )
                    return track

            return None
        except Exception as e:
            logger.warning(f"Error checking tracklist for release {release_id}: {e}")
            return None

    def _select_best_match(
        self,
        results: List[Dict[str, Any]],
        artist: str,
        title: str,
        id3_tags: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Select the best matching release from results.
        
        If a release title doesn't match the requested track title, checks the tracklist
        to see if the track exists on that release (album).

        Args:
            results: List of Discogs release results
            artist: Original artist name
            title: Original title (track title we're looking for)
            id3_tags: Optional ID3 tags for context

        Returns:
            Best matching release dict or None if no match meets confidence threshold
        """
        # First, check if any results have matching track titles in their tracklists
        # This handles the case where we get an album but we're looking for a specific track
        normalized_title = title.lower().strip()
        for result in results:
            result_title = result.get("title", "").lower().strip()
            
            # If release title doesn't match track title, check tracklist
            if result_title != normalized_title:
                release_id = result.get("id")
                if release_id:
                    track_match = self._check_tracklist_match(release_id, title)
                    if track_match:
                        # Found the track in this release's tracklist
                        # Update the result to indicate this is the correct match
                        result["track_match"] = track_match
                        result["matched_track_title"] = track_match.get("title", title)
                        logger.info(
                            f"Release {release_id} contains track '{title}' in tracklist"
                        )

        # Fast mode: simple string matching
        if self.config.mode == MetadataMode.FAST or not self.config.discogs_use_llm_selection:
            return self._simple_match(results, artist, title)

        # Balanced/Accurate mode: use LLM selection
        if not self.gemini_client:
            logger.warning("Gemini client not available, using simple matching")
            return self._simple_match(results, artist, title)

        try:
            prompt = self._build_selection_prompt(results, artist, title, id3_tags)
            response = self._make_gemini_call(
                prompt, self.SELECTION_SCHEMA, "result selection"
            )

            if not response:
                logger.warning("LLM selection returned no response")
                return self._simple_match(results, artist, title)

            selected_index = response.get("selected_index")
            confidence = response.get("confidence", 0.0)

            # Check confidence threshold
            if confidence < self.config.discogs_min_confidence:
                logger.info(
                    f"Best match confidence {confidence:.2f} below threshold "
                    f"{self.config.discogs_min_confidence}"
                )
                return None

            if selected_index is None or selected_index < 0 or selected_index >= len(results):
                logger.warning(f"Invalid selected_index {selected_index}")
                return self._simple_match(results, artist, title)

            selected = results[selected_index]
            logger.info(
                f"Selected release {selected_index} with confidence {confidence:.2f}: "
                f"{selected.get('title', 'Unknown')}"
            )
            return selected

        except Exception as e:
            logger.warning(f"LLM selection failed: {e}, using simple matching")
            return self._simple_match(results, artist, title)

    def _simple_match(
        self, results: List[Dict[str, Any]], artist: str, title: str
    ) -> Optional[Dict[str, Any]]:
        """
        Simple string matching for result selection.
        
        Considers:
        1. Direct title match (release title matches track title)
        2. Tracklist match (track found in release's tracklist)
        3. Artist match
        """
        artist_lower = artist.lower()
        title_lower = title.lower()

        best_match = None
        best_score = 0.0

        for result in results:
            score = 0.0

            # Check artist match
            result_artists = result.get("artists", [])
            for result_artist in result_artists:
                if artist_lower in result_artist.lower() or result_artist.lower() in artist_lower:
                    score += 0.5
                    break

            # Check if this result has a tracklist match (from _select_best_match)
            if result.get("track_match"):
                # Found track in tracklist - this is a strong match
                score += 1.0
                logger.info(
                    f"Track '{title}' found in release '{result.get('title')}' tracklist - strong match"
                )
            else:
                # Check direct title match
                result_title = result.get("title", "").lower()
                if title_lower == result_title:
                    score += 1.0  # Exact match
                elif title_lower in result_title or result_title in title_lower:
                    score += 0.5  # Partial match

            if score > best_score:
                best_score = score
                best_match = result

        if best_score >= 0.5:  # At least partial match
            logger.info(f"Simple match found with score {best_score:.2f}")
            return best_match

        return None

    def _build_selection_prompt(
        self,
        results: List[Dict[str, Any]],
        artist: str,
        title: str,
        id3_tags: Optional[Dict[str, Any]],
    ) -> str:
        """Build prompt for LLM result selection."""
        prompt_parts = [
            "You are a music metadata expert. Select the best matching release from Discogs results.",
            "",
            "Original Input:",
            f"- Artist: {artist}",
            f"- Title: {title}",
        ]

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
            # Indicate if this release contains the track in its tracklist
            if result.get("track_match"):
                matched_track = result.get("matched_track_title", title)
                prompt_parts.append(
                    f"    ⭐ TRACK MATCH: This release contains the track '{matched_track}' in its tracklist"
                )

        prompt_parts.extend(
            [
                "",
                "Select the best matching release by index (0-based).",
                "Consider:",
                "1. Releases marked with ⭐ TRACK MATCH are albums that contain the requested track in their tracklist - these are STRONG matches",
                "2. Artist name match (exact > partial > none)",
                "3. Title match (exact > partial > none)",
                "4. Year match if available",
                "5. Label match if available",
                "6. Return null if no good match (confidence < 0.5)",
                "",
                "Return the index of the best match and a confidence score (0.0-1.0).",
            ]
        )

        return "\n".join(prompt_parts)

    def _get_release_details(self, release_match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get full release details from Discogs.

        Args:
            release_match: Release dict with at least 'id' field

        Returns:
            Full release details dict or None if failed
        """
        release_id = release_match.get("id")
        if not release_id:
            logger.error("Release match missing ID")
            return None

        try:
            details = self.discogs.get_release_details(release_id)
            if details:
                logger.info(f"Retrieved release details for ID {release_id}")
            return details
        except Exception as e:
            logger.error(f"Failed to get release details for ID {release_id}: {e}")
            return None

    def _map_to_schema(
        self,
        release_data: Dict[str, Any],
        artist: str,
        title: str,
        mix: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Map Discogs release data to metadata schema using LLM.

        Args:
            release_data: Full Discogs release details
            artist: Original artist name
            title: Original title
            mix: Optional mix name

        Returns:
            Mapped metadata dict or None if failed
        """
        if not self.gemini_client:
            logger.warning("Gemini client not available, using direct mapping")
            return self._direct_map_to_schema(release_data, artist, title, mix)

        try:
            prompt = self._build_schema_mapping_prompt(release_data, artist, title, mix)
            response = self._make_gemini_call(
                prompt, self.METADATA_SCHEMA, "schema mapping"
            )

            if response:
                logger.info("Successfully mapped release data to schema using LLM")
                return response
            else:
                logger.warning("LLM mapping returned no response, using direct mapping")
                return self._direct_map_to_schema(release_data, artist, title, mix)

        except Exception as e:
            logger.warning(f"LLM schema mapping failed: {e}, using direct mapping")
            return self._direct_map_to_schema(release_data, artist, title, mix)

    def _build_schema_mapping_prompt(
        self,
        release_data: Dict[str, Any],
        artist: str,
        title: str,
        mix: Optional[str],
    ) -> str:
        """Build prompt for LLM schema mapping."""
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

    def _direct_map_to_schema(
        self,
        release_data: Dict[str, Any],
        artist: str,
        title: str,
        mix: Optional[str],
    ) -> Dict[str, Any]:
        """Direct mapping without LLM (fallback)."""
        return {
            "artist": artist,
            "title": title,
            "mix": mix,
            "year": release_data.get("year"),
            "country": release_data.get("country"),
            "label": (
                release_data.get("labels", [{}])[0].get("name")
                if release_data.get("labels")
                else None
            ),
            "genre": release_data.get("genres", []),
            "style": release_data.get("styles", []),
            "audioFeatures": None,  # Cannot infer without LLM
            "context": None,  # Cannot infer without LLM
            "description": None,  # Cannot infer without LLM
            "tags": [],
        }

    def _make_gemini_call(
        self, prompt: str, schema: Dict[str, Any], purpose: str
    ) -> Optional[Dict[str, Any]]:
        """
        Make a Gemini API call with structured output.

        Args:
            prompt: User prompt
            schema: Response schema
            purpose: Purpose of call (for logging)

        Returns:
            Parsed response dict or None if failed
        """
        if not self.gemini_client:
            return None

        try:
            response = self.gemini_client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-3-flash-preview"),
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.3,  # Lower temperature for more consistent results
                ),
            )

            # Parse response
            if hasattr(response, "parsed") and response.parsed:
                return response.parsed
            elif hasattr(response, "text") and response.text:
                try:
                    return json.loads(response.text)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse {purpose} response as JSON")
                    return None
            else:
                logger.warning(f"Empty response from Gemini for {purpose}")
                return None

        except Exception as e:
            logger.error(f"Gemini API call failed for {purpose}: {e}")
            return None
