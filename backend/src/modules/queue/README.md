# Queue System Documentation

This document describes the queued file scanning system implemented using BullMQ and @nestjs/bullmq.

## Overview

The queue system provides asynchronous processing for audio file scanning and analysis. It consists of two main queues:

1. **library-scan**: Scans music libraries and discovers audio files
2. **audio-scan**: Analyzes individual audio files and stores metadata

## Architecture

### Queue Flow

```
Library Scan Queue → Audio Scan Queue → Database Storage
     ↓                    ↓                    ↓
Scan directories    Analyze audio files   Store MusicTrack,
for audio files     with AI service       AudioFingerprint,
                                        AIAnalysisResult
```

### Components

- **QueueService**: Manages job scheduling and queue operations
- **LibraryScanProcessor**: Processes library scan jobs
- **AudioScanProcessor**: Processes individual audio file analysis
- **QueueController**: HTTP API for queue management

## Configuration

### Redis Setup with Docker

The queue system uses Redis for job management. Redis is configured to run in a Docker container for easy development and deployment.

#### Quick Start

```bash
# Start Redis container
npm run redis:up

# Check Redis status
npm run redis:logs

# Access Redis CLI
npm run redis:cli

# Stop Redis container
npm run redis:down
```

#### Docker Compose Files

- `docker-compose.dev.yml` - Development Redis container
- `docker-compose.yml` - Production Redis container

#### Environment Variables

```bash
# Redis Configuration (Docker container)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Queue Configuration
LIBRARY_SCAN_CONCURRENCY=2
LIBRARY_SCAN_ATTEMPTS=3
LIBRARY_SCAN_BACKOFF_DELAY=2000
AUDIO_SCAN_CONCURRENCY=5
AUDIO_SCAN_ATTEMPTS=3
AUDIO_SCAN_BACKOFF_DELAY=1000
```

### Queue Settings

- **Library Scan**: 2 concurrent jobs, 3 retry attempts
- **Audio Scan**: 5 concurrent jobs, 3 retry attempts
- **Backoff Strategy**: Exponential backoff with configurable delays

## Usage

### Starting Library Scans

#### Scan All Libraries

```bash
POST /queue/scan-all-libraries
```

#### Scan Specific Library

```bash
POST /queue/scan-library/{libraryId}
```

### Queue Management

#### Get Queue Statistics

```bash
GET /queue/stats
```

Response:

```json
{
  "libraryScan": {
    "waiting": 0,
    "active": 1,
    "completed": 5,
    "failed": 0
  },
  "audioScan": {
    "waiting": 10,
    "active": 3,
    "completed": 150,
    "failed": 2
  }
}
```

#### Pause All Queues

```bash
POST /queue/pause
```

#### Resume All Queues

```bash
POST /queue/resume
```

#### Clear All Queues

```bash
DELETE /queue/clear
```

## Job Processing

### Library Scan Job

**Input Data:**

```typescript
{
  libraryId: string;
  rootPath: string;
  libraryName: string;
}
```

**Process:**

1. Validates library root path exists
2. Recursively scans directory for audio files
3. Supports multiple audio formats (MP3, FLAC, WAV, AAC, OGG, etc.)
4. Schedules audio scan jobs for each discovered file
5. Updates job progress

### Audio Scan Job

**Input Data:**

```typescript
{
  filePath: string;
  libraryId: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
}
```

**Process:**

1. Validates audio file exists
2. Creates or updates MusicTrack record
3. Calls AI service for audio analysis
4. Creates AudioFingerprint record with extracted features
5. Creates AIAnalysisResult record with genre classification
6. Updates track with analysis results
7. Handles errors and updates track status

## Data Storage

### MusicTrack

- Basic file information (path, size, format)
- Original metadata (title, artist, album, genre)
- AI-generated metadata with confidence scores
- Analysis status and timestamps

### AudioFingerprint

- Audio features (MFCC, spectral centroid, chroma, etc.)
- Musical characteristics (tempo, key, energy, valence)
- Links to AI analysis results

### AIAnalysisResult

- Genre classification with confidence scores
- Artist and album suggestions
- Model version and processing time
- Error messages if analysis fails

## Error Handling

- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Error Tracking**: Failed jobs are logged with error messages
- **Status Updates**: Track analysis status is updated on success/failure
- **Graceful Degradation**: System continues processing other files if one fails

## Monitoring

### Queue Statistics

- Track waiting, active, completed, and failed job counts
- Monitor queue health and performance
- Identify bottlenecks and processing issues

### Logging

- Comprehensive logging for all queue operations
- Job progress tracking
- Error logging with context

## Performance Considerations

### Concurrency

- Library scans: Limited to 2 concurrent jobs to avoid overwhelming file system
- Audio scans: 5 concurrent jobs for optimal AI service utilization

### Memory Management

- Jobs are processed in batches to prevent memory issues
- Completed jobs are automatically cleaned up
- Failed jobs are retained for debugging

### Scalability

- Redis-based queue system supports horizontal scaling
- Multiple worker processes can be deployed
- Queue persistence ensures job durability

## Development

### Adding New Job Types

1. Create processor class extending `WorkerHost`
2. Register processor in queue module
3. Add job scheduling methods to `QueueService`
4. Update configuration as needed

### Testing

```bash
# Run queue-related tests
npm run test -- --testPathPattern=queue

# Test specific processor
npm run test -- --testPathPattern=audio-scan.processor
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis container is running: `docker ps | grep redis`
   - Start Redis container: `npm run redis:up`
   - Check Redis logs: `npm run redis:logs`
   - Verify connection configuration in environment variables

2. **Jobs Stuck in Processing**
   - Check worker processes are running
   - Verify AI service is accessible
   - Check for file system permissions
   - Monitor Redis memory usage: `npm run redis:cli` then `INFO memory`

3. **High Memory Usage**
   - Reduce concurrency settings
   - Check for memory leaks in processors
   - Monitor job cleanup settings
   - Clear Redis cache: `npm run redis:flush`

4. **Docker Container Issues**
   - Check container health: `docker ps`
   - Restart Redis container: `npm run redis:down && npm run redis:up`
   - Check Docker logs: `docker logs muzo-redis-dev`
   - Verify port availability: `lsof -i :6379`

### Debugging

```bash
# Check queue status
curl http://localhost:3000/queue/stats

# View Redis queue contents
npm run redis:cli
> KEYS bull:*
> LLEN bull:library-scan:waiting
> LLEN bull:audio-scan:waiting

# Monitor Redis in real-time
npm run redis:cli
> MONITOR

# Check Redis memory usage
npm run redis:cli
> INFO memory

# Clear all Redis data (use with caution)
npm run redis:flush
```

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS BullMQ Integration](https://docs.nestjs.com/techniques/queues)
- [Redis Documentation](https://redis.io/docs/)
