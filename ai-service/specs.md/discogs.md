# Feature: Discogs + LLM Hybrid Metadata Enrichment

## Feature Summary

### Overview
Enhance metadata extraction by using Discogs as the primary source, with LLM (Gemini) for query building, result selection, and schema mapping. Keep existing LLM-only methods as fallback.

### Goals
- Improve accuracy: use authoritative Discogs data
- Improve consistency: same artist/title → same metadata
- Reduce costs: fewer LLM calls (mostly for selection/mapping)
- Maintain compatibility: existing API endpoints unchanged
- Configurable: speed vs accuracy modes

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  API Endpoint: /api/v1/audio/metadata/ai                │
│  (Unchanged - backward compatible)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  BaseMetadataExtractor.extract_metadata_from_filename() │
│  (Modified - orchestrates new flow)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │               │
        ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Stage 1:     │ │ Stage 2:     │ │ Stage 3:     │
│ Extract &    │ │ Discogs +    │ │ LLM Fallback │
│ Normalize    │ │ LLM          │ │ (Current)    │
│ Artist/Title │ │ Enrichment   │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
        │              │               │
        └──────────────┼───────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Redis Cache    │
              │  (Normalized    │
              │   artist/title) │
              └─────────────────┘
```

### Flow

1. Stage 1: Extract & normalize artist/title
   - ID3 tags → filename parsing → LLM fallback
   - Normalize (case, punctuation, whitespace)
   - Return: `{artist, title, mix, confidence, source}`

2. Stage 2: Discogs + LLM enrichment (if enabled)
   - Check cache (key: normalized artist/title/mix)
   - Build queries (LLM-assisted)
   - Search Discogs API
   - Select best match (LLM-assisted)
   - Get full release details
   - Map to schema (LLM-assisted)
   - Cache result

3. Stage 3: LLM-only fallback (if Discogs fails)
   - Current Gemini/OpenAI method
   - Uses normalized artist/title from Stage 1

4. Stage 4: Simple extraction (last resort)
   - ID3 tags + filename parsing only

### Configuration

Environment variables:
- `METADATA_PROVIDER=GEMINI` (GEMINI, OPENAI)
- `METADATA_MODE=balanced` (fast, balanced, accurate)
- `METADATA_USE_DISCOGS=true`
- `METADATA_USE_LLM_FALLBACK=true`
- `DISCOGS_USER_TOKEN=your_token`
- `DISCOGS_USE_LLM_SELECTION=true`
- `DISCOGS_MAX_RESULTS=10`
- `DISCOGS_MIN_CONFIDENCE=0.7`
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`
- `REDIS_CACHE_TTL_HOURS=24`

## Task Breakdown

### Phase 1: Foundation & Infrastructure (4-6 hours)

#### Task 1.1: Extend DiscogsConnector
- File: `ai-service/src/services/third_parties/discogs.py`
- Add `search_release(artist, title, year=None) -> List[Dict]`
  - Build Discogs query: `artist:"..." AND release_title:"..."`
  - Use existing `_make_api_call_with_retry()`
  - Return structured release data
- Add `get_release_details(release_id) -> Dict`
  - Fetch full release object
  - Extract: genres, styles, year, country, label, format, tracklist, credits, images
  - Return structured dict
- Add `normalize_query_text(text) -> str`
  - Clean for Discogs search (quotes, special chars)
- Testing: Unit tests for new methods

#### Task 1.2: Create MetadataCache Service
- File: `ai-service/src/services/metadata_cache.py` (new)
- Redis-based caching for metadata results
- Methods:
  - `get(artist, title, mix=None) -> Optional[Dict]`
  - `set(artist, title, mix, metadata, ttl)`
  - `_make_key(artist, title, mix) -> str` (normalized key)
  - `clear_pattern(pattern) -> int`
- Use existing `RedisCache` if available
- Key format: `metadata:{normalized_artist}:{normalized_title}:{normalized_mix}`
- TTL: configurable (default 24 hours)

#### Task 1.3: Create ArtistTitleExtractor
- File: `ai-service/src/services/artist_title_extractor.py` (new)
- Extract and normalize artist/title
- Priority: ID3 tags → filename parsing → LLM fallback
- Methods:
  - `extract_and_normalize(filename, id3_tags) -> Dict`
  - `_parse_filename(filename) -> Optional[Dict]`
  - `_normalize_artist_title(artist, title) -> Dict`
  - `_apply_cleanup(text) -> str`
  - `_smart_title_case(text) -> str`
- Returns: `{artist, title, mix, confidence, source}`
- Confidence: 0.0-1.0 (ID3=0.95, parsed=0.75, LLM=0.85, fallback=0.3)

#### Task 1.4: Configuration System
- File: `ai-service/src/config/metadata_config.py` (new)
- Class: `MetadataConfig`
- Load from env vars with defaults
- Properties:
  - Provider (GEMINI/OPENAI)
  - Mode (fast/balanced/accurate)
  - Discogs settings
  - Cache settings
  - Strategy flags
- Validation and error handling

