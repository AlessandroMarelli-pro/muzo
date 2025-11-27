# Muzo Backend

AI-powered music library organization backend built with NestJS, GraphQL, Prisma, and BullMQ.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
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
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Muzo Backend is the core API service for the Muzo music library application. It provides:

- A GraphQL API for querying and mutating music library data
- Real-time progress tracking via WebSockets
- Background job processing for audio scanning and AI analysis
- Integration with an external AI service for genre classification and audio fingerprinting
- Smart recommendations powered by Elasticsearch

The backend is designed to handle large music libraries efficiently through asynchronous processing and intelligent caching.

---

## Features

### Core Functionality

- **GraphQL API** — Apollo Server with real-time subscriptions for live updates
- **Database** — Prisma ORM with SQLite (Turso/LibSQL compatible for production)
- **Queue System** — BullMQ for async audio scanning, metadata extraction, and AI analysis
- **AI Integration** — Genre classification, BPM detection, audio fingerprinting, mood analysis
- **Recommendations** — Smart track suggestions powered by Elasticsearch with customizable weights

### Audio & Playback

- **Audio Streaming** — HTTP range requests for seeking support
- **Waveform Generation** — Audio visualization data extraction
- **Audio Analysis** — Beat detection, energy analysis, real-time analysis

### Library Management

- **Music Library Scanning** — Full and incremental scans with progress tracking
- **Metadata Management** — Original, AI-generated, and user-modified metadata layers
- **Image Management** — Album art fetching, caching, and serving
- **Playlist Management** — Create, reorder, and get AI-powered recommendations

### Advanced Features

- **Advanced Filtering** — Dynamic filters with saved presets (BPM, key, genre, mood, etc.)
- **Library Metrics** — Statistics, distributions, and listening analytics
- **Real-time Updates** — WebSocket progress tracking via Socket.IO
- **Bull Board** — Visual queue monitoring dashboard

---

## Tech Stack

| Category         | Technology                          |
| ---------------- | ----------------------------------- |
| Framework        | NestJS 11.x                         |
| API              | GraphQL (Apollo Server 4.x)         |
| Database         | Prisma 6.x + SQLite                 |
| Queues           | BullMQ 5.x + Redis (via ioredis)    |
| Search           | Elasticsearch 9.x                   |
| Real-time        | Socket.IO 4.x                       |
| Language         | TypeScript 5.x                      |
| Runtime          | Node.js 18+                         |
| Testing          | Jest 30.x + Vitest 3.x              |
| Validation       | class-validator + class-transformer |
| HTTP Client      | Axios 1.x                           |
| Headless Browser | Puppeteer 24.x (for image scraping) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ GraphQL API  │  │  REST API    │  │  WebSocket Gateway   │   │
│  │ (Apollo)     │  │ (Controllers)│  │  (Socket.IO)         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                 │                    │                 │
│         ▼                 ▼                    ▼                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Services Layer                          │ │
│  │  • MusicLibrary  • MusicTrack  • Playlist  • Filter        │ │
│  │  • Recommendation  • Image  • AudioAnalysis  • Waveform    │ │
│  └────────────────────────────────────────────────────────────┘ │
│         │                 │                    │                 │
│         ▼                 ▼                    ▼                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Prisma     │  │   BullMQ     │  │   Elasticsearch      │   │
│  │   (SQLite)   │  │   (Redis)    │  │   (Search/Recs)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Service (Python)                          │
│  • Audio Fingerprinting  • Genre Classification  • BPM Detection│
│  • Mood Analysis  • Key Detection  • Audio Feature Extraction   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Docker & Docker Compose** (for Redis)
- **npm** (comes with Node.js)
- **AI Service** running on port 4000 (optional, for audio analysis)
- **Elasticsearch** (optional, for recommendations)

### Quick Setup

```bash
# Run the automated setup script
./setup-dev.sh
```

This script will:

1. Install npm dependencies
2. Copy `env.template` to `.env` if it doesn't exist
3. Start the Redis container
4. Generate the Prisma client
5. Run database migrations
6. Start the development server

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp env.template .env

# 3. Start Redis container
npm run redis:up

# 4. Generate Prisma client
npm run prisma:generate

# 5. Run database migrations
npm run prisma:migrate

