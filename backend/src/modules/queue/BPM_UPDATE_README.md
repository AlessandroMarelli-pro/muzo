# BPM Update Queue System

This document describes the BPM (Beats Per Minute) update queue system that allows scanning all libraries to update only the BPM field using the AI service's BPM detection API.

## Overview

The BPM update system provides a scalable, queue-based approach to update BPM values for audio tracks across all libraries. It uses the same architecture as the existing audio scan queue but focuses specifically on BPM detection.

## Components

### 1. AI Integration Service (`ai-integration.service.ts`)

**New Method: `detectBPM()`**

```typescript
async detectBPM(
  audioFilePath: string,
  strategy: 'multi' | 'fft' | 'adaptive' = 'multi',
  sampleDuration: number = 10.0,
  skipIntro: number = 15.0,
  skipOutro: number = 15.0,
): Promise<any>
```

**Features:**

- Supports multiple detection strategies (multi, fft, adaptive)
- Configurable sample duration and skip parameters
- Uses the same connection pooling as other AI service methods
- Comprehensive error handling and logging

### 2. Queue Service (`queue.service.ts`)

**New Interfaces:**

```typescript
export interface BPMUpdateJobData {
  trackId: string;
  filePath: string;
  fileName: string;
  libraryId: string;
  strategy?: 'multi' | 'fft' | 'adaptive';
  sampleDuration?: number;
  skipIntro?: number;
  skipOutro?: number;
  index?: number;
  totalFiles?: number;
}
```

**New Methods:**

- `scheduleBPMUpdate()` - Schedule BPM update for a single track
- `scheduleBatchBPMUpdates()` - Schedule BPM updates for multiple tracks
- `scheduleLibraryBPMUpdate()` - Schedule BPM updates for all tracks in a library (placeholder)

**Updated Methods:**

- `getQueueStats()` - Now includes BPM update queue statistics
- `clearAllQueues()` - Now clears BPM update queue
- `pauseAllQueues()` - Now pauses BPM update queue
- `resumeAllQueues()` - Now resumes BPM update queue

### 3. BPM Update Processor (`processors/bpm-update.processor.ts`)

**Features:**

- Processes BPM update jobs from the queue
- Validates file existence before processing
- Updates track analysis status during processing
- Stores BPM results in the database
- Handles errors gracefully with proper status updates
- Integrates with progress tracking service

**Database Updates:**

- `detectedBpm` - The detected BPM value (rounded to 2 decimal places)
- `bpmConfidence` - Confidence score (rounded to 3 decimal places)
- `bpmStrategy` - Strategy used for detection
- `bpmProcessingTime` - Processing time in seconds
- `bpmAllResults` - JSON array of all detection results
- `bpmParameters` - JSON object of parameters used

### 4. Queue Module (`queue.module.ts`)

**Updates:**

- Added `bpm-update` queue registration
- Added `BPMUpdateProcessor` to providers
- Added Bull Board integration for BPM update queue monitoring

### 5. Queue Controller (`queue.controller.ts`)

**New Endpoints:**

#### Update Single Track BPM

```
POST /queue/bpm-update/:trackId
```

**Request Body:**

```json
{
  "strategy": "multi",
  "sampleDuration": 10.0,
  "skipIntro": 15.0,
  "skipOutro": 15.0
}
```

#### Update Library BPM

```
POST /queue/bpm-update-library/:libraryId
```

**Request Body:**

```json
{
  "strategy": "multi",
  "sampleDuration": 10.0,
  "skipIntro": 15.0,
  "skipOutro": 15.0
}
```

#### Update All Tracks BPM

```
POST /queue/bpm-update-all
```

**Request Body:**

```json
{
  "strategy": "multi",
  "sampleDuration": 10.0,
  "skipIntro": 15.0,
  "skipOutro": 15.0
}
```

## Usage Examples

### 1. Update BPM for a Single Track

```bash
curl -X POST http://localhost:3000/queue/bpm-update/track-id-123 \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "multi",
    "sampleDuration": 15.0,
    "skipIntro": 10.0,
    "skipOutro": 5.0
  }'
```

### 2. Update BPM for All Tracks in a Library

