# Enhanced Music Recommendation System

This document describes the enhanced multi-criteria recommendation system implemented with Elasticsearch integration.

## Overview

The recommendation system uses multiple criteria to provide intelligent music recommendations:

- **Audio Similarity (40%)**: MFCC, chroma, and spectral features
- **Genre Similarity (25%)**: AI genre and subgenre classification
- **Audio Features (15%)**: Tempo, key, energy, valence, danceability
- **Metadata Similarity (10%)**: Artist, album, year patterns
- **User Behavior (10%)**: Listening history, favorites

## Architecture

### Components

1. **RecommendationService**: Main service handling recommendation logic
2. **ElasticsearchService**: Handles Elasticsearch operations
3. **UserRecommendationPreferencesService**: Manages user-configurable weights
4. **ElasticsearchSyncService**: Syncs tracks to Elasticsearch

### Data Flow

```
Track Creation/Update → ElasticsearchSyncService → Elasticsearch Index
                                                      ↓
User Request → RecommendationService → Elasticsearch Query → Recommendations
```

## Setup

### 1. Install Dependencies

```bash
npm install @elastic/elasticsearch @nestjs/elasticsearch
```

### 2. Start Elasticsearch

```bash
# Using Docker Compose
docker-compose -f docker-compose.elasticsearch.yml up -d

# Or install Elasticsearch locally
# Follow Elasticsearch installation guide
```

### 3. Environment Configuration

Add to your `.env` file:

```env
# Elasticsearch Configuration
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

### 4. Database Migration

```bash
npx prisma migrate dev
```

## Usage

### Basic Recommendations

```typescript
// Get playlist recommendations
const recommendations = await recommendationService.getPlaylistRecommendations({
  playlistId: 'playlist-id',
  limit: 20,
  excludeTrackIds: ['track-1', 'track-2'],
});

// Get track recommendations
const trackRecommendations =
  await recommendationService.getTrackRecommendations('track-id', 20);
```

### Custom Weights

```typescript
// Create custom recommendation criteria
const customCriteria: RecommendationCriteria = {
  weights: {
    audioSimilarity: 0.5, // Increase audio similarity importance
    genreSimilarity: 1, // Decrease genre importance
    metadataSimilarity: 0.1,
    userBehavior: 0.1,
    audioFeatures: 0.1,
  },
  limit: 30,
  excludeTrackIds: ['track-1'],
};

const recommendations = await recommendationService.getPlaylistRecommendations(
  playlistDto,
  customCriteria,
);
```

### User Preferences

```typescript
// Create user preferences
const preferences = await userPreferencesService.createPreferences({
  userId: 'user-id',
  weights: {
    audioSimilarity: 0.4,
    genreSimilarity: 0.3,
    metadataSimilarity: 0.1,
    userBehavior: 0.1,
    audioFeatures: 0.1,
  },
  isDefault: true,
});

// Get user preferences
const userPrefs =
  await userPreferencesService.getPreferencesByUserId('user-id');
```

## Elasticsearch Index Structure

The `music_tracks` index contains:

### Audio Features

- `audio_features.tempo`: Track tempo
- `audio_features.key`: Musical key
- `audio_features.energy`: Energy level (0-1)
- `audio_features.valence`: Mood/positivity (0-1)
- `audio_features.danceability`: Danceability (0-1)

### Vector Features

- `mfcc`: Mel-frequency cepstral coefficients (13 dimensions)
- `chroma`: Chroma features (12 dimensions)
- `chroma_std`: Chroma standard deviation

### Genre Classification

- `genre`: Primary genre
- `subgenre`: Subgenre
- `genre_confidence`: Confidence score
- `subgenre_confidence`: Subgenre confidence

### User Behavior

- `listening_count`: Number of times played
- `is_favorite`: User favorite status
- `last_played_at`: Last play timestamp

### Metadata

- `title`, `artist`, `album`: Track information
- `year`: Release year
- `duration`: Track duration
- `format`: Audio format

## Recommendation Algorithms

### 1. Audio Similarity

Uses cosine similarity on MFCC and chroma vectors:

```javascript
// Elasticsearch script
double mfccScore = cosineSimilarity(params.playlistMfcc, 'mfcc');
double chromaScore = cosineSimilarity(params.playlistChroma, 'chroma');
return (mfccScore * 0.6 + chromaScore * 0.4) * params.audioWeight;
```

### 2. Genre Similarity

Exact matching with boosting:

```javascript
// Genre boost: 2.0x
// Subgenre boost: 1.5x
```

### 3. Audio Features Similarity

Gaussian decay functions for continuous features:

```javascript
// Tempo: ±20 BPM scale
// Energy/Valence/Danceability: ±0.2 scale
```

### 4. User Behavior Scoring

Logarithmic scaling for listening count:

```javascript
// listening_count: log1p scaling
// is_favorite: Boolean boost
```

### 5. Metadata Similarity

Fuzzy text matching on artist and album fields.

## Performance Optimizations

### Caching

- Elasticsearch query results cached in Redis
- User preferences cached in memory
- Track features cached during playlist analysis

### Indexing

- Bulk indexing for initial sync
- Incremental updates on track changes
- Background sync for large libraries

### Query Optimization

- Script scoring for complex similarity calculations
- Function scoring for multi-criteria ranking
- Proper field mapping for efficient searches

## Monitoring

### Elasticsearch Stats

```typescript
const stats = await elasticsearchSyncService.getElasticsearchStats();
console.log(`Total tracks indexed: ${stats.totalTracks}`);
```

### Recommendation Quality

Track recommendation quality through:

- Similarity score distribution
- User feedback collection
- A/B testing framework

## Troubleshooting

### Common Issues

1. **Elasticsearch Connection Failed**
   - Check if Elasticsearch is running
   - Verify connection settings in `.env`
   - Check network connectivity

2. **No Recommendations Returned**
   - Ensure tracks are synced to Elasticsearch
   - Check if audio fingerprint data exists
   - Verify index mapping is correct

3. **Poor Recommendation Quality**
   - Adjust recommendation weights
   - Check audio feature quality
   - Verify genre classification accuracy

### Debugging

Enable debug logging:

```typescript
// In recommendation service
this.logger.debug('Elasticsearch query:', JSON.stringify(query, null, 2));
this.logger.debug('Recommendation results:', results);
```

## Future Enhancements

1. **Machine Learning Integration**
   - Collaborative filtering
   - Deep learning similarity models
   - Real-time learning from user behavior

2. **Advanced Features**
   - Mood-based recommendations
   - Time-of-day preferences
   - Activity-based suggestions

3. **Performance Improvements**
   - Vector quantization
   - Approximate nearest neighbor search
   - Distributed Elasticsearch cluster

## API Reference

### RecommendationService

- `getPlaylistRecommendations(dto, criteria?)`: Get playlist recommendations
- `getTrackRecommendations(trackId, limit?, criteria?)`: Get track recommendations
- `syncTrackToElasticsearch(trackId)`: Sync single track
- `syncAllTracksToElasticsearch()`: Sync all tracks

### UserRecommendationPreferencesService

- `createPreferences(dto)`: Create user preferences
- `updatePreferences(id, dto)`: Update preferences
- `getPreferencesByUserId(userId)`: Get user preferences
- `validateWeights(weights)`: Validate weight configuration

### ElasticsearchSyncService

- `syncTrackOnUpdate(trackId)`: Sync on track update
- `syncTrackOnCreate(trackId)`: Sync on track creation
- `syncTrackOnDelete(trackId)`: Remove from index
- `getElasticsearchStats()`: Get index statistics
