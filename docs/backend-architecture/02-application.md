# Application layer

**Path:** `backend/src/application/`

The application layer contains **ports** (interfaces for outbound I/O) and **use cases** (orchestration). It depends only on the kernel and on port interfaces; concrete implementations live in adapters and are wired via Nest DI.

## Ports

Ports are TypeScript interfaces. Each port has a **typed token** created with **`createToken<IPort>('TOKEN_NAME')`** from `application/utils/create-token.ts`. This enables DI and ensures inject order matches constructor order when wiring use cases. Export both the interface and the token.

### Repositories (`application/ports/repositories/`)

- **`IPlaylistRepository`** (`PLAYLIST_REPOSITORY`): `save`, `getOneById`, `getMany`, `updateOneById(id, data)`, `deleteOneById`. Kernel types: `Playlist`, `PlaylistId`, `PlaylistUpdateData`.
- **`IPlaylistTrackRepository`** (`PLAYLIST_TRACK_REPOSITORY`): CRUD for playlist tracks; scoped by current user.
- **`IPlaylistSortingRepository`** (`PLAYLIST_SORTING_REPOSITORY`): Read/update sorting preferences for a playlist.
- **`IMusicTrackRepository`** (`MUSIC_TRACK_REPOSITORY`): Lookup and list music tracks (with filtering).
- **`IQueueRepository`** (`QUEUE_REPOSITORY`): Playback queue state (items, order, position).
- **`ISavedFilterRepository`** (`SAVED_FILTER_REPOSITORY`): CRUD for saved filter presets.
- **`IImageSearchRepository`** (`IMAGE_SEARCH_REPOSITORY`): Store/retrieve image search records.
- **`IMusicLibraryRepository`** (`MUSIC_LIBRARY_REPOSITORY`): CRUD for music libraries.
- **`IHiddenMusicTrackRepository`** (`HIDDEN_MUSIC_TRACK_REPOSITORY`): Hidden/disliked tracks.

### Queries (`application/ports/queries/`)

- **`IPlaylistStatsQuery`** (`PLAYLIST_STATS_QUERY`): `getPlaylistStats(playlistId)`, `getPlaylistsStats()`. Returns `PlaylistStatsDto` (bpmRange, energyRange, genresCount, etc.).
- **`IMetricsQuery`** (`METRICS_QUERY`): Home/dashboard metrics.
- **`ISavedFilterQuery`** (`SAVED_FILTER_QUERY`): Read-only saved filter data (e.g. options, active/current filter).
- **`IMusicTrackQueries`** (`MUSIC_TRACK_QUERIES`): Complex music-track reads (e.g. pagination, filters).
- **`IRecommendationDataPort`** (`RECOMMENDATION_DATA_PORT`): Aggregate audio features from tracks for recommendations.
- **`IRecommendationSearchPort`** (`RECOMMENDATION_SEARCH_PORT`): Search by features + criteria; returns `RecommendationMatch[]`.
- **`ITrackIndexerPort`** (`TRACK_INDEXER_PORT`): Index lifecycle (createIndex, indexTrack, indexTracks, deleteTrack, deleteTracks, recreateIndex, updateIndexMapping). Takes `MusicTrack`; no search (search is in `IRecommendationSearchPort`).

### Infrastructure ports (`application/ports/infrastructure/`)

- **`IAudioWaveformGenerator`** (`AUDIO_WAVEFORM_GENERATOR`): Generate waveform data for a track.
- **`IImageFileReader`** (`IMAGE_FILE_READER`): Read image bytes from the filesystem (e.g. for serving artwork).

## DTOs (`application/ports/dtos/`)

Shared result shapes used by ports and use cases (domain-facing, not GraphQL-specific):

- **`PlaylistTrackWithDetail`** — Playlist track plus expanded track details.
- **`PlaylistWithTrackDetailsAndSorting`** — Playlist with tracks (with detail) and sorting info.
- **`AudioFeatures`** — Aggregated features for recommendation (used by `IRecommendationDataPort`, `IRecommendationSearchPort`).
- **`RecommendationMatch`** — `{ track: Partial<MusicTrack>; similarity: number; reasons: string[] }` (used by `IRecommendationSearchPort`).

## Use cases

Each use case is a **plain class** (no `@Injectable()`). It has a plain constructor (no `@Inject` decorators). Dependencies are wired via **`createUseCaseProvider(UseCaseClass, inject)`** in `UseCasesModule`, where `inject` is a tuple of tokens (and/or classes like `ConfigService`) in the **same order** as the constructor parameters. See `application/use-cases/create-use-case.provider.ts`. Resolvers and controllers inject use case classes and call `execute(...)` (or equivalent).

### Playlist (`use-cases/playlist/`)

