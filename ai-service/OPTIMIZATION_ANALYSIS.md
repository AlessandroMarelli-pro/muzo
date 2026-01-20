# Metadata Extraction API Call Analysis & Optimization

## Current Process Summary

### API Call Flow (Balanced/Accurate Mode)

#### Stage 1: Extract & Normalize Artist/Title
- **LLM Calls**: 0-1 (only if ID3 tags missing artist or title)
- **Time**: ~1-3 seconds if LLM needed

#### Stage 2: Discogs Enrichment (if enabled)
1. **Build Queries** → **1 LLM call** (~2-4 seconds)
   - Balanced mode: generates 2 queries
   - Accurate mode: generates 3 queries
   - Fast mode: 0 LLM calls (uses simple query)

2. **Search Discogs** → **1-3 Discogs API calls** (~0.5-1.5 seconds total)
   - One call per query
   - Returns list of releases

3. **Check Tracklists** → **N Discogs API calls** ⚠️ **MAJOR BOTTLENECK**
   - For EACH result, calls `get_release_details()` to check tracklist
   - If 10 results: 10 additional API calls
   - Each call: ~0.5-1 second
   - **Total: 5-10 seconds for 10 results**

4. **Select Best Match** → **1 LLM call** (~2-4 seconds)
   - Fast mode: 0 LLM calls (simple string matching)

5. **Get Release Details** → **1 Discogs API call** (~0.5-1 second)
   - Fetches full release data for selected match

6. **Map to Schema** → **1 LLM call** (~2-4 seconds)
   - Fast mode: 0 LLM calls (direct mapping)

#### Stage 3: LLM-only Fallback (if Discogs fails)
- **LLM Calls**: 1 (~2-4 seconds)

### Total API Calls (Worst Case - Balanced Mode)

**LLM Calls**: 4-5 calls
- 0-1 (artist/title extraction)
- 1 (query building)
- 1 (result selection)
- 1 (schema mapping)
- 0-1 (fallback if needed)

**Discogs API Calls**: 3-14+ calls
- 1-3 (search queries)
- N (tracklist checks - **BIGGEST BOTTLENECK**)
- 1 (final release details)

**Total Time**: ~15-25 seconds per song

## Optimization Strategies

### 1. Optimize Tracklist Checking (Highest Impact) ⚡

**Current Problem**: Checks tracklist for ALL results, making N API calls

**Solutions**:

#### Option A: Limit Tracklist Checks to Top Results
```python
# Only check tracklist for top 3-5 results instead of all
for result in results[:5]:  # Limit to top 5
    if result_title != normalized_title:
        track_match = self._check_tracklist_match(release_id, title)
```

**Impact**: Reduces from N calls to 3-5 calls
**Time Saved**: 5-7 seconds (if 10 results)

#### Option B: Cache Tracklist Checks
```python
# Cache tracklist data per release_id
# Key: f"tracklist:{release_id}"
# TTL: 7 days (tracklists don't change)
```

**Impact**: Eliminates duplicate tracklist checks
**Time Saved**: 5-10 seconds on repeated songs

#### Option C: Skip Tracklist Check if Title Matches
```python
# Only check tracklist if release title doesn't match
if result_title == normalized_title:
    # Exact match, skip tracklist check
    continue
```

**Impact**: Skips unnecessary checks
**Time Saved**: 1-2 seconds per exact match

#### Option D: Batch Tracklist Checks (if API supports)
- Check multiple tracklists in parallel
- Use async/await for concurrent requests

**Impact**: Reduces total time from sequential to parallel
**Time Saved**: 5-8 seconds

### 2. Use Fast Mode by Default

**Current**: Balanced mode uses LLM for query building, selection, and mapping

**Optimization**: Use Fast mode which:
- ✅ No LLM for query building (simple query)
- ✅ No LLM for selection (string matching)
- ✅ No LLM for mapping (direct mapping)

