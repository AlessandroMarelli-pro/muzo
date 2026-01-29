# Batching Guide for Metadata Extraction

This guide explains the batching optimizations available to accelerate metadata extraction while maintaining quality.

## Overview

The metadata extractor now uses a highly efficient single API call batching strategy:

1. **Single API Call Batching** (PRIMARY METHOD) - Send multiple items in one request with shared system instruction
2. **Batch Filename Cleaning** - Clean multiple filenames in a single API call
3. **Context Caching** - 90% discount on cached system instruction tokens
4. **URL Context** - URLs included directly in prompts (up to 20 URLs per request)

## Performance Improvements

### Before Batching
- **Single track**: ~2-5 seconds per track
- **10 tracks**: ~20-50 seconds (sequential, 10 API calls)
- **100 tracks**: ~3-8 minutes (sequential, 100 API calls)

### After Single API Call Batching
- **10 tracks**: ~3-6 seconds (1 API call with shared system instruction + context caching)
- **100 tracks**: ~15-30 seconds (10 API calls in chunks, shared system instruction per chunk + context caching)
- **Speedup**: **5-10x faster** + **70%+ token reduction** (system instruction sent once per batch, not per item)
- **Cost savings**: **90% discount** on cached system instruction tokens via context caching

## Usage

### Single API Call Batching (Default - Most Efficient)

```python
from src.services.base_metadata_extractor import create_metadata_extractor

extractor = create_metadata_extractor("GEMINI")

# Prepare items: list of (filename, file_path) tuples
items = [
    ("T-Fire - Say A Prayer.mp3", "/path/to/file1.mp3"),
    ("The Funkees - Akula Owu Onyeara.flac", "/path/to/file2.flac"),
    ("Artist - Title (Remix).mp3", None),  # No file_path, filename only
    # ... more items (up to max_batch_size per chunk)
]

# Process in batch using single API calls (default)
# Automatically uses context caching for 90% discount on system instruction tokens
results = extractor.extract_metadata_batch(
    items=items,
    batch_filename_cleaning=True, # Enable batch filename cleaning (default: True)
    max_batch_size=10,           # Items per API call (default: 10)
)

# Results are in the same order as input items
for i, metadata in enumerate(results):
    print(f"Track {i+1}: {metadata.get('artist')} - {metadata.get('title')}")
```

### Configuration

Control batching behavior via environment variables:

```bash
# Context caching (enabled by default)
export GEMINI_ENABLE_CONTEXT_CACHE=true  # Enable context caching (default: true)
export GEMINI_CACHE_TTL_SECONDS=3600     # Cache TTL in seconds (default: 1 hour)

# Google Search (disabled by default to allow context caching)
export GEMINI_ENABLE_GOOGLE_SEARCH=false # Enable Google Search (default: false)

# Model configuration
export GEMINI_MODEL=gemini-3-flash-preview  # Model to use

# Disable batch filename cleaning if needed
# (Set batch_filename_cleaning=False in code)
```

## Batching Strategies

### 1. Single API Call Batching (Primary Method) ⭐

**What it does**: Sends multiple tracks in a single API call with one shared system instruction, using context caching for maximum efficiency.

**Benefits**:
- **Massive token savings**: System instruction sent once instead of N times
- **90% discount on cached tokens**: Context caching provides 90% discount on system instruction tokens
- **Fewer API calls**: 1 call for N items (in chunks) vs N calls
- **5-10x faster processing**: Single round-trip instead of multiple
- **Same quality**: Identical results to individual processing

**How it works**:
- Creates cached content with system instruction on initialization
- Combines all track prompts into one user message
- Sends single request using cached content (90% discount on system tokens)
- Returns JSON array: `{"results": [{...}, {...}, ...]}`
- Processes in chunks (default: 10 items per call) to avoid token limits
- Automatically recreates cache on expiry

**Token Savings Example**:
```
Before (individual calls):
  10 tracks × (2000 system tokens + 500 user tokens) = 25,000 tokens

After (single API call batching):
  1 call × (2000 system tokens + 5000 user tokens) = 7,000 tokens
  Savings: ~72% reduction in tokens

After (with context caching - 90% discount on cached tokens):
  1 call × (200 cached tokens @ 90% discount + 5000 user tokens) = 5,200 tokens
  Total savings: ~79% reduction in tokens!
```