# 6. Start development server
npm run start:dev
```

### Verify Installation

The API will be available at:

| Endpoint            | URL                           |
| ------------------- | ----------------------------- |
| GraphQL Playground  | http://localhost:3000/graphql |
| Health Check        | http://localhost:3000/health  |
| Bull Board (queues) | http://localhost:3001         |

Test the health endpoint:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","database":"connected"}
```

---

## Project Structure

```
backend/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module with global imports
│   ├── schema.gql                 # Auto-generated GraphQL schema
│   │
│   ├── config/                    # Configuration modules
│   │   ├── index.ts               # Config exports
│   │   ├── app.config.ts          # App settings (port, cors, etc.)
│   │   ├── database.config.ts     # Prisma/DB configuration
│   │   ├── queue.config.ts        # BullMQ settings
│   │   ├── ai-service.config.ts   # AI service connection config
│   │   └── elasticsearch.config.ts
│   │
│   ├── modules/
│   │   ├── ai-integration/        # AI service client & types
│   │   │   ├── ai-integration.module.ts
│   │   │   ├── ai-integration.service.ts
│   │   │   ├── ai-service.types.ts
│   │   │   └── ai-service-simple.types.ts
│   │   │
│   │   ├── filter/                # Dynamic filtering & saved presets
│   │   │   ├── filter.module.ts
│   │   │   ├── filter.resolver.ts
│   │   │   └── filter.service.ts
│   │   │
│   │   ├── health/                # Health check endpoints
│   │   │   ├── health.module.ts
│   │   │   └── health.controller.ts
│   │   │
│   │   ├── image/                 # Album art management
│   │   │   ├── image.module.ts
│   │   │   ├── image.controller.ts
│   │   │   ├── image.resolver.ts
│   │   │   └── image.service.ts
│   │   │
│   │   ├── metrics/               # Library statistics & analytics
│   │   │   ├── metrics.module.ts
│   │   │   ├── metrics.model.ts
│   │   │   ├── metrics.resolver.ts
│   │   │   └── metrics.service.ts
│   │   │
│   │   ├── music-library/         # Library CRUD & scanning
│   │   │   ├── music-library.module.ts
│   │   │   ├── music-library.controller.ts
│   │   │   ├── music-library.resolver.ts
│   │   │   └── music-library.service.ts
│   │   │
│   │   ├── music-player/          # Playback, streaming, waveforms
│   │   │   ├── music-player.module.ts
│   │   │   ├── music-player.resolver.ts
│   │   │   ├── music-player.service.ts
│   │   │   ├── music-player.types.ts
│   │   │   ├── audio-streaming.controller.ts
│   │   │   ├── audio-analysis.service.ts
│   │   │   └── waveform.service.ts
│   │   │
│   │   ├── music-track/           # Track CRUD & metadata
│   │   │   ├── music-track.module.ts
│   │   │   ├── music-track.model.ts
│   │   │   ├── music-track.controller.ts
│   │   │   ├── music-track.resolver.ts
│   │   │   └── music-track.service.ts
│   │   │
│   │   ├── playlist/              # Playlist management
│   │   │   ├── playlist.module.ts
│   │   │   ├── playlist.model.ts
│   │   │   ├── playlist.controller.ts
│   │   │   ├── playlist.resolver.ts
│   │   │   ├── playlist.service.ts
│   │   │   └── dto/
│   │   │       └── playlist.dto.ts
│   │   │
│   │   ├── queue/                 # BullMQ processors
│   │   │   ├── queue.module.ts
│   │   │   ├── queue.controller.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── progress-tracking.service.ts
│   │   │   └── processors/
│   │   │       ├── library-scan.processor.ts
│   │   │       ├── audio-scan.processor.ts
│   │   │       └── bpm-update.processor.ts
│   │   │
│   │   ├── recommendation/        # Smart recommendations + ES
│   │   │   ├── recommendation.module.ts
│   │   │   ├── controllers/
│   │   │   │   ├── recommendation.controller.ts
│   │   │   │   └── user-recommendation-preferences.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── recommendation.service.ts
│   │   │   │   ├── elasticsearch-sync.service.ts
│   │   │   │   └── user-recommendation-preferences.service.ts
│   │   │   ├── dto/
│   │   │   │   └── recommendation.dto.ts
│   │   │   └── interfaces/
│   │   │       └── recommendation.interface.ts
│   │   │
│   │   ├── user-preferences/      # User settings
│   │   │   ├── user-preferences.module.ts
│   │   │   └── user-preferences.resolver.ts
│   │   │
│   │   └── websocket/             # Real-time progress events
│   │       ├── websocket.module.ts
│   │       ├── progress-websocket.gateway.ts
│   │       └── music-player-websocket.gateway.ts
│   │
│   ├── shared/                    # Shared services & utilities
│   │   ├── shared.module.ts
│   │   ├── constants/
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
│       ├── intelligent-editor-session.model.ts
│       ├── playback-session.model.ts
│       └── user-preferences.model.ts
│
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   ├── migrations/                # Migration history (16 migrations)
│   ├── muzo.db                    # SQLite database file
│   └── seed.ts                    # Database seeding script
│
├── tests/
│   ├── setup.ts                   # Test setup configuration
│   ├── contract/                  # API contract tests (Vitest)
│   ├── integration/               # Integration tests
│   └── unit/                      # Unit tests
│
├── default-images/                # Fallback album art (3 defaults)
├── dist/                          # Compiled JavaScript output
│
├── docker-compose.yml             # Production Redis configuration
├── docker-compose.dev.yml         # Development Redis configuration
├── docker-compose.elasticsearch.yml # Elasticsearch + Kibana
│
├── bull-board.js                  # Queue monitoring UI server
├── setup-dev.sh                   # Development setup script
├── env.template                   # Environment variables template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── jest.config.js                 # Jest test configuration
└── vitest.config.ts               # Vitest configuration
```

