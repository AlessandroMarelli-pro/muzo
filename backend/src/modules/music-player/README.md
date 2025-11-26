# Music Player Module

This module provides comprehensive music playback functionality with support for seeking, waveform visualization, and audio analysis including beat detection and energy visualization.

## Features

### Core Playback Features

- **Play/Pause/Resume/Stop**: Basic playback controls
- **Seek**: Jump to any position in the audio file
- **Volume Control**: Adjust playback volume (0-1)
- **Playback Rate**: Change playback speed (0.25x - 4x)
- **Session Management**: Track active playback sessions

### Waveform Generation

- **Visual Waveform**: Generate waveform data for audio visualization
- **Configurable Resolution**: Adjust waveform detail level
- **Segment Support**: Get waveform data for specific time ranges
- **Multiple Formats**: Support for MP3, WAV, FLAC, M4A, AAC, OGG

### Audio Analysis

- **Beat Detection**: Identify beats with confidence scores
- **Energy Analysis**: Track energy levels over time
- **Tempo Estimation**: Calculate BPM
- **Key Detection**: Identify musical key and mode
- **Audio Features**: Danceability, valence, acousticness, etc.
- **Real-time Analysis**: Get current beat and energy at any timestamp

### Audio Streaming

- **HTTP Range Support**: Efficient seeking with partial content requests
- **Multiple Formats**: Automatic content-type detection
- **Caching**: Optimized for repeated access

## API Endpoints

### GraphQL Queries

```graphql
# Get current playback state
getPlaybackState(trackId: String!): PlaybackState

# Get all active playback sessions
getActiveSessions: [PlaybackSession!]!

# Get waveform data for visualization
getWaveformData(trackId: String!): [Float!]!
getDetailedWaveformData(trackId: String!): WaveformData!

# Get audio analysis data
getAudioAnalysis(trackId: String!): AudioAnalysisResult!
getRealTimeAnalysis(trackId: String!, currentTime: Float!): RealTimeAnalysis!
getBeatData(trackId: String!): [BeatData!]!
getEnergyData(trackId: String!): [EnergyData!]!

# Get streaming URL
getAudioStreamUrl(trackId: String!): String!
getAudioInfo(trackId: String!): AudioInfo!
```

### GraphQL Mutations

```graphql
# Playback control
playTrack(trackId: String!, startTime: Float = 0): PlaybackState!
pauseTrack(trackId: String!): PlaybackState!
resumeTrack(trackId: String!): PlaybackState!
seekTrack(trackId: String!, timeInSeconds: Float!): PlaybackState!
stopTrack(trackId: String!): Boolean!

# Audio settings
setVolume(trackId: String!, volume: Float!): PlaybackState!
setPlaybackRate(trackId: String!, rate: Float!): PlaybackState!
```

### REST Endpoints

```
GET /api/audio/stream/:trackId - Stream audio file with range support
GET /api/audio/info/:trackId - Get audio file information
GET /api/audio/waveform/:trackId - Get waveform data
GET /api/audio/analysis/:trackId - Get audio analysis data
```

## Usage Examples

### Basic Playback

```typescript
// Start playing a track
const playbackState = await playTrack({
  trackId: 'track-id-123',
  startTime: 0,
});

// Seek to 30 seconds
await seekTrack({
  trackId: 'track-id-123',
  timeInSeconds: 30,
});

// Pause playback
await pauseTrack('track-id-123');
```

### Waveform Visualization

```typescript
// Get waveform data for visualization
const waveformData = await getWaveformData('track-id-123');

// Get detailed waveform with metadata
const detailedWaveform = await getDetailedWaveformData('track-id-123');
console.log(`Duration: ${detailedWaveform.duration}s`);
console.log(`Sample Rate: ${detailedWaveform.sampleRate}Hz`);
```

### Beat and Energy Analysis

```typescript
// Get beat detection data
const beats = await getBeatData('track-id-123');
beats.forEach((beat) => {
  console.log(`Beat at ${beat.timestamp}s with ${beat.confidence} confidence`);
});

// Get real-time analysis for current playback position
const realTimeData = await getRealTimeAnalysis('track-id-123', 45.5);
console.log(`Current energy: ${realTimeData.currentEnergy}`);
console.log(`Next beat in: ${realTimeData.nextBeatEstimate - 45.5}s`);
```

### Audio Streaming

```html
<!-- HTML5 Audio with seeking support -->
<audio controls>
  <source src="/api/audio/stream/track-id-123" type="audio/mpeg" />
</audio>
```

## Data Types

### PlaybackState

- `trackId`: Current track ID
- `isPlaying`: Whether audio is playing
- `currentTime`: Current playback position (seconds)
- `duration`: Total track duration (seconds)
- `volume`: Current volume (0-1)
- `playbackRate`: Current playback speed

### WaveformData

- `peaks`: Array of amplitude values for visualization
- `duration`: Track duration in seconds
- `sampleRate`: Audio sample rate
- `channels`: Number of audio channels
- `bitDepth`: Audio bit depth

### AudioAnalysisResult

- `beats`: Array of detected beats with timestamps and confidence
- `energy`: Energy levels over time
- `tempo`: Estimated BPM
- `key`: Musical key
- `mode`: Major or minor
- `danceability`: How suitable for dancing (0-1)
- `valence`: Musical positivity (0-1)
- `acousticness`: Acoustic vs electronic (0-1)

## Implementation Notes

### Mock Data

Currently, the waveform and audio analysis services generate mock data for demonstration purposes. In a production environment, you would integrate with actual audio processing libraries such as:

- **Waveform Generation**: `node-ffmpeg`, `web-audio-api`, or `wavefile`
- **Audio Analysis**: `aubio`, `essentia.js`, or `meyda`
- **Beat Detection**: `beat-detector`, `onset-detector`

### Performance Considerations

- Waveform data is cached and can be pre-computed
- Audio analysis results should be stored in the database
- Use HTTP range requests for efficient seeking
- Implement proper error handling for missing files
- Consider using Web Workers for heavy audio processing

### Security

- All file access is validated against the database
- File paths are never exposed to the client
- Audio streaming includes proper content-type headers
- Rate limiting should be implemented for API endpoints

## Future Enhancements

- WebSocket subscriptions for real-time playback events
- Playlist management integration
- Audio effects and filters
- Crossfading between tracks
- Advanced audio analysis (chord detection, structure analysis)
- Integration with external audio analysis services
