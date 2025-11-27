# Muzo Backend

AI-powered music library organization backend built with NestJS, GraphQL, Prisma, and BullMQ.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Scripts Reference](#scripts-reference)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Queue System](#queue-system)
- [WebSocket Events](#websocket-events)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [Testing](#testing)
- [License](#license)

---

## Features

- **GraphQL API** — Apollo Server with real-time subscriptions
- **Database** — Prisma ORM with SQLite (Turso/LibSQL compatible)
- **Queue System** — BullMQ for async audio scanning and AI analysis
- **AI Integration** — Genre classification, BPM detection, audio fingerprinting
- **Recommendations** — Smart track suggestions powered by Elasticsearch
- **Real-time Updates** — WebSocket progress tracking via Socket.IO
- **Audio Streaming** — HTTP range requests for seeking support
- **Waveform Generation** — Audio visualization data extraction
- **Image Management** — Album art fetching and caching
- **Playlist Management** — Create, reorder, and get recommendations
- **Advanced Filtering** — Dynamic filters with saved presets
- **Library Metrics** — Statistics, distributions, and listening analytics
- **Bull Board** — Visual queue monitoring dashboard

---

## Tech Stack

| Category   | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | NestJS 11.x                         |
| API        | GraphQL (Apollo Server)             |
| Database   | Prisma 6.x + SQLite                 |
| Queues     | BullMQ 5.x + Redis                  |
| Search     | Elasticsearch 9.x                   |
| Real-time  | Socket.IO 4.x                       |
| Language   | TypeScript 5.x                      |
| Testing    | Jest 30.x + Vitest 3.x              |
| Validation | class-validator + class-transformer |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

### Quick Setup

```bash
./setup-dev.sh
```

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp env.template .env

# Start Redis container
npm run redis:up

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run start:dev
```

The API will be available at:

- **GraphQL Playground**: http://localhost:3000/graphql
- **Health Check**: http://localhost:3000/health

---

## Project Structure

```
backend/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── schema.gql                 # Generated GraphQL schema
│   │
│   ├── config/                    # Configuration modules
│   │   ├── app.config.ts          # App settings
│   │   ├── database.config.ts     # Prisma/DB config
│   │   ├── queue.config.ts        # BullMQ settings
│   │   ├── ai-service.config.ts   # AI service connection
│   │   └── elasticsearch.config.ts
│   │
│   ├── modules/
│   │   ├── ai-integration/        # AI service client
│   │   ├── filter/                # Dynamic filtering & saved presets
│   │   ├── health/                # Health check endpoints
│   │   ├── image/                 # Album art management
│   │   ├── metrics/               # Library statistics & analytics
│   │   ├── music-library/         # Library CRUD & scanning
│   │   ├── music-player/          # Playback, streaming, waveforms
│   │   ├── music-track/           # Track CRUD & metadata
│   │   ├── playlist/              # Playlist management
│   │   ├── queue/                 # BullMQ processors (scan, BPM)
│   │   ├── recommendation/        # Smart recommendations + ES
│   │   ├── user-preferences/      # User settings
│   │   └── websocket/             # Real-time progress events
│   │
│   ├── shared/                    # Shared services
│   │   ├── shared.module.ts
│   │   └── services/
│   │       ├── prisma.service.ts
│   │       ├── elasticsearch.service.ts
│   │       └── file-scanning.service.ts
│   │
│   ├── common/                    # Cross-cutting concerns
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── interfaces/
│   │
│   └── models/                    # GraphQL type definitions
│       ├── music-library.model.ts
│       ├── music-track.model.ts
│       ├── audio-fingerprint.model.ts
│       ├── ai-analysis-result.model.ts
│       ├── playlist.model.ts
│       ├── filter.model.ts
│       └── user-preferences.model.ts
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Migration history
│   └── seed.ts                    # Database seeding
│
├── tests/
│   ├── contract/                  # API contract tests
│   ├── integration/               # Integration tests
│   └── unit/                      # Unit tests
│
├── default-images/                # Fallback album art
├── docker-compose.yml             # Production Redis
├── docker-compose.dev.yml         # Development Redis
├── docker-compose.elasticsearch.yml
└── bull-board.js                  # Queue monitoring UI
```

---

## Scripts Reference

### Development

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `npm run start:dev`   | Start with hot reload        |
| `npm run start:debug` | Start with debugger attached |
| `npm run start:prod`  | Start production build       |
| `npm run build`       | Build TypeScript to dist/    |
| `npm run lint`        | Run ESLint with auto-fix     |
| `npm run format`      | Format with Prettier         |

### Testing

| Command                 | Description                |
| ----------------------- | -------------------------- |
| `npm run test`          | Run Jest unit tests        |
| `npm run test:watch`    | Run tests in watch mode    |
| `npm run test:cov`      | Tests with coverage report |
| `npm run test:debug`    | Debug tests with inspector |
| `npm run test:e2e`      | End-to-end tests           |
| `npm run test:contract` | Contract tests (Vitest)    |

### Database

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run prisma:generate` | Generate Prisma client               |
| `npm run prisma:migrate`  | Create and run migrations            |
| `npm run prisma:deploy`   | Deploy migrations (production)       |
| `npm run prisma:reset`    | Reset database and re-run migrations |
| `npm run prisma:studio`   | Open Prisma Studio GUI               |
| `npm run db:seed`         | Seed database with initial data      |

### Redis & Queues

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run redis:up`    | Start Redis container           |
| `npm run redis:down`  | Stop Redis container            |
| `npm run redis:logs`  | View Redis container logs       |
| `npm run redis:cli`   | Access Redis CLI                |
| `npm run redis:flush` | Clear all Redis data            |
| `npm run bull-board`  | Start Bull Board UI (port 3001) |

### Setup & Cleanup

| Command               | Description                   |
| --------------------- | ----------------------------- |
| `npm run dev:setup`   | Start Redis + generate Prisma |
| `npm run dev:cleanup` | Stop Redis container          |

---

## API Reference

### GraphQL Endpoint

**URL**: `http://localhost:3000/graphql`

#### Queries

| Query                                                           | Description                           |
| --------------------------------------------------------------- | ------------------------------------- |
| `libraries`                                                     | List all music libraries              |
| `library(id)`                                                   | Get library by ID                     |
| `tracks(options)`                                               | List tracks with filtering/pagination |
| `tracksList(options)`                                           | Paginated track list                  |
| `tracksByCategories(options)`                                   | Group tracks by category              |
| `track(id)`                                                     | Get track by ID                       |
| `searchTracks(query, libraryId?)`                               | Search tracks by text                 |
| `randomTrack(id?)`                                              | Get a random track                    |
| `recentlyPlayed(limit)`                                         | Recently played tracks                |
| `mostPlayed(limit)`                                             | Most played tracks                    |
| `playlists(userId)`                                             | List user playlists                   |
| `playlist(id, userId)`                                          | Get playlist by ID                    |
| `playlistByName(name)`                                          | Get playlist by name                  |
| `playlistTracks(playlistId, userId)`                            | Get tracks in playlist                |
| `playlistStats(playlistId, userId)`                             | Playlist statistics                   |
| `playlistRecommendations(playlistId, limit?, excludeTrackIds?)` | Smart recommendations                 |
| `trackRecommendations(id, criteria?)`                           | Similar tracks                        |
| `preferences`                                                   | Get user preferences                  |
| `libraryMetrics`                                                | Library statistics                    |
| `getSavedFilters`                                               | List saved filters                    |
| `getSavedFilter(id)`                                            | Get filter by ID                      |
| `getCurrentFilter`                                              | Get active filter                     |
| `getFilterOptions`                                              | Get available filter ranges           |
| `getStaticFilterOptions`                                        | Get genres, keys, subgenres           |
| `getAudioStreamUrl(trackId)`                                    | Get streaming URL                     |
| `getAudioInfo(trackId)`                                         | Get audio file info                   |
| `getWaveformData(trackId)`                                      | Get waveform peaks                    |
| `getDetailedWaveformData(trackId)`                              | Full waveform data                    |
| `getAudioAnalysis(trackId)`                                     | Get audio analysis                    |
| `getBeatData(trackId)`                                          | Get beat timestamps                   |
| `getEnergyData(trackId)`                                        | Get energy over time                  |
| `getRealTimeAnalysis(trackId, currentTime)`                     | Live analysis                         |
| `getPlaybackState(trackId)`                                     | Current playback state                |
| `getActiveSessions`                                             | Active playback sessions              |
| `getImageForTrack(trackId)`                                     | Get album art                         |
| `getImageUrl(trackId)`                                          | Get image URL                         |
| `queueStats`                                                    | Queue statistics                      |

#### Mutations

| Mutation                                               | Description             |
| ------------------------------------------------------ | ----------------------- |
| `createLibrary(input)`                                 | Create music library    |
| `updateLibrary(id, input)`                             | Update library settings |
| `deleteLibrary(id)`                                    | Delete library          |
| `startLibraryScan(libraryId, incremental?)`            | Start scanning          |
| `stopLibraryScan(libraryId)`                           | Stop scanning           |
| `scheduleLibraryScan(libraryId)`                       | Schedule scan job       |
| `addTrack(input)`                                      | Add track manually      |
| `updateTrack(id, input)`                               | Update track metadata   |
| `deleteTrack(id)`                                      | Delete track            |
| `toggleFavorite(trackId)`                              | Toggle favorite status  |
| `recordPlayback(trackId, duration)`                    | Record play event       |
| `createPlaylist(input)`                                | Create playlist         |
| `updatePlaylist(id, input, userId)`                    | Update playlist         |
| `deletePlaylist(id, userId)`                           | Delete playlist         |
| `addTrackToPlaylist(playlistId, input, userId)`        | Add track               |
| `removeTrackFromPlaylist(playlistId, trackId, userId)` | Remove track            |
| `reorderPlaylistTracks(playlistId, input, userId)`     | Reorder tracks          |
| `playTrack(trackId, startTime?)`                       | Start playback          |
| `pauseTrack(trackId)`                                  | Pause playback          |
| `resumeTrack(trackId)`                                 | Resume playback         |
| `stopTrack(trackId)`                                   | Stop playback           |
| `seekTrack(trackId, timeInSeconds)`                    | Seek position           |
| `setVolume(trackId, volume)`                           | Set volume              |
| `setPlaybackRate(trackId, rate)`                       | Set playback speed      |
| `updatePreferences(input)`                             | Update user preferences |
| `createSavedFilter(input)`                             | Save filter preset      |
| `updateSavedFilter(id, input)`                         | Update filter           |
| `deleteSavedFilter(id)`                                | Delete filter           |
| `setCurrentFilter(criteria)`                           | Apply filter            |
| `clearCurrentFilter`                                   | Clear active filter     |
| `deleteImageForTrack(trackId)`                         | Delete album art        |

#### Subscriptions

| Subscription                      | Description             |
| --------------------------------- | ----------------------- |
| `libraryScanProgress(libraryId?)` | Real-time scan progress |

### REST Endpoints

#### Health

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| GET    | `/health`          | Overall health status |
| GET    | `/health/database` | Database connectivity |

#### Queue Management

| Method | Endpoint                               | Description                    |
| ------ | -------------------------------------- | ------------------------------ |
| POST   | `/queue/scan-all-libraries`            | Scan all auto-scan libraries   |
| POST   | `/queue/scan-library/:libraryId`       | Scan specific library          |
| GET    | `/queue/stats`                         | Get queue statistics           |
| DELETE | `/queue/clear`                         | Clear all queues               |
| POST   | `/queue/pause`                         | Pause all queues               |
| POST   | `/queue/resume`                        | Resume all queues              |
| POST   | `/queue/bpm-update/:trackId`           | Update BPM for track           |
| POST   | `/queue/bpm-update-library/:libraryId` | Update BPM for library         |
| POST   | `/queue/bpm-update-all`                | Update BPM for all tracks      |
| GET    | `/queue/scan-null-artist-tracks`       | Rescan tracks missing metadata |

#### Audio Streaming

| Method | Endpoint                       | Description                   |
| ------ | ------------------------------ | ----------------------------- |
| GET    | `/api/audio/stream/:trackId`   | Stream audio (supports range) |
| GET    | `/api/audio/info/:trackId`     | Get audio file info           |
| GET    | `/api/audio/waveform/:trackId` | Get waveform data             |
| GET    | `/api/audio/analysis/:trackId` | Get audio analysis            |

#### Images

| Method | Endpoint                              | Description          |
| ------ | ------------------------------------- | -------------------- |
| GET    | `/api/images/health`                  | Image service health |
| GET    | `/api/images/serve?imagePath=`        | Serve image file     |
| GET    | `/api/images/track/:trackId`          | Get image for track  |
| GET    | `/api/images/track/:trackId/url`      | Get image URL        |
| GET    | `/api/images/track/:trackId/searches` | Get all searches     |
| GET    | `/api/images/search/:searchId/status` | Get search status    |
| POST   | `/api/images/track/:trackId/delete`   | Delete track image   |

#### Recommendations

| Method | Endpoint                                          | Description                  |
| ------ | ------------------------------------------------- | ---------------------------- |
| POST   | `/recommendations/playlist`                       | Get playlist recommendations |
| GET    | `/recommendations/sync/:trackId`                  | Sync track to Elasticsearch  |
| GET    | `/recommendations/sync-all`                       | Sync all tracks              |
| POST   | `/recommendations/recreate-index`                 | Recreate ES index            |
| POST   | `/recommendations/update-mapping`                 | Update ES mapping            |
| POST   | `/recommendations/test-genre-scoring/:playlistId` | Debug scoring                |
| POST   | `/recommendations/debug/:playlistId`              | Debug recommendations        |

---

## Database Schema

### Core Entities

#### MusicLibrary

- `id` (UUID) — Primary key
- `name` — Library display name
- `rootPath` — Filesystem path to scan
- `totalTracks`, `analyzedTracks`, `pendingTracks`, `failedTracks` — Counters
- `lastScanAt`, `lastIncrementalScanAt` — Scan timestamps
- `scanStatus` — IDLE | SCANNING | ANALYZING | ERROR
- `autoScan`, `scanInterval`, `includeSubdirectories` — Settings
- `supportedFormats` — Comma-separated (MP3, FLAC, WAV, AAC, OGG)
- `maxFileSize` — Max file size in MB

#### MusicTrack

- `id` (UUID) — Primary key
- `filePath` (unique), `fileName`, `fileSize`, `duration`, `format`
- `bitrate`, `sampleRate` — Audio properties
- **Original Metadata**: `originalTitle`, `originalArtist`, `originalAlbum`, `originalGenre`, `originalYear`, `originalBpm`, etc.
- **AI Metadata**: `aiTitle`, `aiArtist`, `aiAlbum`, `aiGenre`, `aiConfidence`, `aiSubgenre`, `aiSubgenreConfidence`
- **User Metadata**: `userTitle`, `userArtist`, `userAlbum`, `userGenre`, `userTags`
- **Listening Data**: `listeningCount`, `lastPlayedAt`, `isFavorite`
- **Analysis Status**: `analysisStatus` (PENDING | PROCESSING | COMPLETED | FAILED), timestamps, error

#### AudioFingerprint

- `id` (UUID) — Primary key
- `trackId` (unique) — Foreign key to MusicTrack
- **Audio Features**: `mfcc`, `spectralCentroid`, `spectralRolloff`, `spectralSpread`, `spectralBandwidth`, `spectralFlatness`, `spectralContrast`, `chroma`, `tonnetz`, `zeroCrossingRate`, `rms`
- **Derived Metrics**: `tempo`, `key`, `camelotKey`, `valence`, `valenceMood`, `arousal`, `arousalMood`, `danceability`, `danceabilityFeeling`, `rhythmStability`, `bassPresence`, `tempoRegularity`, `energyFactor`, `syncopation`, `acousticness`, `instrumentalness`, `speechiness`, `liveness`
- **Hashes**: `audioHash`, `fileHash`

#### AIAnalysisResult

- `id` (UUID) — Primary key
- `trackId`, `fingerprintId` (unique) — Foreign keys
- `modelVersion` — AI model version
- `genreClassification` — JSON classification result
- `artistSuggestion`, `albumSuggestion` — Optional suggestions
- `processingTime`, `errorMessage`

#### Playlist / PlaylistTrack

- Playlist: `id`, `name`, `description`, `userId`, `isPublic`
- PlaylistTrack: `id`, `playlistId`, `trackId`, `position`, `addedAt`

#### Other Entities

- **IntelligentEditorSession** — Metadata editing sessions with AI suggestions
- **PlaybackSession** — Playback history tracking
- **UserPreferences** — UI, music, analysis, library, privacy settings
- **ImageSearch** — Album art search results
- **SavedFilter** — Saved filter presets
- **UserRecommendationPreferences** — Recommendation weights

### Enums

| Enum              | Values                                 |
| ----------------- | -------------------------------------- |
| ScanStatus        | IDLE, SCANNING, ANALYZING, ERROR       |
| AnalysisStatus    | PENDING, PROCESSING, COMPLETED, FAILED |
| SessionStatus     | ACTIVE, COMPLETED, CANCELLED           |
| PlaybackType      | MANUAL, AUTO_PLAY, PLAYLIST, RADIO     |
| RepeatMode        | NONE, ONE, ALL                         |
| ImageSearchStatus | PENDING, COMPLETED, FAILED             |

---

## Queue System

The backend uses **BullMQ** with Redis for async job processing.

### Queues

| Queue          | Purpose                               |
| -------------- | ------------------------------------- |
| `library-scan` | Discover audio files in library paths |
| `audio-scan`   | Extract metadata and analyze tracks   |
| `bpm-update`   | Batch BPM detection via AI service    |

### Features

- **Retry Logic** — Exponential backoff on failure
- **Concurrency Control** — Configurable per-queue
- **Progress Tracking** — Real-time via WebSocket
- **Job Priorities** — Urgent jobs processed first
- **Rate Limiting** — Prevent AI service overload

### Monitoring

```bash
# Start Bull Board UI
npm run bull-board
# Open http://localhost:3001
```

---

## WebSocket Events

### Progress Gateway (`/progress`)

| Event                   | Direction       | Payload                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------- |
| `library-scan-progress` | Server → Client | `{ libraryId, status, processedFiles, totalFiles, progressPercentage }` |
| `library-scan-complete` | Server → Client | `{ libraryId, newTracks, updatedTracks, errors }`                       |
| `audio-scan-progress`   | Server → Client | `{ trackId, status, progress }`                                         |

### Music Player Gateway (`/music-player`)

| Event            | Direction       | Payload                                                 |
| ---------------- | --------------- | ------------------------------------------------------- |
| `playback-state` | Server → Client | `{ trackId, isPlaying, currentTime, duration, volume }` |
| `track-changed`  | Server → Client | `{ trackId, track }`                                    |

---

## Environment Variables

Copy `env.template` to `.env` and configure:

### Database

| Variable           | Default          | Description                 |
| ------------------ | ---------------- | --------------------------- |
| `DATABASE_URL`     | `file:./muzo.db` | SQLite database path        |
| `DATABASE_LOGGING` | `false`          | Enable Prisma query logging |

### Server

| Variable   | Default       | Description |
| ---------- | ------------- | ----------- |
| `PORT`     | `3000`        | Server port |
| `NODE_ENV` | `development` | Environment |

### GraphQL

| Variable                | Default | Description                 |
| ----------------------- | ------- | --------------------------- |
| `GRAPHQL_PLAYGROUND`    | `true`  | Enable GraphQL Playground   |
| `GRAPHQL_INTROSPECTION` | `true`  | Enable schema introspection |

### CORS

| Variable      | Default                 | Description    |
| ------------- | ----------------------- | -------------- |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed origin |

### AI Service

| Variable               | Default                 | Description            |
| ---------------------- | ----------------------- | ---------------------- |
| `AI_SERVICE_URL`       | `http://localhost:4000` | AI service endpoint    |
| `AI_SERVICE_TIMEOUT`   | `30000`                 | Request timeout (ms)   |
| `AI_BATCH_CONCURRENCY` | `5`                     | Concurrent AI requests |
| `AI_RETRY_ATTEMPTS`    | `3`                     | Retry count            |
| `AI_RETRY_DELAY`       | `1000`                  | Retry delay (ms)       |

### Elasticsearch

| Variable                 | Default                 | Description |
| ------------------------ | ----------------------- | ----------- |
| `ELASTICSEARCH_NODE`     | `http://localhost:9200` | ES endpoint |
| `ELASTICSEARCH_USERNAME` | `elastic`               | Username    |
| `ELASTICSEARCH_PASSWORD` | `changeme`              | Password    |

### Redis

| Variable         | Default     | Description          |
| ---------------- | ----------- | -------------------- |
| `REDIS_HOST`     | `localhost` | Redis host           |
| `REDIS_PORT`     | `6379`      | Redis port           |
| `REDIS_PASSWORD` | ``          | Redis password       |
| `REDIS_DB`       | `0`         | Redis database index |

### Queue Settings

| Variable                     | Default | Description              |
| ---------------------------- | ------- | ------------------------ |
| `LIBRARY_SCAN_CONCURRENCY`   | `2`     | Concurrent library scans |
| `LIBRARY_SCAN_ATTEMPTS`      | `3`     | Retry attempts           |
| `LIBRARY_SCAN_BACKOFF_DELAY` | `2000`  | Backoff delay (ms)       |
| `AUDIO_SCAN_CONCURRENCY`     | `5`     | Concurrent audio scans   |
| `AUDIO_SCAN_ATTEMPTS`        | `3`     | Retry attempts           |
| `AUDIO_SCAN_BACKOFF_DELAY`   | `1000`  | Backoff delay (ms)       |

---

## Docker

### Development

```bash
# Start Redis only
npm run redis:up

# Stop Redis
npm run redis:down
```

### Production

```bash
# Start production Redis
docker-compose up -d
```

### Elasticsearch (Optional)

```bash
# Start Elasticsearch + Kibana
docker-compose -f docker-compose.elasticsearch.yml up -d
```

### Docker Compose Files

| File                               | Contents          |
| ---------------------------------- | ----------------- |
| `docker-compose.yml`               | Production Redis  |
| `docker-compose.dev.yml`           | Development Redis |
| `docker-compose.elasticsearch.yml` | ES + Kibana       |

---

## Testing

### Unit Tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

### Contract Tests (Vitest)

```bash
npm run test:contract
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Structure

```
tests/
├── unit/           # Service and utility tests
├── integration/    # Module integration tests
└── contract/       # API contract tests (Vitest)
```

---

## License

MIT