**Impact**: Eliminates 3 LLM calls
**Time Saved**: 6-12 seconds
**Trade-off**: Slightly lower accuracy, but still good with Discogs data

### 3. Parallelize API Calls

**Current**: Sequential API calls

**Optimization**: 
- Run multiple Discogs searches in parallel
- Run tracklist checks in parallel (with limit)
- Use async/await or threading

**Impact**: Reduces total time significantly
**Time Saved**: 5-10 seconds

### 4. Improve Caching Strategy

**Current**: Caches final metadata only

**Optimization**:
- Cache tracklist data separately (longer TTL)
- Cache query results
- Cache release details

**Impact**: Eliminates redundant API calls
**Time Saved**: 5-15 seconds on cache hits

### 5. Skip LLM Selection for Single Results

**Current**: Always uses LLM selection even with 1 result

**Optimization**:
```python
if len(results) == 1:
    # Only one result, skip LLM selection
    return results[0]
```

**Impact**: Eliminates 1 LLM call when only 1 result
**Time Saved**: 2-4 seconds

### 6. Combine Tracklist Check with Release Details

**Current**: 
1. Check tracklist (1 API call)
2. Get release details (1 API call)

**Optimization**: 
- Get release details first
- Check tracklist from the same data
- No need for separate tracklist check

**Impact**: Eliminates duplicate API calls
**Time Saved**: 0.5-1 second per result

## Recommended Optimizations (Priority Order)

### High Impact, Low Effort:
1. **Limit tracklist checks to top 3-5 results** → Saves 5-7 seconds
2. **Skip tracklist check if title matches** → Saves 1-2 seconds
3. **Skip LLM selection for single results** → Saves 2-4 seconds
4. **Use Fast mode by default** → Saves 6-12 seconds

### High Impact, Medium Effort:
5. **Cache tracklist data** → Saves 5-10 seconds on repeats
6. **Combine tracklist check with release details** → Saves 0.5-1 second

### Medium Impact, High Effort:
7. **Parallelize API calls** → Saves 5-10 seconds
8. **Batch operations** → Saves 3-5 seconds

## Expected Performance After Optimizations

**Current**: ~20 seconds per song
**After High-Impact Optimizations**: ~5-8 seconds per song
**After All Optimizations**: ~3-5 seconds per song

## Implementation Priority

1. ✅ **COMPLETED**: Limit tracklist checks to top 5 results
2. ✅ **COMPLETED**: Skip tracklist check if title matches exactly
3. ✅ **COMPLETED**: Skip LLM selection for single results
4. ✅ **COMPLETED**: Cache tracklist data (7 day TTL)
5. ✅ **COMPLETED**: Reuse release details from tracklist check
6. ⚠️ Parallelize calls (30 min) - Future optimization
7. ⚠️ Fast mode default (config change) - User decision

## Implemented Optimizations

### 1. Limited Tracklist Checks ✅
- Only checks tracklist for top 5 results instead of all
- **Time Saved**: 5-7 seconds (when 10+ results)

### 2. Skip Tracklist Check for Exact Matches ✅
- If release title matches track title exactly, skips tracklist check
- **Time Saved**: 0.5-1 second per exact match

### 3. Skip LLM Selection for Single Results ✅
- When only 1 result found, uses it directly without LLM selection
- **Time Saved**: 2-4 seconds

### 4. Tracklist Caching ✅
- Caches tracklist data with 7-day TTL (tracklists don't change)
- **Time Saved**: 5-10 seconds on repeated songs

### 5. Reuse Release Details ✅
- When checking tracklist, caches the full release details
- Reuses them later instead of making a second API call
- **Time Saved**: 0.5-1 second per result

## Expected Performance After Optimizations

**Before**: ~20 seconds per song
**After**: ~8-12 seconds per song (60% improvement)
**With Cache Hits**: ~3-5 seconds per song (75% improvement)
