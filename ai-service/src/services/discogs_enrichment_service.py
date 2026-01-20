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

    # Schema for enriching audioFeatures, context, and description
    ENRICHMENT_SCHEMA = {
        "type": "OBJECT",
        "properties": {
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
        },
        "required": ["audioFeatures", "context", "description"],
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
            # OPTIMIZATION: If we already fetched release details for tracklist check, reuse them
            release_data = None
            if best_match.get("_cached_release_details"):
                # Reuse the release details we already fetched
                release_data = best_match["_cached_release_details"]
                logger.info("Reusing cached release details from tracklist check")
            else:
                # Fetch release details
                release_data = self._get_release_details(best_match)
            if not release_data:
                logger.warning("Failed to get release details")
                return None

            # Stage 5: Map to schema (use track_title if we found it in tracklist)
            matched_track_info = None
            if best_match.get("track_match"):
                # Get the matched track from tracklist for context
                tracklist = release_data.get("tracklist", [])
                matched_track_title = best_match.get("matched_track_title")
                if matched_track_title and tracklist:
                    for track in tracklist:
                        if track.get("title", "").lower() == matched_track_title.lower():
                            matched_track_info = track
                            break
            
            metadata = self._map_to_schema(
                release_data, artist, track_title, mix, matched_track_info
            )
            if not metadata:
                logger.warning("Failed to map release data to schema")
                return None

            # Stage 6: Enrich audioFeatures, context, and description using general knowledge
            enriched_fields = self._enrich_audio_features_and_context(
                artist, track_title, mix, metadata
            )
            if enriched_fields:
                # Merge the enriched fields into the metadata, only updating non-null values
                self._merge_enriched_fields(metadata, enriched_fields)
                logger.info("Successfully enriched audioFeatures, context, and description")
            else:
                logger.warning("Failed to enrich audioFeatures, context, and description")

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
        
        OPTIMIZATION: Caches tracklist data to avoid redundant API calls.

        Args:
            release_id: Discogs release ID
            requested_title: The track title we're looking for

        Returns:
            Track dict if found, None otherwise
        """
        try:
            # OPTIMIZATION: Check cache first (tracklists don't change)
            cache_key = f"tracklist:{release_id}"
            if hasattr(self.discogs, 'redis_cache') and self.discogs.redis_cache:
                try:
                    cached_tracklist = self.discogs.redis_cache.get("discogs", cache_key)
                    if cached_tracklist:
                        tracklist = cached_tracklist.get("tracklist", [])
                        logger.debug(f"Cache hit for tracklist: release {release_id}")
                    else:
                        tracklist = None
                except Exception as e:
                    logger.debug(f"Cache check failed: {e}")
                    tracklist = None
            else:
                tracklist = None
            
            # If not cached, get full release details (includes tracklist)
            release_details = None
            if tracklist is None:
                release_details = self.discogs.get_release_details(release_id)
                if not release_details:
                    return None
                
                tracklist = release_details.get("tracklist", [])
                
                # OPTIMIZATION: Cache tracklist for future use (7 days TTL - tracklists don't change)
                if hasattr(self.discogs, 'redis_cache') and self.discogs.redis_cache and tracklist:
                    try:
                        self.discogs.redis_cache.set(
                            "discogs", 
                            cache_key, 
                            {"tracklist": tracklist},
                            ttl=7 * 24 * 3600  # 7 days
                        )
                        logger.debug(f"Cached tracklist for release {release_id}")
                    except Exception as e:
                        logger.debug(f"Cache set failed: {e}")
            
            if not tracklist:
                # No tracklist available, but return release_details if we fetched it
                if release_details:
                    return {"track": None, "release_details": release_details}
                return None

            # Normalize requested title for comparison
            requested_normalized = requested_title.lower().strip()

            # Check each track in the tracklist
            matched_track = None
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
                    matched_track = track
                    break

                # Partial match (requested title is contained in track title or vice versa)
                if (
                    requested_normalized in track_normalized
                    or track_normalized in requested_normalized
                ):
                    logger.info(
                        f"Found partial track match in release {release_id}: '{track_title}'"
                    )
                    matched_track = track
                    break
            
            # Return track if found, along with release_details if we fetched it
            result = {"track": matched_track} if matched_track else {"track": None}
            if release_details:
                result["release_details"] = release_details
            return result
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
        # OPTIMIZATION: Only check top 5 results - Discogs results are ordered by relevance,
        # so if the top 5 don't contain the track, lower-ranked results are unlikely to match
        # Each tracklist check requires a separate API call, so limiting saves time and API calls
        normalized_title = title.lower().strip()
        max_tracklist_checks = min(5, len(results))  # Limit to top 5 most relevant results
        
        for result in results[:max_tracklist_checks]:
            result_title = result.get("title", "").lower().strip()
            
            # Skip tracklist check if title already matches (exact match - this is already a strong match)
            if result_title == normalized_title:
                logger.debug(
                    f"Release title '{result.get('title')}' matches track title exactly - strong match"
                )
                # Mark as strong match but continue checking others in case there's a better one
                result["_exact_title_match"] = True
                continue
            
            # If release title doesn't match track title, check tracklist
            release_id = result.get("id")
            if release_id:
                tracklist_result = self._check_tracklist_match(release_id, title)
                if tracklist_result:
                    # Extract track match and cached release details
                    track_match = tracklist_result.get("track")
                    cached_release_details = tracklist_result.get("release_details")
                    
                    if track_match:
                        # Found the track in this release's tracklist - this is a strong match
                        result["track_match"] = track_match
                        result["matched_track_title"] = track_match.get("title", title)
                        result["_strong_match"] = True
                        logger.info(
                            f"Release {release_id} contains track '{title}' in tracklist - strong match"
                        )
                        # Don't stop early - continue checking to find the best match
                        # But we can prioritize these in selection
                    
                    # OPTIMIZATION: Cache release details to avoid fetching again
                    if cached_release_details:
                        result["_cached_release_details"] = cached_release_details

        # OPTIMIZATION: Skip LLM selection if only one result
        if len(results) == 1:
            logger.info("Only one result found, skipping selection - using it directly")
            return results[0]

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
        
        Considers (in priority order):
        1. Exact title match (release title matches track title exactly)
        2. Tracklist match (track found in release's tracklist) - strong indicator
        3. Artist match
        4. Partial title match
        """
        artist_lower = artist.lower()
        title_lower = title.lower()

        best_match = None
        best_score = 0.0

        for result in results:
            score = 0.0

            # Priority 1: Exact title match (highest priority)
            result_title = result.get("title", "").lower()
            if title_lower == result_title:
                score += 2.0  # Exact match - highest score
                logger.debug(
                    f"Exact title match: '{result.get('title')}' = '{title}'"
                )
            # Priority 2: Tracklist match (strong indicator the track is on this release)
            elif result.get("track_match"):
                # Found track in tracklist - this is a strong match
                score += 1.5
                logger.info(
                    f"Track '{title}' found in release '{result.get('title')}' tracklist - strong match"
                )
            # Priority 3: Partial title match
            elif title_lower in result_title or result_title in title_lower:
                score += 0.5  # Partial match

            # Check artist match (adds to score)
            result_artists = result.get("artists", [])
            for result_artist in result_artists:
                if artist_lower in result_artist.lower() or result_artist.lower() in artist_lower:
                    score += 0.5
                    break

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
        matched_track_info: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Map Discogs release data to metadata schema using LLM.

        Args:
            release_data: Full Discogs release details
            artist: Original artist name
            title: Original title
            mix: Optional mix name
            matched_track_info: Optional matched track from tracklist (if found)

        Returns:
            Mapped metadata dict or None if failed
        """
        if not self.gemini_client:
            logger.warning("Gemini client not available, using direct mapping")
            return self._direct_map_to_schema(release_data, artist, title, mix)

        try:
            prompt = self._build_schema_mapping_prompt(
                release_data, artist, title, mix, matched_track_info
            )
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
        matched_track_info: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build prompt for LLM schema mapping."""
        # Filter out unnecessary data to reduce token usage
        filtered_data = {
            "id": release_data.get("id"),
            "title": release_data.get("title"),
            "artists": release_data.get("artists", []),
            "year": release_data.get("year"),
            "country": release_data.get("country"),
            "labels": release_data.get("labels", []),
            "formats": release_data.get("formats", []),
            "genres": release_data.get("genres", []),
            "styles": release_data.get("styles", []),
            "credits": release_data.get("credits", []),
        }
        
        # Only include the matched track from tracklist, not the entire tracklist
        if matched_track_info:
            filtered_data["matched_track"] = matched_track_info

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
                json.dumps(filtered_data, indent=2),
                "",
                "Map this data to the metadata schema. Requirements:",
                "1. Use artist and title from original input (not Discogs)",
                "2. Extract genres and styles from Discogs",
                "3. Extract year, country, label from Discogs",
                "4. Tags: Generate relevant tags from genres, styles, and metadata",
                "",
                "IMPORTANT:",
                "- Do NOT include audioFeatures, context, or description fields",
                "- These fields will be populated by a separate process",
                "- Only include fields you're confident about. Use null for uncertain values.",
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

    def _enrich_audio_features_and_context(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        existing_metadata: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Enrich audioFeatures, context, and description using general knowledge/search.

        This method uses the LLM with general knowledge about the track/artist to generate:
        - audioFeatures (BPM, Key, Vocals, Atmosphere)
        - context (Background, Impact)
        - description (2-3 sentences about the track's sound)

        Args:
            artist: Artist name
            title: Track title
            mix: Optional mix/remix name
            existing_metadata: Existing metadata from Discogs (genres, styles, year, etc.)

        Returns:
            Dict with audioFeatures, context, and description, or None if failed
        """
        if not self.gemini_client:
            logger.warning("Gemini client not available, skipping enrichment")
            return None

        try:
            prompt = self._build_enrichment_prompt(artist, title, mix, existing_metadata)
            response = self._make_gemini_call(
                prompt, self.ENRICHMENT_SCHEMA, "audio features and context enrichment"
            )

            if response:
                logger.info("Successfully enriched audioFeatures, context, and description")
                return response
            else:
                logger.warning("Enrichment returned no response")
                return None

        except Exception as e:
            logger.warning(f"Enrichment failed: {e}")
            return None

    def _build_enrichment_prompt(
        self,
        artist: str,
        title: str,
        mix: Optional[str],
        existing_metadata: Dict[str, Any],
    ) -> str:
        """
        Build prompt for enriching audioFeatures, context, and description.

        Uses general knowledge about the track/artist rather than specific Discogs data.
        """
        prompt_parts = [
            "You are a music expert with deep knowledge of tracks, artists, and music history.",
            "Generate detailed metadata for the following track using your general knowledge.",
            "",
            "Track Information:",
            f"- Artist: {artist}",
            f"- Title: {title}",
        ]

        if mix:
            prompt_parts.append(f"- Mix: {mix}")

        # Include relevant context from existing metadata
        if existing_metadata.get("genre"):
            prompt_parts.append(f"- Genres: {', '.join(existing_metadata.get('genre', []))}")
        if existing_metadata.get("style"):
            prompt_parts.append(f"- Styles: {', '.join(existing_metadata.get('style', []))}")
        if existing_metadata.get("year"):
            prompt_parts.append(f"- Year: {existing_metadata.get('year')}")
        if existing_metadata.get("country"):
            prompt_parts.append(f"- Country: {existing_metadata.get('country')}")
        if existing_metadata.get("label"):
            prompt_parts.append(f"- Label: {existing_metadata.get('label')}")

        prompt_parts.extend(
            [
                "",
                "Generate the following fields:",
                "",
                "1. audioFeatures:",
                "   - bpm: Typical BPM for this track/genre (integer, or null if uncertain)",
                "   - key: Musical key if known (e.g., 'C Minor', '8A', or null if uncertain)",
                "   - vocals: Description of vocals (e.g., 'Turkish female vocals', 'Instrumental', 'Chopped samples', or null if uncertain)",
                "   - atmosphere: Array of vibe keywords (e.g., ['Hypnotic', 'Sparkly', 'Industrial'])",
                "",
                "2. context:",
                "   - background: Historical or production context (e.g., 'Produced during lockdown', 'Debut EP on Public Possession', or null if uncertain)",
                "   - impact: Cultural impact or chart success (e.g., 'Established her residency at Panorama Bar', or null if uncertain)",
                "",
                "3. description:",
                "   - A 2-3 sentence summary of the track's sound, style, and character",
                "",
                "IMPORTANT:",
                "- Use your general knowledge about this track/artist",
                "- If you're not confident about a field, use null (don't guess)",
                "- For atmosphere, provide 3-5 relevant keywords",
                "- For description, be specific about the sound, not generic",
            ]
        )

        return "\n".join(prompt_parts)

    def _merge_enriched_fields(
        self, metadata: Dict[str, Any], enriched_fields: Dict[str, Any]
    ) -> None:
        """
        Merge enriched fields into metadata, only updating non-null values.

        Args:
            metadata: Existing metadata dict to update
            enriched_fields: New enriched fields to merge
        """
        # Merge audioFeatures
        if enriched_fields.get("audioFeatures"):
            if not metadata.get("audioFeatures"):
                metadata["audioFeatures"] = {}
            audio_features = metadata["audioFeatures"]
            enriched_audio = enriched_fields["audioFeatures"]
            
            # Only update non-null values
            if enriched_audio.get("bpm") is not None:
                audio_features["bpm"] = enriched_audio["bpm"]
            if enriched_audio.get("key") is not None:
                audio_features["key"] = enriched_audio["key"]
            if enriched_audio.get("vocals") is not None:
                audio_features["vocals"] = enriched_audio["vocals"]
            if enriched_audio.get("atmosphere"):
                audio_features["atmosphere"] = enriched_audio["atmosphere"]

        # Merge context
        if enriched_fields.get("context"):
            if not metadata.get("context"):
                metadata["context"] = {}
            context = metadata["context"]
            enriched_context = enriched_fields["context"]
            
            # Only update non-null values
            if enriched_context.get("background") is not None:
                context["background"] = enriched_context["background"]
            if enriched_context.get("impact") is not None:
                context["impact"] = enriched_context["impact"]

        # Merge description
        if enriched_fields.get("description") is not None:
            metadata["description"] = enriched_fields["description"]