- **CreatePlaylist** — Input: `{ name, description?, isPublic }`. Returns `Playlist`.
- **GetPlaylist** — Input: `PlaylistId`. Returns `Playlist` or throws `NotFoundError`.
- **GetPlaylists** — No input. Returns `Playlist[]` for current user.
- **UpdatePlaylist** — Input: `PlaylistId` + partial data. Returns updated `Playlist` or throws `NotFoundError`.
- **DeletePlaylist** — Input: `PlaylistId`. Returns `boolean`.
- **GetPlaylistStats** — Input: `PlaylistId`. Returns `PlaylistStatsDto`.
- **GetPlaylistsStats** — No input. Returns `PlaylistStatsDto[]` for all playlists of current user.
- **ExportPlaylistToM3U** — Input: `PlaylistId`. Returns M3U file content.
- **GetFavorite** — Returns the “favorites” playlist for current user.

### Playlist track (`use-cases/playlist-track/`)

- **GetPlaylistTracks** — Input: `PlaylistId`. Returns `PlaylistTrack[]`.
- **GetPlaylistTracksWithDetail** — Input: `PlaylistId`. Returns tracks with full track details (uses DTO).
- **AddTrackToPlaylist** — Input: `PlaylistId`, `MusicTrackId`, position?. Returns updated list or throws.
- **RemoveTrackFromPlaylist** — Input: `PlaylistId`, `PlaylistTrackId`. Returns success.
- **UpdatePlaylistTracksPositions** — Input: `PlaylistId`, ordered `PlaylistTrackId[]`. Returns updated list.

### Playlist sorting (`use-cases/playlist-sorting/`)

- **GetPlaylistSortingByPlaylistId** — Input: `PlaylistId`. Returns sorting config or default.
- **UpdatePlaylistSorting** — Input: `PlaylistId`, sorting fields. Returns updated config.

### Playback queue (`use-cases/playback-queue/`)

- **GetQueue** — Returns current user’s queue (items, position).
- **AddTrackToQueue** — Input: track id, position?. Returns updated queue.
- **AddTracksToQueue** — Input: track ids, position?. Returns updated queue.
- **RemoveTrackFromQueue** — Input: queue item id. Returns updated queue.
- **UpdateQueuePositions** — Input: ordered item ids. Returns updated queue.
- **ResetQueue** — Clears queue. Returns empty queue.

### Music track (`use-cases/music-track/`)

- **GetTrack** — Input: `MusicTrackId`. Returns `MusicTrack` or throws `NotFoundError`.
- **GetWaveformData** — Input: `MusicTrackId`. Returns waveform data (uses `IAudioWaveformGenerator`).

### Saved filter (`use-cases/saved-filter/`)

- **GetSavedFilter** — Input: filter id. Returns saved filter or throws.
- **GetActiveFilters** — Returns active saved filters for current user.
- **GetCurrentFilter** — Returns current filter state.
- **GetStaticFilterOptions** — Returns static options for filter UI.
- **CreateSavedFilter** — Input: filter data. Returns created saved filter.
- **UpdateSavedFilter** — Input: id + partial data. Returns updated saved filter.
- **DeleteSavedFilter** — Input: id. Returns success.

### Image (`use-cases/image/`)

- **AddImageSearchRecord** — Records an image search for a given entity (e.g. track). Constructor: `IImageSearchRepository`, `ConfigService`.
- **ServeImage** — Input: path or id. Returns image bytes (uses `IImageFileReader`).

### Metrics (`use-cases/metrics/`)

- **GetHomeMetrics** — Returns home/dashboard metrics (uses `IMetricsQuery`).

### Recommendation (`use-cases/recommendation/`)

- **GetPlaylistRecommendations** — Input: playlist id, limit. Returns `TrackSimilarity[]` (uses `IRecommendationSearchPort`, `IRecommendationDataPort`).
- **GetTrackRecommendations** — Input: track id, limit. Returns `TrackSimilarity[]`.
- **RecreateElasticsearchIndex** — Recreates the track index (uses `ITrackIndexerPort`).
- **SyncAllTracksToElasticsearch** — Syncs all tracks to the index.
- **SyncTrackToElasticSearch** — Syncs a single track.

### Music library (`use-cases/music-library/`)

- **CreateLibrary**, **GetLibrary**, **GetLibraries**, **DeleteLibrary** — CRUD for music libraries.

### Music track (additional)

- **GetTracksWithPagination**, **GetTracksWithCursorPagination** — Paginated track lists (with filters).
- **ToggleFavorite**, **ToggleLike**, **ToggleDislike**, **ToggleBanger** — Toggle track flags.
- **GetRandomTrackId**, **GetRandomTrackWithStats** — Random track(s).
- **GetRecentlyPlayed**, **RegisterPlayedTrack** — Recent plays and registration.

## Module

**`UseCasesModule`** — Imports `ConfigModule`. Declares and exports all use cases via **`createUseCaseProvider(UseCaseClass, inject)`** (see `application/use-cases/create-use-case.provider.ts`). Port implementations are provided by **`AdaptersPersistenceModule`** and **`ElasticsearchModule`**, which are imported in `AppModule` and (for persistence) are `@Global()`, so use cases receive implementations via Nest DI.