---

## Scripts Reference

### Development

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `npm run start`       | Start in production mode           |
| `npm run start:dev`   | Start with hot reload (watch mode) |
| `npm run start:debug` | Start with debugger attached       |
| `npm run start:prod`  | Start production build from dist/  |
| `npm run build`       | Build TypeScript to dist/          |
| `npm run lint`        | Run ESLint with auto-fix           |
| `npm run format`      | Format code with Prettier          |

### Testing

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `npm run test`          | Run Jest unit tests             |
| `npm run test:watch`    | Run tests in watch mode         |
| `npm run test:cov`      | Run tests with coverage report  |
| `npm run test:debug`    | Debug tests with Node inspector |
| `npm run test:e2e`      | Run end-to-end tests            |
| `npm run test:contract` | Run contract tests (Vitest)     |

### Database (Prisma)

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run prisma:generate` | Generate Prisma client               |
| `npm run prisma:migrate`  | Create and run migrations (dev)      |
| `npm run prisma:deploy`   | Deploy migrations (production)       |
| `npm run prisma:reset`    | Reset database and re-run migrations |
| `npm run prisma:studio`   | Open Prisma Studio GUI               |
| `npm run db:seed`         | Seed database with initial data      |

### Redis & Queues

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run redis:up`    | Start Redis container (dev)     |
| `npm run redis:down`  | Stop Redis container            |
| `npm run redis:logs`  | View Redis container logs       |
| `npm run redis:cli`   | Access Redis CLI                |
| `npm run redis:flush` | Clear all Redis data (FLUSHALL) |
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

The GraphQL Playground is enabled by default in development mode.

#### Queries

##### Music Library

| Query         | Description              |
| ------------- | ------------------------ |
| `libraries`   | List all music libraries |
| `library(id)` | Get library by ID        |

##### Music Tracks

| Query                             | Description                           |
| --------------------------------- | ------------------------------------- |
| `tracks(options)`                 | List tracks with filtering/pagination |
| `tracksList(options)`             | Paginated track list with metadata    |
| `tracksByCategories(options)`     | Group tracks by category              |
| `track(id)`                       | Get track by ID                       |
| `searchTracks(query, libraryId?)` | Full-text search tracks               |
| `randomTrack(id?)`                | Get a random track                    |
| `recentlyPlayed(limit)`           | Recently played tracks                |
| `mostPlayed(limit)`               | Most played tracks                    |

##### Playlists

| Query                                                           | Description                |
| --------------------------------------------------------------- | -------------------------- |
| `playlists(userId)`                                             | List user playlists        |
| `playlist(id, userId)`                                          | Get playlist by ID         |
| `playlistByName(name)`                                          | Get playlist by name       |
| `playlistTracks(playlistId, userId)`                            | Get tracks in playlist     |
| `playlistStats(playlistId, userId)`                             | Playlist statistics        |
| `playlistRecommendations(playlistId, limit?, excludeTrackIds?)` | AI-powered recommendations |