### Phase 2: Discogs Enrichment Service (6-8 hours)

#### Task 2.1: Create DiscogsEnrichmentService
- File: `ai-service/src/services/discogs_enrichment_service.py` (new)
- Orchestrates Discogs + LLM workflow
- Dependencies: `DiscogsConnector`, `GeminiMetadataExtractor`, `MetadataConfig`
- Main method: `enrich_metadata(artist, title, mix, id3_tags) -> Optional[Dict]`
- Returns metadata dict or None (triggers fallback)

#### Task 2.2: LLM Query Building
- File: `ai-service/src/services/discogs_enrichment_service.py`
- Method: `_build_queries(artist, title, mix, id3_tags) -> List[str]`
- Gemini prompt:
  - Input: artist, title, mix, year, label (from ID3)
  - Output: 2-3 optimized Discogs queries
  - Mode variations:
    - Fast: single query, no LLM
    - Balanced: 2 queries, LLM generates
    - Accurate: 3 queries, LLM with reasoning
- Use Gemini structured outputs (JSON schema)
- Error handling: fallback to simple query if LLM fails

#### Task 2.3: Discogs Search Integration
- File: `ai-service/src/services/discogs_enrichment_service.py`
- Method: `_search_discogs(queries) -> List[Dict]`
- Try queries in priority order
- Use `DiscogsConnector.search_release()`
- Aggregate results, remove duplicates
- Limit to `DISCOGS_MAX_RESULTS`
- Error handling: return empty list on failure

#### Task 2.4: LLM Result Selection
- File: `ai-service/src/services/discogs_enrichment_service.py`
- Method: `_select_best_match(results, artist, title, id3_tags) -> Optional[Dict]`
- Gemini prompt:
  - Input: Discogs results + original input
  - Output: `{selected_index, confidence, reasoning}`
- Mode variations:
  - Fast: simple string matching (no LLM)
  - Balanced: LLM selection with confidence
  - Accurate: LLM selection with detailed reasoning
- Filter by `DISCOGS_MIN_CONFIDENCE`
- Return None if no match meets threshold

#### Task 2.5: Release Details Retrieval
- File: `ai-service/src/services/discogs_enrichment_service.py`
- Method: `_get_release_details(release_match) -> Dict`
- Use `DiscogsConnector.get_release_details(release_id)`
- Extract: genres, styles, year, country, label, format, tracklist, credits
- Error handling: return None on failure

#### Task 2.6: Schema Mapping (LLM)
- File: `ai-service/src/services/discogs_enrichment_service.py`
- Method: `_map_to_schema(release_data, artist, title, mix) -> Dict`
- Gemini prompt:
  - Input: Discogs release data
  - Output: metadata matching your schema
- Schema fields:
  - artist, title, mix, year, country, label
  - genre[], style[]
  - audioFeatures: {bpm, key, vocals, atmosphere[]}
  - context: {background, impact}
  - description, tags[]
- Use Gemini structured outputs
- Fill missing fields (BPM, key) with LLM knowledge if confident
- Validate against schema

### Phase 3: Integration (4-6 hours)

#### Task 3.1: Modify BaseMetadataExtractor
- File: `ai-service/src/services/base_metadata_extractor.py`
- Update `extract_metadata_from_filename()`:
  - Stage 1: Extract & normalize artist/title
  - Check cache
  - Stage 2: Try Discogs (if enabled)
  - Stage 3: Fallback to LLM-only (if enabled)
  - Stage 4: Simple extraction (last resort)
  - Cache result
- Keep existing method signature
- Maintain backward compatibility
- Add logging for each stage

#### Task 3.2: Add Configuration Checks
- File: `ai-service/src/services/base_metadata_extractor.py`
- Check `METADATA_USE_DISCOGS` flag
- Check `METADATA_USE_LLM_FALLBACK` flag
- Initialize `DiscogsEnrichmentService` if enabled
- Initialize `MetadataCache` if enabled
- Graceful degradation if services unavailable

#### Task 3.3: Update GeminiMetadataExtractor
- File: `ai-service/src/services/gemini_metadata_extractor.py`
- Add methods for Discogs-specific prompts:
  - `_build_discogs_query_prompt(artist, title, mix, id3_tags) -> str`
  - `_build_discogs_selection_prompt(results, input_data) -> str`
  - `_build_discogs_schema_mapping_prompt(release_data) -> str`
- Add structured output schemas for each prompt type
- Reuse existing `_make_api_call()` infrastructure

#### Task 3.4: Error Handling & Fallbacks
- File: `ai-service/src/services/base_metadata_extractor.py`
- Discogs errors → fallback to LLM
- LLM errors → fallback to simple extraction
- Network errors → retry with exponential backoff
- Rate limit errors → wait and retry, or fallback
- Log all fallback scenarios

### Phase 4: Testing & Refinement (4-6 hours)

#### Task 4.1: Unit Tests
- Test files:
  - `test_artist_title_extractor.py`
  - `test_discogs_enrichment_service.py`
  - `test_metadata_cache.py`
  - `test_discogs_connector_extensions.py`