```bash
curl -X POST http://localhost:3000/queue/bpm-update-library/library-id-456 \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "fft",
    "sampleDuration": 20.0
  }'
```

### 3. Update BPM for All Tracks Across All Libraries

```bash
curl -X POST http://localhost:3000/queue/bpm-update-all \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "adaptive",
    "sampleDuration": 12.0,
    "skipIntro": 20.0,
    "skipOutro": 10.0
  }'
```

### 4. Check Queue Statistics

```bash
curl -X GET http://localhost:3000/queue/stats
```

**Response:**

```json
{
  "libraryScan": {
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0
  },
  "audioScan": {
    "waiting": 0,
    "active": 0,
    "completed": 150,
    "failed": 2
  },
  "bpmUpdate": {
    "waiting": 25,
    "active": 3,
    "completed": 75,
    "failed": 1
  }
}
```

## BPM Detection Strategies

### Multi-Strategy (Default)

- Combines multiple detection algorithms
- Best for general-purpose BPM detection across all music genres
- Most accurate but slowest

### FFT-Based

- Uses Fast Fourier Transform to analyze frequency domain
- Best for electronic music, dance music, and songs with strong rhythmic elements
- Fastest for rhythmic music

### Adaptive

- Automatically detects if the audio has beats and chooses appropriate strategy
- Uses FFT-based detection for rhythmic music
- Uses spectral flux for melodic music without beats
- Best for mixed music collections

## Configuration Parameters

- **sampleDuration**: Duration of sample to analyze in seconds (default: 10.0)
- **skipIntro**: Seconds to skip from beginning (default: 15.0)
- **skipOutro**: Seconds to skip from end (default: 15.0)

## Monitoring

### Queue Dashboard

Access the Bull Board dashboard at: `http://localhost:3000/queues`

### Progress Tracking

The system integrates with the existing progress tracking service to provide real-time updates on BPM processing progress.

### Error Handling

- Failed jobs are retried according to queue configuration
- Error messages are stored in the `analysisError` field
- Failed tracks are marked with `AnalysisStatus.FAILED`

## Database Schema Updates

The following fields are added to the `MusicTrack` model:

```typescript
detectedBpm?: number;           // Detected BPM value
bpmConfidence?: number;         // Confidence score
bpmStrategy?: string;           // Strategy used
bpmProcessingTime?: number;     // Processing time
bpmAllResults?: string;         // JSON array of all results
bpmParameters?: string;         // JSON object of parameters
```

## Performance Considerations

- **Batch Processing**: Use batch endpoints for better performance
- **Concurrency**: Queue processes multiple jobs concurrently
- **Resource Usage**: BPM detection is CPU-intensive, monitor system resources
- **File Access**: Ensure audio files are accessible from the backend service

## Future Enhancements

1. **Library BPM Update**: Implement the `scheduleLibraryBPMUpdate()` method
2. **Incremental Updates**: Only update tracks that haven't been processed recently
3. **Priority Queues**: Add priority levels for different types of BPM updates
4. **Caching**: Implement caching for frequently accessed tracks
5. **Analytics**: Add BPM distribution analytics and reporting

## Error Scenarios

1. **File Not Found**: Track file path doesn't exist
2. **AI Service Unavailable**: No healthy AI service instances
3. **Invalid Parameters**: Invalid strategy or parameter values
4. **Database Errors**: Track not found or update failures
5. **Processing Timeouts**: AI service takes too long to respond

## Testing

Use the provided test endpoints to verify functionality:

```bash
# Test single track
curl -X POST http://localhost:3000/queue/bpm-update/test-track-id

# Test library
curl -X POST http://localhost:3000/queue/bpm-update-library/test-library-id

# Test all tracks
curl -X POST http://localhost:3000/queue/bpm-update-all
```

## Integration with Existing Systems

The BPM update system integrates seamlessly with:

- **Progress Tracking Service**: Real-time progress updates
- **AI Integration Service**: Uses existing connection pooling
- **Queue Management**: Follows same patterns as audio scan queue
- **Database**: Uses existing Prisma service and models
- **Logging**: Comprehensive logging throughout the system