##### Recommendations

| Query                                 | Description                            |
| ------------------------------------- | -------------------------------------- |
| `trackRecommendations(id, criteria?)` | Similar tracks based on audio features |

##### Filters

| Query                    | Description                           |
| ------------------------ | ------------------------------------- |
| `getSavedFilters`        | List saved filter presets             |
| `getSavedFilter(id)`     | Get filter by ID                      |
| `getCurrentFilter`       | Get currently active filter           |
| `getFilterOptions`       | Get available filter ranges (dynamic) |
| `getStaticFilterOptions` | Get genres, keys, subgenres (static)  |

##### Audio & Playback

| Query                                       | Description               |
| ------------------------------------------- | ------------------------- |
| `getAudioStreamUrl(trackId)`                | Get streaming URL         |
| `getAudioInfo(trackId)`                     | Get audio file info       |
| `getWaveformData(trackId)`                  | Get waveform peaks        |
| `getDetailedWaveformData(trackId)`          | Full waveform data        |
| `getAudioAnalysis(trackId)`                 | Get audio analysis        |
| `getBeatData(trackId)`                      | Get beat timestamps       |
| `getEnergyData(trackId)`                    | Get energy over time      |
| `getRealTimeAnalysis(trackId, currentTime)` | Live analysis at position |
| `getPlaybackState(trackId)`                 | Current playback state    |
| `getActiveSessions`                         | Active playback sessions  |

##### Images

| Query                       | Description   |
| --------------------------- | ------------- |
| `getImageForTrack(trackId)` | Get album art |
| `getImageUrl(trackId)`      | Get image URL |

##### User & Metrics

| Query            | Description          |
| ---------------- | -------------------- |
| `preferences`    | Get user preferences |
| `libraryMetrics` | Library statistics   |
| `queueStats`     | Queue statistics     |

#### Mutations

##### Library Management

| Mutation                                    | Description             |
| ------------------------------------------- | ----------------------- |
| `createLibrary(input)`                      | Create music library    |
| `updateLibrary(id, input)`                  | Update library settings |
| `deleteLibrary(id)`                         | Delete library          |
| `startLibraryScan(libraryId, incremental?)` | Start scanning          |
| `stopLibraryScan(libraryId)`                | Stop scanning           |
| `scheduleLibraryScan(libraryId)`            | Schedule scan job       |

##### Track Management

| Mutation                            | Description            |
| ----------------------------------- | ---------------------- |
| `addTrack(input)`                   | Add track manually     |
| `updateTrack(id, input)`            | Update track metadata  |
| `deleteTrack(id)`                   | Delete track           |
| `toggleFavorite(trackId)`           | Toggle favorite status |
| `recordPlayback(trackId, duration)` | Record play event      |

##### Playlist Management

| Mutation                                               | Description     |
| ------------------------------------------------------ | --------------- |
| `createPlaylist(input)`                                | Create playlist |
| `updatePlaylist(id, input, userId)`                    | Update playlist |
| `deletePlaylist(id, userId)`                           | Delete playlist |
| `addTrackToPlaylist(playlistId, input, userId)`        | Add track       |
| `removeTrackFromPlaylist(playlistId, trackId, userId)` | Remove track    |
| `reorderPlaylistTracks(playlistId, input, userId)`     | Reorder tracks  |

##### Playback Control

| Mutation                            | Description        |
| ----------------------------------- | ------------------ |
| `playTrack(trackId, startTime?)`    | Start playback     |
| `pauseTrack(trackId)`               | Pause playback     |
| `resumeTrack(trackId)`              | Resume playback    |
| `stopTrack(trackId)`                | Stop playback      |
| `seekTrack(trackId, timeInSeconds)` | Seek position      |
| `setVolume(trackId, volume)`        | Set volume (0-1)   |
| `setPlaybackRate(trackId, rate)`    | Set playback speed |

##### User Preferences

| Mutation                   | Description             |
| -------------------------- | ----------------------- |
| `updatePreferences(input)` | Update user preferences |

##### Filter Management

