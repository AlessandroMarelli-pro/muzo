"""
Gemini-based metadata extraction service for extracting music metadata from filenames.

This service uses Google's Gemini API with structured outputs to extract comprehensive metadata
from audio filenames, including artist, title, genre, style, credits, and more.
"""

import json
import os
import threading
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
    # Note: For context caching, use versioned model names (e.g., "gemini-2.5-flash-001")
    MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    # Class-level cache storage to share cache across instances
    # This prevents recreating the cache on each service instantiation
    _class_cache_name: Optional[str] = None
    _class_cached_tools: List[str] = []
    _class_cache_lock = threading.Lock()

    # Context caching configuration
    # Minimum token requirements for context caching:
    # - Flash models: 2,048 tokens
    # - Pro models: 32,768 tokens
    CACHE_MIN_TOKENS_FLASH = 2048
    CACHE_MIN_TOKENS_PRO = 32768

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

    # Batch response schema - array of metadata objects
    # This allows processing multiple tracks in a single API call with shared system instruction
    BATCH_RESPONSE_SCHEMA = {
        "type": "OBJECT",
        "properties": {
            "results": {
                "type": "ARRAY",
                "items": RESPONSE_SCHEMA,
                "description": "Array of metadata objects, one for each track in the same order as input",
            }
        },
        "required": ["results"],
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
        # Disabled by default to allow context caching (tools conflict with cached content)
        # Set GEMINI_ENABLE_GOOGLE_SEARCH=true to enable
        enable_google_search = (
            os.getenv("GEMINI_ENABLE_GOOGLE_SEARCH", "true").lower() == "true"
        )

        # Determinism parameters from environment (for maximum consistency)
        temperature = float(os.getenv("GEMINI_TEMPERATURE", "0"))
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
            logger.warning(
                f"Invalid GEMINI_TOP_K value '{top_k_env}', must be an integer. Using default: 1"
            )
            top_k = 1
        seed = int(os.getenv("GEMINI_SEED", "42"))

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

        # Context caching configuration
        self.enable_context_cache = (
            os.getenv("GEMINI_ENABLE_CONTEXT_CACHE", "true").lower() == "true"
        )
        self.cache_ttl_seconds = int(
            os.getenv("GEMINI_CACHE_TTL_SECONDS", "3600")
        )  # Default: 1 hour
        # Cache name prefix for deterministic naming (optional, can be set via env var)
        self._cache_name_prefix = os.getenv("GEMINI_CACHE_NAME_PREFIX", None)

        # Use class-level cache if available, otherwise instance-level
        # This allows cache to persist across service instantiations
        if GeminiMetadataExtractor._class_cache_name:
            self._cached_content_name = GeminiMetadataExtractor._class_cache_name
            self._cached_tools = GeminiMetadataExtractor._class_cached_tools.copy()
            logger.debug(
                f"Reusing existing class-level context cache: {self._cached_content_name}"
            )
        else:
            self._cached_content_name: Optional[str] = None
            # Track which tools are included in the cache
            self._cached_tools: List[str] = []

        # Initialize context cache if enabled (will use class-level cache if available)
        if self.enable_context_cache:
            self._ensure_context_cache()

    def _get_model_for_caching(self) -> str:
        """
        Get the model name for context caching.

        According to the official Gemini API docs, preview models (like gemini-3-flash-preview)
        can be used directly without version suffixes. Stable models may need version suffixes.

        Returns:
            Model name suitable for context caching
        """
        model = self.MODEL.lower()

        # Preview models (containing "preview") should be used as-is - they don't use version suffixes
        if "preview" in model:
            logger.debug(
                f"Using preview model '{self.MODEL}' as-is for context caching"
            )
            return self.MODEL

        # If already versioned (contains -001, -002, etc.), use as-is
        if "-001" in model or "-002" in model or "-003" in model:
            return self.MODEL

        # For stable models without version, try to use versioned equivalents
        model_mapping = {
            "gemini-2.5-flash": "gemini-2.5-flash-001",
            "gemini-2.5-pro": "gemini-2.5-pro-001",
            "gemini-2.0-flash": "gemini-2.0-flash-001",
        }

        # Try to find a mapping for stable models
        for key, versioned in model_mapping.items():
            if key in model:
                logger.info(
                    f"Mapping stable model '{self.MODEL}' to versioned model '{versioned}' for context caching"
                )
                return versioned

        # If no mapping found, use as-is (might work for some models)
        logger.info(f"Using model '{self.MODEL}' as-is for context caching")
        return self.MODEL

    def _estimate_token_count(self, text: str) -> int:
        """
        Estimate token count for a text string.

        Uses a simple approximation: ~4 characters per token for English text.
        This is a rough estimate; actual tokenization may vary.

        Args:
            text: Text to estimate tokens for

        Returns:
            Estimated token count
        """
        # Rough approximation: 4 characters per token
        # This is conservative; actual tokenization may be more efficient
        return len(text) // 4

    def _pad_system_instruction_if_needed(self, system_instruction: str) -> str:
        """
        Pad system instruction to meet minimum token requirements for context caching.

        Args:
            system_instruction: Original system instruction

        Returns:
            Padded system instruction if needed, otherwise original
        """
        model = self._get_model_for_caching().lower()

        # Determine minimum token requirement based on model type
        if "pro" in model:
            min_tokens = self.CACHE_MIN_TOKENS_PRO
        else:
            min_tokens = self.CACHE_MIN_TOKENS_FLASH

        current_tokens = self._estimate_token_count(system_instruction)

        if current_tokens >= min_tokens:
            logger.debug(
                f"System instruction has {current_tokens} tokens (>= {min_tokens} required)"
            )
            return system_instruction

        # Need to pad - add additional few-shot examples or instructions
        padding_needed = min_tokens - current_tokens
        logger.info(
            f"System instruction has {current_tokens} tokens, but {min_tokens} required for caching. "
            f"Padding with {padding_needed} additional tokens."
        )

        # Add padding with additional context about metadata extraction
        padding_text = """

ADDITIONAL CONTEXT FOR METADATA EXTRACTION:
- Always prioritize accuracy over speed when extracting metadata
- Cross-reference multiple sources when available (URLs, ID3 tags, filenames)
- For rare or obscure tracks, use Google Search to find additional cultural context
- Ensure all date fields (year) are accurate and verified
- Genre and style tags should be specific and culturally appropriate
- Background and impact narratives should be comprehensive and well-researched
- Audio features should capture the unique characteristics of each track
- When URLs are provided, extract maximum detail from those authoritative sources
"""

        # Add padding until we meet the requirement
        padded = system_instruction
        while self._estimate_token_count(padded) < min_tokens:
            padded += padding_text

        final_tokens = self._estimate_token_count(padded)
        logger.info(
            f"Padded system instruction to {final_tokens} tokens (target: {min_tokens})"
        )

        return padded

    def _check_existing_cache(self, model_for_caching: str) -> Optional[str]:
        """
        Check if a valid cache already exists for this configuration.

        Args:
            model_for_caching: Model name used for caching

        Returns:
            Cache name if found and valid, None otherwise
        """
        if not self._is_available():
            return None

        try:
            # Try to list existing caches and find one that matches our configuration
            # Note: The Gemini API may not support listing all caches directly,
            # so we'll try to use the cache if we have a stored name, or create a new one
            # For now, we'll rely on the cache TTL and recreate when needed

            # If we have a cache name from a previous session, we could try to validate it
            # but since we don't have persistent storage, we'll create a new one each time
            # The cache will be reused within the same process/instance
            return None
        except Exception as e:
            logger.debug(f"Could not check for existing cache: {e}")
            return None

    def _ensure_context_cache(self) -> None:
        """
        Ensure context cache exists for system instructions.

        Creates a cached content with the system instruction and tools if enabled.
        The cache MUST include ALL tools that will be used. This enables 90% discount on cached tokens.

        If a cache already exists and is valid, it will be reused. Otherwise, a new cache is created.
        """
        if not self.enable_context_cache:
            logger.debug("Context caching is disabled")
            return

        if not self._is_available():
            logger.warning("Gemini client not available, cannot create context cache")
            return

        # Check if we already have a valid cache (class-level or instance-level)
        cache_to_check = (
            self._cached_content_name or GeminiMetadataExtractor._class_cache_name
        )

        if cache_to_check:
            # Cache exists, use it (will be validated when actually used)
            if not self._cached_content_name:
                # Use class-level cache
                self._cached_content_name = GeminiMetadataExtractor._class_cache_name
                self._cached_tools = GeminiMetadataExtractor._class_cached_tools.copy()
            logger.debug(f"Using existing context cache: {self._cached_content_name}")
            return

        try:
            # Build system instruction
            system_instruction = "\n".join(self.INSTRUCTIONS)

            # Pad if needed to meet minimum token requirements
            system_instruction = self._pad_system_instruction_if_needed(
                system_instruction
            )

            # Get versioned model name for caching
            model_for_caching = self._get_model_for_caching()

            # Build tools list for cache (must include ALL tools that will be used)
            cache_tools = []
            self._cached_tools = []

            # Add Google Search tool if enabled
            if self.enable_google_search:
                try:
                    cache_tools.append(types.Tool(google_search=types.GoogleSearch()))
                    self._cached_tools.append("google_search")
                    logger.debug("Including Google Search tool in context cache")
                except Exception as e:
                    logger.warning(f"Failed to add Google Search tool to cache: {e}")

            # Create cached content
            logger.info(
                f"Creating context cache for model '{model_for_caching}' "
                f"(TTL: {self.cache_ttl_seconds}s, tools: {', '.join(self._cached_tools) if self._cached_tools else 'none'})"
            )

            # Create cached content according to official API documentation
            # Reference: https://ai.google.dev/gemini-api/docs/caching
            # The cache MUST include ALL tools that will be used
            cache_config = types.CreateCachedContentConfig(
                system_instruction=system_instruction,
                ttl=f"{self.cache_ttl_seconds}s",
            )

            # Add tools to cache config if any are enabled
            if cache_tools:
                cache_config.tools = cache_tools

            # Optionally set a display name for the cache (if supported)
            # This helps identify the cache but doesn't prevent recreation
            if hasattr(cache_config, "display_name") and self._cache_name_prefix:
                cache_config.display_name = (
                    f"{self._cache_name_prefix}-metadata-extraction"
                )

            # Use lock to prevent multiple instances from creating cache simultaneously
            with GeminiMetadataExtractor._class_cache_lock:
                # Double-check if another thread/instance created the cache while we were waiting
                if GeminiMetadataExtractor._class_cache_name:
                    self._cached_content_name = (
                        GeminiMetadataExtractor._class_cache_name
                    )
                    self._cached_tools = (
                        GeminiMetadataExtractor._class_cached_tools.copy()
                    )
                    logger.debug(
                        f"Another instance created cache, reusing: {self._cached_content_name}"
                    )
                    return

                # Create new cache
                cached_content = self.client.caches.create(
                    model=model_for_caching, config=cache_config
                )
                self._cached_content_name = cached_content.name

                # Store in class-level variables for reuse across instances
                GeminiMetadataExtractor._class_cache_name = self._cached_content_name
                GeminiMetadataExtractor._class_cached_tools = self._cached_tools.copy()

            logger.info(
                f"Context cache created successfully: {self._cached_content_name} "
                f"(90% discount on cached tokens, tools: {', '.join(self._cached_tools) if self._cached_tools else 'none'})"
            )

        except Exception as e:
            logger.warning(
                f"Failed to create context cache: {e}. "
                f"Falling back to standard API calls without caching."
            )
            self.enable_context_cache = False
            self._cached_content_name = None
            self._cached_tools = []

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
            logger.warning(
                f"Failed to clean filename with LLM: {e}. Using original filename."
            )
            return filename

    def _clean_filenames_batch(self, filenames: List[str]) -> List[str]:
        """
        Clean and normalize multiple filenames in a single API call for efficiency.

        This batches filename cleaning to reduce API calls and improve throughput.

        Args:
            filenames: List of raw filenames to clean

        Returns:
            List of cleaned filenames in normalized format
        """
        if not self._is_available() or not filenames:
            return filenames

        try:
            # Build batch cleaning prompt
            filenames_list = "\n".join(
                [f"{i + 1}. {fn}" for i, fn in enumerate(filenames)]
            )
            batch_prompt = f"""Clean and normalize these music filenames to extract only the core artist and title information.

Remove from each:
- Country tags in brackets like [nigeria], [uk], [us]
- Years in parentheses like (1979), (1985)
- Genre/style tags like "soul", "funk", "electronic" when they appear as separate tags
- Extra metadata, labels, or identifiers

Keep:
- Artist name (normalize case to Title Case)
- Title name (normalize case to Title Case)
- Mix names in parentheses if they're part of the title (e.g., "Remix", "Extended Mix")

Format each output as: "Artist - Title" or "Artist - Title (Mix Name)"

Examples:
- "t-fire - say a prayer [nigeria] soul (1979)" -> "T-Fire - Say A Prayer"
- "T-Fire - Say A Prayer" -> "T-Fire - Say A Prayer"
- "artist - title (remix) [2020]" -> "Artist - Title (Remix)"

Filenames to clean:
{filenames_list}

Return ONLY a JSON array of cleaned filenames in the same order, nothing else. Format: ["Artist - Title", "Artist2 - Title2", ...]"""

            response = self.client.models.generate_content(
                model=self.MODEL,
                contents=batch_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,  # Deterministic output
                    response_mime_type="application/json",
                ),
            )

            # Parse batch response
            if hasattr(response, "text") and response.text:
                import json

                try:
                    cleaned_list = json.loads(response.text.strip())
                    if isinstance(cleaned_list, list) and len(cleaned_list) == len(
                        filenames
                    ):
                        return cleaned_list
                    else:
                        logger.warning(
                            "Batch cleaning returned unexpected format, falling back to individual cleaning"
                        )
                        return [self._clean_filename_with_llm(fn) for fn in filenames]
                except json.JSONDecodeError:
                    logger.warning(
                        "Failed to parse batch cleaning response, falling back to individual cleaning"
                    )
                    return [self._clean_filename_with_llm(fn) for fn in filenames]
            else:
                logger.warning(
                    "Empty response from batch filename cleaning, falling back to individual cleaning"
                )
                return [self._clean_filename_with_llm(fn) for fn in filenames]

        except Exception as e:
            logger.warning(
                f"Failed to clean filenames in batch: {e}. Falling back to individual cleaning."
            )
            return [self._clean_filename_with_llm(fn) for fn in filenames]

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
        # URLs are now included in the user_content prompt instead of using url_context tool
        # This allows us to use cached content (90% discount) since no tools are needed
        tools = []
        if urls and len(urls) > 0:
            urls_to_use = urls[:20]  # Limit to 20 URLs for display
            if len(urls) > 20:
                logger.info(
                    f"Found {len(urls)} URLs, using first 20 in prompt. "
                    f"URLs are included in user_content for LLM to retrieve data from."
                )
            else:
                logger.debug(
                    f"URLs included in prompt for LLM retrieval: {len(urls_to_use)} URL(s)"
                )

        # Google Search is disabled by default - can be enabled if needed
        if self.enable_google_search:
            try:
                tools.append({"google_search": {}})
                logger.info(
                    "Enabling Google Search (grounding) to find track information"
                )
            except Exception as e:
                logger.warning(f"Failed to enable Google Search tool: {e}")
        # Make API call with structured outputs using Gemini's native SDK
        # Configure for maximum determinism
        # Use context caching if available (90% discount on cached tokens)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=self.RESPONSE_SCHEMA,
            temperature=self.temperature,
        )

        # Check if we can use cached content
        # Cached content can be used if:
        # 1. Caching is enabled and cache exists
        # 2. The tools we need are already in the cache (or no tools needed)
        requested_tool_names = []
        if tools:
            for tool in tools:
                if isinstance(tool, dict):
                    if "google_search" in tool:
                        requested_tool_names.append("google_search")
                    elif "url_context" in tool:
                        requested_tool_names.append("url_context")

        # Check if all requested tools are in the cache
        tools_match_cache = (
            not requested_tool_names  # No tools needed
            or all(
                tool in self._cached_tools for tool in requested_tool_names
            )  # All tools in cache
        )

        use_cached_content = (
            self.enable_context_cache
            and self._cached_content_name
            and tools_match_cache  # Tools must match what's in cache
        )

        if use_cached_content:
            try:
                config.cached_content = self._cached_content_name
                logger.debug(
                    f"Using context cache: {self._cached_content_name} "
                    f"(tools in cache: {', '.join(self._cached_tools) if self._cached_tools else 'none'})"
                )
                # Don't add tools to config - they're already in the cached content
            except Exception as e:
                # Cache may have expired, try to recreate
                error_msg = str(e).lower()
                if (
                    "not found" in error_msg
                    or "expired" in error_msg
                    or "invalid" in error_msg
                ):
                    logger.info(
                        f"Context cache expired or invalid: {e}. Recreating cache..."
                    )
                    # Clear both instance and class-level cache names so _ensure_context_cache creates a new one
                    self._cached_content_name = None
                    with GeminiMetadataExtractor._class_cache_lock:
                        GeminiMetadataExtractor._class_cache_name = None
                        GeminiMetadataExtractor._class_cached_tools = []
                    self._ensure_context_cache()
                    if self._cached_content_name and tools_match_cache:
                        config.cached_content = self._cached_content_name
                    else:
                        # Fallback to system instruction if cache recreation failed or tools don't match
                        system_instruction = "\n".join(self.INSTRUCTIONS)
                        config.system_instruction = system_instruction
                        logger.debug(
                            "Using system instruction (context cache unavailable or tools don't match cache)"
                        )
                else:
                    # Other error, log and fallback
                    logger.warning(
                        f"Failed to use context cache: {e}. Using system instruction instead."
                    )
                    system_instruction = "\n".join(self.INSTRUCTIONS)
                    config.system_instruction = system_instruction
        else:
            # Use system instruction (either caching disabled, no cache, or tools don't match)
            system_instruction = "\n".join(self.INSTRUCTIONS)
            config.system_instruction = system_instruction
            if tools and not tools_match_cache:
                logger.debug(
                    f"Using system instruction (tools {requested_tool_names} don't match cached tools {self._cached_tools})"
                )
            elif tools:
                logger.debug("Using system instruction (context cache not available)")
            else:
                logger.debug("Using system instruction (context cache not available)")

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
                    config.property_ordering = [
                        "artist",
                        "title",
                        "mix",
                        "year",
                        "country",
                        "label",
                        "genre",
                        "style",
                        "tags",
                        "audioFeatures",
                        "context",
                    ]
                except (AttributeError, TypeError, ValueError) as e:
                    logger.debug(f"property_ordering not supported: {e}")
                    pass  # property_ordering not supported, skip it
        except (AttributeError, TypeError) as e:
            # Parameters not supported in this SDK version - log and continue
            logger.debug(f"Some determinism parameters not available: {e}")

        # Add tools only if NOT using cached content (tools are already in cached content)
        if tools and not use_cached_content:
            config.tools = tools

        response = self.client.models.generate_content(
            model=self.MODEL,
            contents=user_content,
            config=config,
        )

        # Log context cache usage metadata
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = response.usage_metadata
            # Check for cached token usage (indicates context cache was used)
            cached_token_count = getattr(usage, "cached_content_token_count", 0)
            prompt_token_count = getattr(usage, "prompt_token_count", 0)
            total_token_count = getattr(usage, "total_token_count", 0)

            if cached_token_count > 0:
                cache_percentage = (
                    (cached_token_count / prompt_token_count * 100)
                    if prompt_token_count > 0
                    else 0
                )
                logger.info(
                    f"✅ Context cache used: {cached_token_count:,} cached tokens "
                    f"({cache_percentage:.1f}% of prompt tokens) - 90% discount applied"
                )
                logger.debug(
                    f"Token breakdown - Cached: {cached_token_count:,}, "
                    f"Non-cached prompt: {prompt_token_count - cached_token_count:,}, "
                    f"Output: {total_token_count - prompt_token_count:,}, "
                    f"Total: {total_token_count:,}"
                )
            else:
                logger.debug(
                    f"Context cache not used - Prompt tokens: {prompt_token_count:,}, "
                    f"Output tokens: {total_token_count - prompt_token_count:,}, "
                    f"Total: {total_token_count:,}"
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
                        logger.info(f"  {status_icon} {retrieved_url} - {status}")
                else:
                    logger.warning(
                        "URL context metadata not found in response. URLs may not have been fetched."
                    )

            # Log Google Search (grounding) metadata
            if self.enable_google_search and hasattr(candidate, "grounding_metadata"):
                grounding_metadata = candidate.grounding_metadata
                if grounding_metadata:
                    logger.info("Google Search (grounding) results:")
                    if hasattr(grounding_metadata, "grounding_chunks"):
                        chunks = grounding_metadata.grounding_chunks
                        logger.info(
                            f"  Found {len(chunks) if chunks else 0} search result chunks"
                        )
                        if chunks:
                            for i, chunk in enumerate(
                                chunks[:3], 1
                            ):  # Log first 3 results
                                if hasattr(chunk, "web"):
                                    web = chunk.web
                                    if hasattr(web, "uri"):
                                        logger.info(f"  {i}. {web.uri}")
                    if hasattr(grounding_metadata, "search_entry_point"):
                        entry_point = grounding_metadata.search_entry_point
                        if hasattr(entry_point, "rendered_content"):
                            logger.debug(
                                f"  Search query: {entry_point.rendered_content}"
                            )
                else:
                    logger.debug(
                        "Google Search metadata not found (may not have performed searches)"
                    )

        return response

    def _make_batch_api_call(
        self, user_content: str, urls: Optional[List[str]] = None, num_items: int = 1
    ):
        """
        Make a single API call to Gemini for multiple items (batch processing).

        This sends all items in one request with a shared system instruction,
        reducing token usage and API calls significantly.

        Args:
            user_content: Combined user message content for all items
            urls: Optional list of URLs to fetch using URL context tool
            num_items: Number of items being processed (for schema validation)

        Returns:
            Gemini API response

        Raises:
            Exception: If API call fails
        """
        # URLs are now included in the user_content prompt instead of using url_context tool
        # This allows us to use cached content (90% discount) since no tools are needed
        tools = []
        # if urls and len(urls) > 0:
        #    urls_to_use = list(set(urls))[
        #        :20
        #    ]  # Remove duplicates, limit to 20 for display
        #    if len(set(urls)) > 20:
        #        logger.info(
        #            f"Found {len(set(urls))} unique URLs, using first 20 in prompt. "
        #            f"URLs are included in user_content for LLM to retrieve data from."
        #        )
        #    else:
        #        logger.debug(
        #            f"URLs included in prompt for batch LLM retrieval: {len(urls_to_use)} unique URL(s)"
        #        )

        # Google Search is disabled by default - can be enabled if needed
        if self.enable_google_search:
            try:
                tools.append({"google_search": {}})
                logger.info("Enabling Google Search (grounding) for batch request")
            except Exception as e:
                logger.warning(f"Failed to enable Google Search tool: {e}")

        # Use batch schema for array response
        # Use context caching if available (90% discount on cached tokens)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=self.BATCH_RESPONSE_SCHEMA,
            temperature=self.temperature,
        )

        # Check if we can use cached content for batch
        # Cached content can be used if the tools we need are already in the cache
        requested_tool_names = []
        if tools:
            for tool in tools:
                if isinstance(tool, dict):
                    if "google_search" in tool:
                        requested_tool_names.append("google_search")
                    elif "url_context" in tool:
                        requested_tool_names.append("url_context")

        # Check if all requested tools are in the cache
        tools_match_cache = (
            not requested_tool_names  # No tools needed
            or all(
                tool in self._cached_tools for tool in requested_tool_names
            )  # All tools in cache
        )

        use_cached_content = (
            self.enable_context_cache
            and self._cached_content_name
            and tools_match_cache  # Tools must match what's in cache
        )

        if use_cached_content:
            try:
                config.cached_content = self._cached_content_name
                logger.debug(
                    f"Using context cache for batch: {self._cached_content_name} "
                    f"(tools in cache: {', '.join(self._cached_tools) if self._cached_tools else 'none'})"
                )
                # Don't add tools to config - they're already in the cached content
            except Exception as e:
                # Cache may have expired, try to recreate
                error_msg = str(e).lower()
                if (
                    "not found" in error_msg
                    or "expired" in error_msg
                    or "invalid" in error_msg
                ):
                    logger.info(
                        f"Context cache expired or invalid for batch: {e}. Recreating cache..."
                    )
                    # Clear both instance and class-level cache names so _ensure_context_cache creates a new one
                    self._cached_content_name = None
                    with GeminiMetadataExtractor._class_cache_lock:
                        GeminiMetadataExtractor._class_cache_name = None
                        GeminiMetadataExtractor._class_cached_tools = []
                    self._ensure_context_cache()
                    if self._cached_content_name and tools_match_cache:
                        config.cached_content = self._cached_content_name
                    else:
                        # Fallback to system instruction if cache recreation failed or tools don't match
                        system_instruction = "\n".join(self.INSTRUCTIONS)
                        config.system_instruction = system_instruction
                        logger.debug(
                            "Using system instruction for batch (context cache unavailable or tools don't match cache)"
                        )
                else:
                    # Other error, log and fallback
                    logger.warning(
                        f"Failed to use context cache for batch: {e}. Using system instruction instead."
                    )
                    system_instruction = "\n".join(self.INSTRUCTIONS)
                    config.system_instruction = system_instruction
        else:
            # Use system instruction (either caching disabled, no cache, or tools don't match)
            system_instruction = "\n".join(self.INSTRUCTIONS)
            config.system_instruction = system_instruction
            if tools and not tools_match_cache:
                logger.debug(
                    f"Using system instruction for batch (tools {requested_tool_names} don't match cached tools {self._cached_tools})"
                )
            else:
                logger.debug(
                    "Using system instruction for batch (context cache not available)"
                )

        # Add optional determinism parameters
        try:
            if hasattr(config, "top_p") and self.top_p is not None:
                config.top_p = self.top_p
            if hasattr(config, "top_k") and self.top_k is not None:
                config.top_k = self.top_k
            if hasattr(config, "seed") and self.seed is not None:
                config.seed = self.seed
        except (AttributeError, TypeError) as e:
            logger.debug(f"Some determinism parameters not available: {e}")

        # Add tools only if NOT using cached content (tools are already in cached content)
        if tools and not use_cached_content:
            config.tools = tools
        logger.info(
            f"Making batch API call for {num_items} items with shared system instruction"
        )
        response = self.client.models.generate_content(
            model=self.MODEL,
            contents=user_content,
            config=config,
        )

        # Log context cache usage metadata
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = response.usage_metadata
            # Check for cached token usage (indicates context cache was used)
            cached_token_count = getattr(usage, "cached_content_token_count", 0)
            prompt_token_count = getattr(usage, "prompt_token_count", 0)
            total_token_count = getattr(usage, "total_token_count", 0)

            if cached_token_count > 0:
                cache_percentage = (
                    (cached_token_count / prompt_token_count * 100)
                    if prompt_token_count > 0
                    else 0
                )
                logger.info(
                    f"✅ Context cache used for batch: {cached_token_count:,} cached tokens "
                    f"({cache_percentage:.1f}% of prompt tokens) - 90% discount applied"
                )
                logger.debug(
                    f"Batch token breakdown - Cached: {cached_token_count:,}, "
                    f"Non-cached prompt: {prompt_token_count - cached_token_count:,}, "
                    f"Output: {total_token_count - prompt_token_count:,}, "
                    f"Total: {total_token_count:,}"
                )
            else:
                logger.debug(
                    f"Context cache not used for batch - Prompt tokens: {prompt_token_count:,}, "
                    f"Output tokens: {total_token_count - prompt_token_count:,}, "
                    f"Total: {total_token_count:,}"
                )

        # Log tool usage metadata
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]

            # Log URL context metadata
            if urls and hasattr(candidate, "url_context_metadata"):
                url_metadata = candidate.url_context_metadata
                if url_metadata and hasattr(url_metadata, "url_metadata"):
                    logger.info(
                        f"URL context: {len(url_metadata.url_metadata)} URLs fetched"
                    )

            # Log Google Search metadata
            if self.enable_google_search and hasattr(candidate, "grounding_metadata"):
                grounding_metadata = candidate.grounding_metadata
                if grounding_metadata and hasattr(
                    grounding_metadata, "grounding_chunks"
                ):
                    chunks = grounding_metadata.grounding_chunks
                    logger.info(
                        f"Google Search: {len(chunks) if chunks else 0} result chunks found"
                    )

        return response

    def _parse_batch_response(
        self, response, expected_count: int
    ) -> List[Dict[str, Any]]:
        """
        Parse batch API response and extract array of metadata.

        Args:
            response: Gemini API response object
            expected_count: Expected number of items in the batch

        Returns:
            List of metadata dictionaries
        """
        # Parse response - Gemini returns parsed object directly when using response_schema
        if hasattr(response, "parsed") and response.parsed:
            batch_data = response.parsed
            if isinstance(batch_data, dict) and "results" in batch_data:
                results = batch_data["results"]
                if isinstance(results, list):
                    if len(results) == expected_count:
                        logger.info(
                            f"Successfully parsed batch response: {len(results)} items"
                        )
                        return results
                    else:
                        logger.warning(
                            f"Batch response has {len(results)} items, expected {expected_count}. "
                            "Padding or truncating as needed."
                        )
                        # Pad with empty metadata if needed
                        while len(results) < expected_count:
                            results.append(self._get_empty_metadata())
                        return results[:expected_count]
                else:
                    logger.error("Batch response 'results' is not a list")
                    return [self._get_empty_metadata()] * expected_count
            else:
                logger.error("Batch response missing 'results' field")
                return [self._get_empty_metadata()] * expected_count
        elif hasattr(response, "text") and response.text:
            # Fallback: parse JSON from text
            try:
                cleaned_content = self._clean_json_response(response.text)
                batch_data = json.loads(cleaned_content)
                if isinstance(batch_data, dict) and "results" in batch_data:
                    results = batch_data["results"]
                    if isinstance(results, list):
                        # Pad or truncate to expected count
                        while len(results) < expected_count:
                            results.append(self._get_empty_metadata())
                        return results[:expected_count]
                # If response is a list directly (old format), wrap it
                if isinstance(batch_data, list):
                    while len(batch_data) < expected_count:
                        batch_data.append(self._get_empty_metadata())
                    return batch_data[:expected_count]
                logger.error("Unexpected batch response format")
                return [self._get_empty_metadata()] * expected_count
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse batch JSON response: {e}")
                return [self._get_empty_metadata()] * expected_count
        else:
            logger.warning("Empty batch response from Gemini")
            return [self._get_empty_metadata()] * expected_count

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
