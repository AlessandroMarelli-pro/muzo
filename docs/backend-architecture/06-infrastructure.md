# Infrastructure

This document describes where **infrastructure** (DB, filesystem, audio) lives and how it is used by clean-arch adapters.

## Two locations

- **`backend/src/infrastructure/`** — Clean-arch-specific implementations of application **ports** used only by clean-arch use cases/adapters.
- **`backend/src/infrastructure/`** — Root-level infrastructure shared with the rest of the backend (e.g. Prisma, file I/O). Some clean-arch adapters import from here.

**Recommendation:** Prefer one source of truth per concern. For Prisma and image reading, either use only root `backend/src/infrastructure/` or only `infrastructure/` and update all adapters to use that single location. Currently both exist and some repositories use root Prisma while others use clean-arch Prisma (see below).

## Clean-arch infrastructure (`backend/src/infrastructure/`)

- **`database/prisma.service.ts`** — Nest `PrismaService` used by persistence adapters that import from clean-arch (e.g. `PlaylistStatsQuery`, `PlaylistSortingRepository`, `SavedFilterRepository`, `SavedFilterQuery`).
- **`audio/waveform-generator.ts`** — Implements `IAudioWaveformGenerator`. Used by `GetWaveformData` use case; wired in `AdaptersPersistenceModule` as `AUDIO_WAVEFORM_GENERATOR`.
- **`filesystem/image-file.reader.ts`** — Implements `IImageFileReader`. Used by image use cases; wired in `AdaptersPersistenceModule` as `IMAGE_FILE_READER`.

## Elasticsearch (`infrastructure/external-services/elasticsearch/`)

- **`ElasticsearchTrackIndexerAdapter`** — Implements `ITrackIndexerPort` (indexTrack, indexTracks, deleteTrack, etc.). Maps `MusicTrack` → ES document via `track-index-document.mapper.ts` (domain → infra only in adapter).
- **`RecommendationSearchAdapter`** — Implements `IRecommendationSearchPort`. Uses `ElasticsearchClient` directly to run search; builds query with `buildElasticsearchRecommendationQuery`, maps hits to `RecommendationMatch[]`. ES-specific types stay inside this adapter.
- **`ElasticsearchModule`** — Provides `TRACK_INDEXER_PORT`, `RECOMMENDATION_SEARCH_PORT`, `ElasticsearchClient`. Imported in `AppModule`.

## Root infrastructure (`backend/src/...`)

Persistence adapters may import Prisma from **clean-arch** (`infrastructure/database/prisma.service.ts`) via relative paths from `adapters/persistence/` (e.g. `../../infrastructure/database/prisma.service`). Image reader and waveform generator are in **clean-arch** infrastructure and wired in `AdaptersPersistenceModule`.

## Port bindings (summary)

| Port                                                 | Implementation                     | Location                             |
| ---------------------------------------------------- | ---------------------------------- | ------------------------------------ |
| `AUDIO_WAVEFORM_GENERATOR`                           | `WaveformGenerator`                | `infrastructure/audio/`              |
| `IMAGE_FILE_READER`                                  | `FileSystemImageReader`            | `infrastructure/filesystem/`         |
| `TRACK_INDEXER_PORT`                                 | `ElasticsearchTrackIndexerAdapter` | `infrastructure/.../elasticsearch/`  |
| `RECOMMENDATION_SEARCH_PORT`                         | `RecommendationSearchAdapter`      | `infrastructure/.../elasticsearch/`  |
| `PrismaService` (injected into repositories/queries) | `PrismaService`                    | `infrastructure/database/` (or root) |