| Mutation                       | Description         |
| ------------------------------ | ------------------- |
| `createSavedFilter(input)`     | Save filter preset  |
| `updateSavedFilter(id, input)` | Update filter       |
| `deleteSavedFilter(id)`        | Delete filter       |
| `setCurrentFilter(criteria)`   | Apply filter        |
| `clearCurrentFilter`           | Clear active filter |

##### Image Management

| Mutation                       | Description      |
| ------------------------------ | ---------------- |
| `deleteImageForTrack(trackId)` | Delete album art |

#### Subscriptions

| Subscription                      | Description                     |
| --------------------------------- | ------------------------------- |
| `libraryScanProgress(libraryId?)` | Real-time scan progress updates |

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
| GET    | `/recommendations/sync-all`                       | Sync all tracks to ES        |
| POST   | `/recommendations/recreate-index`                 | Recreate ES index            |
| POST   | `/recommendations/update-mapping`                 | Update ES mapping            |
| POST   | `/recommendations/test-genre-scoring/:playlistId` | Debug scoring                |
| POST   | `/recommendations/debug/:playlistId`              | Debug recommendations        |

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│  MusicLibrary   │───1:N─│   MusicTrack    │
└─────────────────┘       └─────────────────┘
                                  │
                    ┌─────────────┼─────────────┬──────────────┐
                    │             │             │              │
                   1:1           1:1           1:N            1:N
                    │             │             │              │
             ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐ ┌──────▼──────┐
             │AudioFinger- │ │AIAnalysis│ │PlaylistTrack│ │ImageSearch │
             │   print     │ │ Result   │ └─────┬─────┘ └─────────────┘
             └──────┬──────┘ └──────────┘       │
                    │                           │
                   1:1                         N:1
                    │                           │
             ┌──────▼──────┐             ┌──────▼──────┐
             │AIAnalysis   │             │  Playlist   │
             │  Result     │             └─────────────┘
             └─────────────┘