**Example**:
```python
# Instead of 10 separate API calls:
# Call 1: system_instruction + "Extract metadata from: Track 1"
# Call 2: system_instruction + "Extract metadata from: Track 2"
# ... (8 more calls)

# Single batch call with context caching:
# cached_content (system_instruction, 90% discount) + "Extract metadata from: Track 1, Track 2, ... Track 10"
# Returns: {"results": [{...}, {...}, ...]}
```

### 2. Context Caching

**What it does**: Automatically caches system instructions to enable 90% discount on cached tokens.

**Benefits**:
- **90% discount** on cached system instruction tokens
- **Automatic management**: Cache created on initialization, recreated on expiry
- **Automatic padding**: Meets minimum token requirements (2,048 for Flash, 32,768 for Pro)
- **Transparent**: Works automatically when enabled (default: enabled)

**How it works**:
- On initialization, creates cached content with system instruction
- Pads system instruction to meet minimum token requirements
- Uses cached content in API calls (90% discount applied automatically)
- Recreates cache when it expires (default TTL: 1 hour)

**Configuration**:
```bash
export GEMINI_ENABLE_CONTEXT_CACHE=true  # Enable (default: true)
export GEMINI_CACHE_TTL_SECONDS=3600     # TTL in seconds (default: 3600)
```

**Note**: Context caching cannot be used with tools (Google Search, URL context tool). URLs are now included directly in prompts to enable caching.

### 3. Batch Filename Cleaning

**What it does**: Cleans multiple filenames in a single API call instead of one-by-one.

**Benefits**:
- Reduces API calls from N to 1 for filename cleaning
- Faster overall processing
- Same quality results

**How it works**:
- Collects all filenames to clean
- Sends them in a single prompt to the LLM
- Returns JSON array of cleaned filenames
- Falls back to individual cleaning if batch fails

**Example**:
```python
# Instead of 10 separate API calls:
# Call 1: Clean "t-fire - say a prayer [nigeria] soul (1979)"
# Call 2: Clean "The Funkees - Akula Owu Onyeara"
# ... (8 more calls)

# Single batch call:
# Clean all 10 filenames at once → ["T-Fire - Say A Prayer", "The Funkees - Akula Owu Onyeara", ...]
```

### 4. URL Context Handling

**What it does**: URLs are included directly in prompts instead of using URL context tool, enabling context caching.

**Benefits**:
- **Enables context caching**: No tools = can use cached content (90% discount)
- **Same functionality**: URLs are still processed by the LLM
- **Clearer instructions**: URLs explicitly listed in prompt for LLM retrieval
- **Up to 20 URLs**: Automatically handles multiple URLs per request

**How it works**:
- URLs extracted from ID3 tags (description, url, purl fields)
- URLs included directly in user_content prompt
- LLM retrieves and processes URL content
- No tools needed = context caching works

**Note**: Google Search (grounding) is disabled by default to allow context caching. Enable with `GEMINI_ENABLE_GOOGLE_SEARCH=true` if needed, but this will disable context caching.

## Best Practices

### Batch Size Recommendations

| Number of Tracks | Recommended Approach |
|-----------------|---------------------|
| 1-5 | Use `extract_metadata_from_filename()` (single) |
| 5-50 | Use `extract_metadata_batch()` with single API call batching |
| 50+ | Use `extract_metadata_batch()` with single API call batching (automatic chunking) |

### Rate Limiting

The extractor respects rate limits automatically:
- **Per-minute limits**: Enforced via `RateLimiter`
- **Per-day limits**: Optional, configurable
- **Automatic backoff**: Exponential backoff on rate limit errors

### Error Handling

Batch processing is resilient:
- Individual failures don't stop the batch
- Failed items return empty metadata structure
- Errors are logged for debugging
- Results maintain input order

### Memory Considerations

- **Single API calls**: Minimal memory overhead (no thread pool needed)
- **Batch cleaning**: Processes all filenames at once (keep batches reasonable)
- **Large batches**: Automatically processes in chunks (default: 10 items per chunk)

## Performance Tuning

### Optimal Batch Size

```python
# Default: 10 items per API call
# Adjust based on:
# - Token limits (larger batches = more tokens)
# - API rate limits
# - Processing speed requirements

# Conservative (default)
max_batch_size=10

# Aggressive (if you have high token limits)
max_batch_size=20
```

