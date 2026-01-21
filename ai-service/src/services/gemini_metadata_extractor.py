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
    MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

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
                    "vocals": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "Provide detailed description (e.g., 'Ibo male vocals with call-and-response patterns', 'Turkish female vocals with traditional instrumentation', 'Instrumental with sampled vocal chops'). If no vocals, use 'Instrumental'.",
                    },
                    "atmosphere": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Provide 3-5 specific vibe keywords that describe the track's mood and texture (e.g., 'Hypnotic', 'Sparkly', 'Industrial', 'Ethereal', 'Dark', 'Groovy', 'Energetic')",
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
                        "description": "MUST be a comprehensive narrative of at least 150 characters. Include: recording studio, featured musicians, historical context of the era, production details, and cultural significance. Extract maximum detail from URL sources.",
                    },
                    "impact": {
                        "type": "STRING",
                        "nullable": True,
                        "description": "MUST be a comprehensive narrative detailing cultural significance, rarity, reissue history, collector value, compilation appearances, samples, and specific mentions in modern music culture (e.g., charts, iconic DJ sets). Minimum 150 characters.",
                    },
                },
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
        
        # Google Search (grounding) configuration
        # Enable by default to find missing cultural context and impact details
        # Set GEMINI_ENABLE_GOOGLE_SEARCH=false to disable
        enable_google_search = os.getenv("GEMINI_ENABLE_GOOGLE_SEARCH", "true").lower() == "true"

        # Determinism parameters from environment (for maximum consistency)
        temperature = (
            float(os.getenv("GEMINI_TEMPERATURE","0"))
         
        )
        top_p = (
            float(os.getenv("GEMINI_TOP_P", "0.1"))
            if os.getenv("GEMINI_TOP_P")
            else None
        )
        # top_k must be an integer (number of tokens), not a float
        top_k_env = os.getenv("GEMINI_TOP_K", "1")
        try:
            top_k = int(top_k_env) if top_k_env else None
        except ValueError:
            logger.warning(f"Invalid GEMINI_TOP_K value '{top_k_env}', must be an integer. Using default: 1")
            top_k = 1
        seed = (
            int(os.getenv("GEMINI_SEED","42"))
            
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
            top_k=top_k,
            seed=seed,
        )
        
        # Store Google Search setting after initialization
        self.enable_google_search = enable_google_search

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
            
            # Use a fast model for this lightweight task
            response = self.client.models.generate_content(
                model=self.MODEL,
                contents=cleaning_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,  # Deterministic output
                ),
            )
            
            # Extract cleaned filename from response
            if hasattr(response, "text") and response.text:
                cleaned = response.text.strip()
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
        Make a single API call to Gemini.

        Args:
            user_content: User message content
            urls: Optional list of URLs to fetch using URL context tool

        Returns:
            Gemini API response

        Raises:
            Exception: If API call fails
        """
        # Build system instruction
        system_instruction = "\n".join(self.INSTRUCTIONS)
        
        # Prepare tools - enable URL context and optionally Google Search
        tools = []
        if urls and len(urls) > 0:
            # Limit to 20 URLs (Gemini's maximum per request)
            urls_to_use = urls[:20]
            if len(urls) > 20:
                logger.warning(
                    f"Found {len(urls)} URLs, but Gemini URL context tool supports max 20. Using first 20 URLs."
                )
            
            # Enable URL context tool (primary source - deep dive into specific pages)
            tools.append({"url_context": {}})
            logger.info(f"Enabling URL context tool for {len(urls_to_use)} URL(s): {urls_to_use}")
            
            # Enable Google Search (grounding) to find missing information
            # This acts as a "scout" to find cultural impact, reissue history, samples, etc.
            if self.enable_google_search:
                try:
                    tools.append({"google_search": {}})
                    logger.info("Enabling Google Search (grounding) to find additional cultural context and impact details")
                except Exception as e:
                    logger.warning(f"Failed to enable Google Search tool: {e}. Continuing with URL context only.")
        elif self.enable_google_search:
            # Enable Google Search even without URLs to find information
            try:
                tools.append({"google_search": {}})
                logger.info("Enabling Google Search (grounding) to find track information")
            except Exception as e:
                logger.warning(f"Failed to enable Google Search tool: {e}")
        # Make API call with structured outputs using Gemini's native SDK
        # Configure for maximum determinism
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=self.RESPONSE_SCHEMA,
            temperature=self.temperature,
        )
        
        # Add optional determinism parameters if supported by Gemini SDK
        # Note: These may not be available in all Gemini API versions
        try:
            if hasattr(config, "top_p") and self.top_p is not None:
                config.top_p = self.top_p
            if hasattr(config, "top_k") and self.top_k is not None:
                config.top_k = self.top_k
            if hasattr(config, "seed") and self.seed is not None:
                config.seed = self.seed
            # property_ordering might not be supported - try to set it if available
            if hasattr(config, "property_ordering"):
                try:
                    # Property ordering: place complex fields (context, audioFeatures) at the end
                    # This allows the model to build up track profile before writing complex narratives
                    config.property_ordering = ["artist", "title", "mix", "year", "country", "label", "genre", "style", "tags", "audioFeatures", "context"]
                except (AttributeError, TypeError, ValueError) as e:
                    logger.debug(f"property_ordering not supported: {e}")
                    pass  # property_ordering not supported, skip it
        except (AttributeError, TypeError) as e:
            # Parameters not supported in this SDK version - log and continue
            logger.debug(f"Some determinism parameters not available: {e}")
        
        # Add tools if URL context is enabled
        if tools:
            config.tools = tools
        print(user_content)
        print('----')
        print(system_instruction)
        response = self.client.models.generate_content(
            model=self.MODEL,
            contents=user_content,
            config=config,
        )
      
        # Log tool usage metadata if available (for debugging)
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            
            # Log URL context metadata
            if urls and hasattr(candidate, "url_context_metadata"):
                url_metadata = candidate.url_context_metadata
                if url_metadata and hasattr(url_metadata, "url_metadata"):
                    logger.info("URL context retrieval status:")
                    for url_info in url_metadata.url_metadata:
                        status = getattr(url_info, "url_retrieval_status", "UNKNOWN")
                        retrieved_url = getattr(url_info, "retrieved_url", "UNKNOWN")
                        status_icon = "✅" if "SUCCESS" in str(status) else "❌"
                        logger.info(
                            f"  {status_icon} {retrieved_url} - {status}"
                        )
                else:
                    logger.warning("URL context metadata not found in response. URLs may not have been fetched.")
            
            # Log Google Search (grounding) metadata
            if self.enable_google_search and hasattr(candidate, "grounding_metadata"):
                grounding_metadata = candidate.grounding_metadata
                if grounding_metadata:
                    logger.info("Google Search (grounding) results:")
                    if hasattr(grounding_metadata, "grounding_chunks"):
                        chunks = grounding_metadata.grounding_chunks
                        logger.info(f"  Found {len(chunks) if chunks else 0} search result chunks")
                        if chunks:
                            for i, chunk in enumerate(chunks[:3], 1):  # Log first 3 results
                                if hasattr(chunk, "web"):
                                    web = chunk.web
                                    if hasattr(web, "uri"):
                                        logger.info(f"  {i}. {web.uri}")
                    if hasattr(grounding_metadata, "search_entry_point"):
                        entry_point = grounding_metadata.search_entry_point
                        if hasattr(entry_point, "rendered_content"):
                            logger.debug(f"  Search query: {entry_point.rendered_content}")
                else:
                    logger.debug("Google Search metadata not found (may not have performed searches)")
        
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