Other standalone entities:
- UserPreferences
- IntelligentEditorSession (linked to MusicTrack)
- PlaybackSession (linked to MusicTrack)
- SavedFilter
- UserRecommendationPreferences
```

### Core Entities

#### MusicLibrary

| Field                   | Type     | Description                            |
| ----------------------- | -------- | -------------------------------------- |
| `id`                    | UUID     | Primary key                            |
| `name`                  | String   | Library display name                   |
| `rootPath`              | String   | Filesystem path to scan                |
| `totalTracks`           | Int      | Total tracks count                     |
| `analyzedTracks`        | Int      | Successfully analyzed tracks           |
| `pendingTracks`         | Int      | Tracks awaiting analysis               |
| `failedTracks`          | Int      | Tracks that failed analysis            |
| `lastScanAt`            | DateTime | Last full scan timestamp               |
| `lastIncrementalScanAt` | DateTime | Last incremental scan timestamp        |
| `scanStatus`            | Enum     | IDLE, SCANNING, ANALYZING, ERROR       |
| `autoScan`              | Boolean  | Enable automatic scanning              |
| `scanInterval`          | Int?     | Scan interval in hours                 |
| `includeSubdirectories` | Boolean  | Scan subdirectories                    |
| `supportedFormats`      | String   | Comma-separated (MP3,FLAC,WAV,AAC,OGG) |
| `maxFileSize`           | Int?     | Max file size in MB                    |

#### MusicTrack

| Field                  | Type      | Description                            |
| ---------------------- | --------- | -------------------------------------- |
| `id`                   | UUID      | Primary key                            |
| `filePath`             | String    | Unique file path                       |
| `fileName`             | String    | File name                              |
| `fileSize`             | Int       | File size in bytes                     |
| `duration`             | Float     | Duration in seconds                    |
| `format`               | String    | Audio format (MP3, FLAC, etc.)         |
| `bitrate`              | Int?      | Bitrate in kbps                        |
| `sampleRate`           | Int?      | Sample rate in Hz                      |
| **Original Metadata**  |           |                                        |
| `originalTitle`        | String?   | Title from file metadata               |
| `originalArtist`       | String?   | Artist from file metadata              |
| `originalAlbum`        | String?   | Album from file metadata               |
| `originalGenre`        | String?   | Genre from file metadata               |
| `originalYear`         | Int?      | Year from file metadata                |
| `originalBpm`          | Int?      | BPM from file metadata                 |
| `originalAlbumartist`  | String?   | Album artist                           |
| `originalDate`         | DateTime? | Release date                           |
| `originalTrack_number` | Int?      | Track number                           |
| `originalDisc_number`  | String?   | Disc number                            |
| `originalComment`      | String?   | Comment                                |
| `originalComposer`     | String?   | Composer                               |
| `originalCopyright`    | String?   | Copyright info                         |
| **AI Metadata**        |           |                                        |
| `aiTitle`              | String?   | AI-suggested title                     |
| `aiArtist`             | String?   | AI-suggested artist                    |
| `aiAlbum`              | String?   | AI-suggested album                     |
| `aiGenre`              | String?   | AI-classified genre                    |
| `aiConfidence`         | Float?    | Genre classification confidence        |
| `aiSubgenre`           | String?   | AI-classified subgenre                 |
| `aiSubgenreConfidence` | Float?    | Subgenre confidence                    |
| **User Metadata**      |           |                                        |
| `userTitle`            | String?   | User-modified title                    |
| `userArtist`           | String?   | User-modified artist                   |
| `userAlbum`            | String?   | User-modified album                    |
| `userGenre`            | String?   | User-modified genre                    |
| `userTags`             | String?   | JSON array of user tags                |
| **Listening Data**     |           |                                        |
| `listeningCount`       | Int       | Play count                             |
| `lastPlayedAt`         | DateTime? | Last played timestamp                  |
| `isFavorite`           | Boolean   | Favorite flag                          |
| **Analysis Status**    |           |                                        |
| `analysisStatus`       | Enum      | PENDING, PROCESSING, COMPLETED, FAILED |
| `analysisStartedAt`    | DateTime? | Analysis start time                    |
| `analysisCompletedAt`  | DateTime? | Analysis completion time               |
| `analysisError`        | String?   | Error message if failed                |
| `hasMusicbrainz`       | Boolean?  | Has MusicBrainz data                   |
| `hasDiscogs`           | Boolean?  | Has Discogs data                       |

#### AudioFingerprint

| Field                  | Type   | Description                                      |
| ---------------------- | ------ | ------------------------------------------------ |
| `id`                   | UUID   | Primary key                                      |
| `trackId`              | String | Unique foreign key to MusicTrack                 |
| **Audio Features**     |        |                                                  |
| `mfcc`                 | String | JSON array - Mel-frequency cepstral coefficients |
| `spectralCentroid`     | String | JSON - Spectral centroid stats                   |
| `spectralRolloff`      | String | JSON - Spectral rolloff stats                    |
| `spectralSpread`       | String | JSON - Spectral spread stats                     |
| `spectralBandwith`     | String | JSON - Spectral bandwidth stats                  |
| `spectralFlatness`     | String | JSON - Spectral flatness stats                   |
| `spectralContrast`     | String | JSON - Spectral contrast stats                   |
| `chroma`               | String | JSON - Chroma features                           |
| `tonnetz`              | String | JSON - Tonnetz features                          |
| `zeroCrossingRate`     | String | JSON - Zero crossing rate stats                  |
| `rms`                  | String | JSON - RMS energy stats                          |
| **Derived Metrics**    |        |                                                  |
| `tempo`                | Float  | Detected BPM                                     |
| `key`                  | String | Musical key (e.g., "C major")                    |
| `camelotKey`           | String | Camelot wheel notation (e.g., "8B")              |
| `valence`              | Float  | Emotional valence (0-1)                          |
| `valenceMood`          | String | Mood description based on valence                |
| `arousal`              | Float  | Energy/arousal level (0-1)                       |
| `arousalMood`          | String | Mood description based on arousal                |
| `danceability`         | Float  | Danceability score (0-1)                         |
| `danceabilityFeeling`  | String | Danceability description                         |
| `rhythmStability`      | Float  | Rhythm stability score                           |
| `bassPresence`         | Float  | Bass presence score                              |
| `tempoRegularity`      | Float  | Tempo regularity score                           |
| `tempoAppropriateness` | Float  | Tempo appropriateness score                      |
| `energyFactor`         | Float  | Overall energy factor                            |
| `syncopation`          | Float  | Syncopation score                                |
| `acousticness`         | Float  | Acousticness score (0-1)                         |
| `instrumentalness`     | Float  | Instrumentalness score (0-1)                     |
| `speechiness`          | Float  | Speechiness score (0-1)                          |
| `liveness`             | Float  | Liveness score (0-1)                             |
| `modeFactor`           | Float  | Major/minor mode factor                          |
| `modeConfidence`       | Float  | Mode detection confidence                        |
| `modeWeight`           | Float  | Mode weight                                      |
| `tempoFactor`          | Float  | Tempo factor                                     |
| `brightnessFactor`     | Float  | Brightness factor                                |
| `harmonicFactor`       | Float  | Harmonic factor                                  |
| `spectralBalance`      | Float  | Spectral balance                                 |
| `beatStrength`         | Float  | Beat strength                                    |
| `energyComment`        | String | Energy description                               |
| `energyKeywords`       | String | JSON array of energy keywords                    |
| `energyByBand`         | String | JSON array of energy by frequency band           |
| **Hashes**             |        |                                                  |
| `audioHash`            | String | Audio content hash                               |
| `fileHash`             | String | File hash                                        |

#### AIAnalysisResult

| Field                 | Type    | Description                            |
| --------------------- | ------- | -------------------------------------- |
| `id`                  | UUID    | Primary key                            |
| `trackId`             | String  | Unique foreign key to MusicTrack       |
| `fingerprintId`       | String  | Unique foreign key to AudioFingerprint |
| `modelVersion`        | String  | AI model version used                  |
| `genreClassification` | String  | JSON - Genre classification result     |
| `artistSuggestion`    | String? | JSON - Artist suggestion               |
| `albumSuggestion`     | String? | JSON - Album suggestion                |
| `processingTime`      | Float   | Processing time in seconds             |
| `errorMessage`        | String? | Error message if any                   |

#### Playlist / PlaylistTrack

| Field             | Type     | Description                       |
| ----------------- | -------- | --------------------------------- |
| **Playlist**      |          |                                   |
| `id`              | UUID     | Primary key                       |
| `name`            | String   | Playlist name                     |
| `description`     | String?  | Playlist description              |
| `userId`          | String?  | Owner user ID (future multi-user) |
| `isPublic`        | Boolean  | Public visibility flag            |
| **PlaylistTrack** |          |                                   |
| `id`              | UUID     | Primary key                       |
| `playlistId`      | String   | Foreign key to Playlist           |
| `trackId`         | String   | Foreign key to MusicTrack         |
| `position`        | Int      | Position in playlist              |
| `addedAt`         | DateTime | When track was added              |

#### Other Entities

| Entity                          | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `IntelligentEditorSession`      | Metadata editing sessions with AI suggestions  |
| `PlaybackSession`               | Playback history tracking                      |
| `UserPreferences`               | UI, music, analysis, library, privacy settings |
| `ImageSearch`                   | Album art search results and status            |
| `SavedFilter`                   | Saved filter presets (JSON criteria)           |
| `UserRecommendationPreferences` | Recommendation weight preferences              |

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

The backend uses **BullMQ** with Redis for asynchronous job processing.

### Queues

| Queue          | Purpose                                    |
| -------------- | ------------------------------------------ |
| `library-scan` | Discover audio files in library paths      |
| `audio-scan`   | Extract metadata and analyze tracks via AI |
| `bpm-update`   | Batch BPM detection via AI service         |

### Queue Features

- **Retry Logic** — Exponential backoff on failure with configurable attempts
- **Concurrency Control** — Configurable per-queue (see env vars)
- **Progress Tracking** — Real-time via WebSocket
- **Job Priorities** — Urgent jobs processed first
- **Rate Limiting** — Prevent AI service overload
- **Stalled Job Recovery** — Automatic recovery of stalled jobs

### Queue Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  library-scan   │────▶│   audio-scan    │────▶│   AI Service    │
│                 │     │                 │     │                 │
│ Discovers files │     │ Extracts meta   │     │ Analyzes audio  │
│ Creates tracks  │     │ Sends to AI     │     │ Returns results │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Progress Updates                   │
└─────────────────────────────────────────────────────────────────┘
```