- Coverage: >80% for new code
- Mock external dependencies (Discogs API, Gemini API, Redis)

#### Task 4.2: Integration Tests
- Test with sample files:
  - `/Users/alessandro/Music/tidal/Tracks/T-Fire - Say A Prayer.flac`
  - `/Users/alessandro/Music/Youtube/Music/T-Fire - Say A Prayer [Nigeria] Soul (1979).opus`
- Test scenarios:
  - Discogs success path
  - Discogs no results → LLM fallback
  - Discogs low confidence → LLM fallback
  - Discogs API error → LLM fallback
  - Cache hit path
  - All services unavailable → simple extraction

#### Task 4.3: Performance Testing
- Measure:
  - Cache hit rate
  - Average response time (Discogs vs LLM vs Simple)
  - API call counts (Discogs vs LLM)
  - Rate limit handling
- Optimize:
  - Query building efficiency
  - Cache TTL tuning
  - Confidence threshold tuning

#### Task 4.4: Configuration Testing
- Test all modes:
  - Fast mode (minimal LLM)
  - Balanced mode (default)
  - Accurate mode (max LLM)
- Test feature flags:
  - Discogs enabled/disabled
  - LLM fallback enabled/disabled
  - Cache enabled/disabled
- Verify backward compatibility

#### Task 4.5: Documentation
- Update README with:
  - Feature overview
  - Configuration options
  - Environment variables
  - Usage examples
- Add docstrings to all new methods
- Document prompt templates
- Add troubleshooting guide

### Phase 5: Deployment & Monitoring (2-3 hours)

#### Task 5.1: Environment Setup
- Add environment variables to `.env.example`
- Update deployment configs
- Verify Redis connection
- Verify Discogs API token

#### Task 5.2: Logging & Observability
- Add structured logging:
  - Stage transitions
  - Cache hits/misses
  - Discogs API calls
  - LLM calls
  - Fallback triggers
- Add performance metrics:
  - Response times per stage
  - Success rates per stage
  - API call counts

#### Task 5.3: Gradual Rollout
- Feature flag for gradual enablement
- Monitor error rates
- Monitor performance impact
- Monitor cost (Discogs API + LLM calls)

## Task Summary

| Phase | Task | Estimated Time | Dependencies |
|-------|------|----------------|--------------|
| 1.1 | Extend DiscogsConnector | 2-3 hours | None |
| 1.2 | Create MetadataCache | 1-2 hours | Redis |
| 1.3 | Create ArtistTitleExtractor | 1-2 hours | None |
| 1.4 | Configuration System | 1 hour | None |
| 2.1 | Create DiscogsEnrichmentService | 2 hours | 1.1, 1.4 |
| 2.2 | LLM Query Building | 1-2 hours | 2.1, Gemini |
| 2.3 | Discogs Search Integration | 1 hour | 2.1, 1.1 |
| 2.4 | LLM Result Selection | 1-2 hours | 2.1, Gemini |
| 2.5 | Release Details Retrieval | 1 hour | 2.1, 1.1 |
| 2.6 | Schema Mapping | 1-2 hours | 2.1, Gemini |
| 3.1 | Modify BaseMetadataExtractor | 2-3 hours | 2.1, 1.2, 1.3 |
| 3.2 | Add Configuration Checks | 1 hour | 3.1, 1.4 |
| 3.3 | Update GeminiMetadataExtractor | 1-2 hours | 2.2, 2.4, 2.6 |
| 3.4 | Error Handling | 1 hour | 3.1 |
| 4.1 | Unit Tests | 2-3 hours | All phases |
| 4.2 | Integration Tests | 1-2 hours | All phases |
| 4.3 | Performance Testing | 1 hour | All phases |
| 4.4 | Configuration Testing | 1 hour | All phases |
| 4.5 | Documentation | 1 hour | All phases |
| 5.1 | Environment Setup | 1 hour | All phases |
| 5.2 | Logging & Observability | 1 hour | All phases |
| 5.3 | Gradual Rollout | 1 hour | All phases |

Total estimated time: 24-35 hours

## Dependencies

External:
- `discogs_client` (already installed)
- `google-genai` (already installed)
- Redis (running)
- Discogs API token (configured)

Internal:
- `RedisCache` utility (if exists)
- `SimpleMetadataExtractor` (for ID3 tags)
- `SimpleFilenameParser` (for filename parsing)

## Success Criteria

1. Backward compatibility: existing API endpoints work unchanged
2. Accuracy: >90% of tracks find Discogs matches (as expected)
3. Consistency: same input returns same output (via caching)
4. Performance: average response time <5 seconds
5. Reliability: graceful fallbacks on errors
6. Cost: reduced LLM calls (Discogs primary, LLM for selection/mapping)

## Risk Mitigation

1. Discogs API rate limits: use existing rate limiter
2. Discogs not found: fallback to LLM
3. LLM failures: fallback to simple extraction
4. Redis unavailable: disable caching, continue
5. Configuration errors: sensible defaults, graceful degradation

This plan provides a clear roadmap for implementation. Should I start with Phase 1?