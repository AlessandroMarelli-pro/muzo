# Persistence adapters

**Path:** `backend/src/clean-arch/adapters/persistence/`

Persistence adapters **implement** application ports: they map between domain/kernel types and the database (Prisma). All user-scoped reads/writes use `getCurrentUserId()` in `where` clauses.

## Repositories

Each repository implements one port from `application/ports/repositories/` (or `application/ports/queries/`). They use `PrismaService` (see [06-infrastructure.md](06-infrastructure.md)) and a **mapper** per aggregate to convert Prisma ↔ kernel types. Methods that can hit “record not found” use `.catch(handlePrismaNotFound(e, message))` so Prisma P2025 becomes kernel `NotFoundError`.

### Playlist (`repositories/playlist/`)

- **`PlaylistRepository`** — Implements `IPlaylistRepository`. Mapper: `toDomain`, `toPrisma`, `toPrismaUpdateData`; updates add `updatedAt: now()`, `updatedById: getCurrentUserId()`.
- **`playlist.mapper.ts`** — Prisma playlist ↔ `Playlist`.

### Playlist track (`repositories/playlist-track/`)

- **`PlaylistTrackRepository`** — Implements `IPlaylistTrackRepository`; filters by current user via playlist ownership.
- **`playlist-track.mapper.ts`** — Prisma ↔ `PlaylistTrack`.

### Playlist sorting (`repositories/playlist-sorting/`)

- **`PlaylistSortingRepository`** — Implements `IPlaylistSortingRepository`.
- **`playlist-sorting.mapper.ts`** — Prisma ↔ sorting config.

### Music track (`repositories/music-track/`)

- **`MusicTrackRepository`** — Implements `IMusicTrackRepository`; supports filtering (see builders).
- **`music-track.mapper.ts`** — Prisma ↔ `MusicTrack`.

### Queue (`repositories/queue/`)

- **`QueueRepository`** — Implements `IQueueRepository`; queue items and order for current user.
- **`queue.mapper.ts`** — Prisma ↔ queue domain types.

### Saved filter (`repositories/saved-filter/`)

- **`SavedFilterRepository`** — Implements `ISavedFilterRepository`.
- **`saved-filter.mapper.ts`** — Prisma ↔ saved filter types.

### Image search (`repositories/image-search/`)

- **`ImageSearchRepository`** — Implements `IImageSearchRepository`.
- **`image-search.mapper.ts`** — Prisma ↔ image search record.

### Hidden music track (`repositories/hidden-music-track/`)

- **`HiddenMusicTrackRepository`** — Implements `IHiddenMusicTrackRepository`.

### Music library (`repositories/music-library/`)

- **`MusicLibraryRepository`** — Implements `IMusicLibraryRepository`.

### Prisma errors (`repositories/prisma-errors.ts`)

- **`handlePrismaNotFound(error, message)`** — If `error.code === 'P2025'`, throws `createNotFoundError(message)`; otherwise rethrows. Used by all repositories and queries.

## Queries (read-only / complex reads)

### Playlist stats (`queries/playlist/`)

- **`PlaylistStatsQuery`** — Implements `IPlaylistStatsQuery`. Uses Prisma/raw SQL to compute stats; filters by `getCurrentUserId()`.
- **`playlist-stats.mapper.ts`** — Raw row → `PlaylistStatsDto` (bpmRange, energyRange, topGenres, topSubgenres, numberOfTracks, totalDuration, etc.).

### Metrics (`queries/metrics/`)

- **`MetricsQuery`** — Implements `IMetricsQuery`. Home/dashboard metrics.

### Saved filter (`queries/saved-filter/`)

- **`SavedFilterQuery`** — Implements `ISavedFilterQuery`. Read-only saved filter data and options.

### Music track (`queries/music-track/`)

- **`MusicTrackQuery`** — Implements `IMusicTrackQueries`. Complex music-track reads (pagination, filters).

## Recommendation

- **`recommendation/recommendation-data.adapter.ts`** — Implements `IRecommendationDataPort` (e.g. `getAudioFeatures(tracks)`). Name the class **`RecommendationDataAdapter`** (not `*Port`; "Port" is the interface).

## DataLoaders

DataLoaders batch and cache per-request loads; they live in persistence because they wrap repository/query calls. Created per request in GraphQL context (see [08-app-wiring.md](08-app-wiring.md)).

### Playlist stats

- **`queries/playlist/playlist-stats.loader.ts`** — `createPlaylistStatsLoader(statsQuery)`. Batch `getPlaylistsStats()`, return map by playlist id. Used by `CleanArchPlaylist.stats` field.

### Playlist tracks

- **`repositories/playlist-track/playlist-track.loader.ts`** — `createPlaylistTracksLoader(playlistTrackRepository)`. Batch load tracks by playlist id. Used by `CleanArchPlaylist.tracks` field.
- **`playlist-contains-track.loader.ts`** — `createPlaylistContainsTrackLoader(playlistTrackRepository)`. Batch “does playlist contain track?”.
- **`playlist-track-with-track.loader.ts`** — `createPlaylistTracksWithTrackLoader(playlistTrackRepository)`. Batch playlist tracks with full track detail.

## Helpers

- **`builders/music-track-filter.where.ts`** — Builds Prisma `where` for music track filtering.
- **`includes/playlist-includes.ts`** — Common Prisma `include` for playlist relations.
- **`repositories/db.ts`**, **`repositories/domain.ts`** — Shared DB/domain re-exports or helpers used by mappers/repositories.

## Module

**`AdaptersPersistenceModule`** (`adapters/persistence/persistence.module.ts`) — `@Global()`. Provides:

- **Concrete implementations:** `PlaylistRepository`, `PlaylistTrackRepository`, `PlaylistSortingRepository`, `MusicTrackRepository`, `QueueRepository`, `SavedFilterRepository`, `ImageSearchRepository`, `HiddenMusicTrackRepository`, `MusicLibraryRepository`, `PlaylistStatsQuery`, `MetricsQuery`, `SavedFilterQuery`, `MusicTrackQuery`, `RecommendationDataAdapter`, `WaveformGenerator`, `FileSystemImageReader` (see [06-infrastructure.md](06-infrastructure.md)).
- **Infrastructure used by adapters:** `PrismaService` (from `clean-arch/infrastructure/database` or root, depending on import path).
- **Port bindings:** Each port token (e.g. `PLAYLIST_REPOSITORY`) is bound to its implementation with `provide` / `useClass`.

Exports all port tokens so that `UseCasesModule` (and GraphQL `forRootAsync` for loaders) can depend on them without importing implementation details.