### Monitoring with Bull Board

```bash
# Start Bull Board UI
npm run bull-board

# Open in browser
open http://localhost:3001
```

Bull Board provides:

- Real-time queue status
- Job details and history
- Failed job inspection
- Manual job retry/removal

---

## WebSocket Events

### Progress Gateway (`/progress`)

Real-time scan progress updates.

| Event                   | Direction       | Payload                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------- |
| `library-scan-progress` | Server → Client | `{ libraryId, status, processedFiles, totalFiles, progressPercentage }` |
| `library-scan-complete` | Server → Client | `{ libraryId, newTracks, updatedTracks, errors }`                       |
| `audio-scan-progress`   | Server → Client | `{ trackId, status, progress }`                                         |

### Music Player Gateway (`/music-player`)

Playback state synchronization.

| Event            | Direction       | Payload                                                 |
| ---------------- | --------------- | ------------------------------------------------------- |
| `playback-state` | Server → Client | `{ trackId, isPlaying, currentTime, duration, volume }` |
| `track-changed`  | Server → Client | `{ trackId, track }`                                    |

### Client Connection Example

```typescript
import { io } from 'socket.io-client';

// Connect to progress gateway
const progressSocket = io('http://localhost:3000/progress');

progressSocket.on('library-scan-progress', (data) => {
  console.log(`Scan progress: ${data.progressPercentage}%`);
});

progressSocket.on('library-scan-complete', (data) => {
  console.log(`Scan complete: ${data.newTracks} new tracks`);
});
```

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