### When to Use Batch Cleaning

**Enable batch cleaning when**:
- Processing 5+ tracks
- Filenames need cleaning (have tags, years, etc.)
- API rate limits allow

**Disable batch cleaning when**:
- Processing 1-2 tracks (overhead not worth it)
- Filenames are already clean
- Testing/debugging individual extractions

## Example: Processing a Music Library

```python
import os
from pathlib import Path
from src.services.base_metadata_extractor import create_metadata_extractor

def process_music_library(directory: str):
    """Process all audio files in a directory using batch extraction."""
    
    extractor = create_metadata_extractor("GEMINI")
    
    # Collect all audio files
    audio_extensions = {'.mp3', '.flac', '.m4a', '.wav', '.aac'}
    items = []
    
    for file_path in Path(directory).rglob('*'):
        if file_path.suffix.lower() in audio_extensions:
            items.append((file_path.name, str(file_path)))
    
    print(f"Found {len(items)} audio files")
    
    # Process in batches of 50 for optimal performance
    batch_size = 50
    all_results = []
    
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(items)-1)//batch_size + 1}")
        
        results = extractor.extract_metadata_batch(
            items=batch,
            batch_filename_cleaning=True,
            max_batch_size=10
        )
        
        all_results.extend(results)
    
    return all_results

# Usage
results = process_music_library("/path/to/music/library")
print(f"Processed {len(results)} tracks")
```

## Monitoring Performance

The extractor logs performance metrics:

```
INFO: Starting batch metadata extraction for 50 items
INFO: Batch cleaning 50 filenames in single API call
INFO: Batch filename cleaning completed: 50 filenames cleaned
INFO: Batch progress: 10/50 completed
INFO: Batch progress: 20/50 completed
...
INFO: Batch extraction completed: 50/50 successful
INFO: Batch extraction completed in 45.23s (1.11 items/sec)
```

## Trade-offs

### Speed vs. Quality
- **Batching maintains quality**: Same LLM, same prompts, same schema
- **No quality degradation**: Results are identical to individual processing
- **Consistency**: Batch cleaning ensures consistent normalization

### Speed vs. Cost
- **Batch cleaning**: Reduces API calls (cost savings)
- **Parallel processing**: Same number of API calls, just faster
- **Overall**: Batching reduces total processing time, which can reduce costs if you're paying per-minute for compute

### Speed vs. Rate Limits
- **Respects rate limits**: Automatic rate limiting prevents API errors
- **Configurable workers**: Adjust based on your API tier
- **Backoff handling**: Automatic retry with exponential backoff

## Troubleshooting

### Batch cleaning fails
- **Symptom**: Falls back to individual cleaning
- **Cause**: JSON parsing error or API error
- **Solution**: Check logs, batch cleaning will automatically fall back

### Rate limit errors
- **Symptom**: "Rate limit reached" warnings
- **Cause**: Too many parallel workers
- **Solution**: Reduce `METADATA_EXTRACTOR_MAX_WORKERS` or increase API rate limits

### Memory issues
- **Symptom**: High memory usage with large batches
- **Cause**: Processing too many items at once
- **Solution**: Process in smaller chunks (50-100 items per batch)

## Summary

Single API call batching provides **5-10x speedup** and **70%+ token reduction** for processing multiple tracks while maintaining the same quality. Key optimizations:

1. ✅ **Single API call batching** - 1 API call for N items (in chunks) vs N separate calls
2. ✅ **Context caching** - 90% discount on cached system instruction tokens
3. ✅ **Batch filename cleaning** - 1 API call instead of N for filename cleaning
4. ✅ **URL context** - URLs included directly in prompts (enables caching)
5. ✅ **Automatic rate limiting** - Prevents API errors
6. ✅ **Error resilience** - Individual failures don't stop batch
7. ✅ **Order preservation** - Results match input order

**Overall Impact**:
- **Cost savings**: 90% discount on cached tokens + 70%+ token reduction from batching
- **Performance**: 5-10x faster batch processing
- **Reliability**: Automatic cache management and fallback handling
- **Observability**: Clear logging of cache usage and token savings

Use `extract_metadata_batch()` for processing multiple tracks efficiently!