### Prisma

| Variable                 | Default | Description            |
| ------------------------ | ------- | ---------------------- |
| `PRISMA_GENERATE_ENGINE` | `true`  | Generate Prisma engine |

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
| `REDIS_PASSWORD` | (empty)     | Redis password       |
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
# Start Redis only (development)
npm run redis:up

# Stop Redis
npm run redis:down

# View Redis logs
npm run redis:logs

# Access Redis CLI
npm run redis:cli
```

### Production

```bash
# Start production Redis
docker-compose up -d
```

### Elasticsearch (Optional)

Required for the recommendation system.

```bash
# Start Elasticsearch + Kibana
docker-compose -f docker-compose.elasticsearch.yml up -d

# Access Kibana
open http://localhost:5601
```

### Docker Compose Files

| File                               | Contents                           |
| ---------------------------------- | ---------------------------------- |
| `docker-compose.yml`               | Production Redis                   |
| `docker-compose.dev.yml`           | Development Redis (muzo-redis-dev) |
| `docker-compose.elasticsearch.yml` | Elasticsearch + Kibana             |

---

## Testing

### Unit Tests (Jest)

```bash
# Run all unit tests
npm run test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:cov

# Debug tests
npm run test:debug
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
├── setup.ts           # Test setup configuration
├── unit/              # Service and utility unit tests
├── integration/       # Module integration tests
└── contract/          # API contract tests (Vitest)
```

### Writing Tests

```typescript
// Example unit test
describe('MusicLibraryService', () => {
  let service: MusicLibraryService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicLibraryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MusicLibraryService>(MusicLibraryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a library', async () => {
    const result = await service.create({ name: 'Test', rootPath: '/music' });
    expect(result.name).toBe('Test');
  });
});
```

---

## Troubleshooting

### Common Issues

#### Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Start the Redis container:

```bash
npm run redis:up
```

#### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Solution**: Generate the Prisma client:

```bash
npm run prisma:generate
```

#### Database Migration Issues

```
Error: P3009: migrate found failed migrations
```

**Solution**: Reset the database:

```bash
npm run prisma:reset
```

#### AI Service Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**Solution**: Ensure the AI service is running on port 4000, or the backend will still work but without AI analysis capabilities.

#### Elasticsearch Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:9200
```

**Solution**: Start Elasticsearch or disable recommendations:

```bash
docker-compose -f docker-compose.elasticsearch.yml up -d
```

### Debugging

#### Enable Verbose Logging

```bash
# Set in .env
DATABASE_LOGGING=true
NODE_ENV=development
```

#### Inspect Queue Jobs

```bash
# Start Bull Board
npm run bull-board

# Or use Redis CLI
npm run redis:cli
> KEYS bull:*
```

#### Check Health Endpoints

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/database
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the project conventions
4. Write/update tests as needed
5. Run linting and tests: `npm run lint && npm run test`
6. Commit with descriptive messages
7. Push and create a Pull Request

### Code Style

- Follow NestJS conventions and patterns
- Use TypeScript strict mode
- Run `npm run lint` and `npm run format` before committing
- Write meaningful commit messages

---

## License

MIT

---

## Author

Alessandro Marelli
