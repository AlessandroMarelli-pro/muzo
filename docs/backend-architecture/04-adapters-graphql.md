# GraphQL adapters

**Path:** `backend/src/adapters/graphql/`

GraphQL adapters expose the application layer via GraphQL: schema, resolvers, context, auth, and error handling. They depend on kernel and application (use cases); they do not contain business rules.

## Schema (code-first)

IDs are exposed as **`Base64ID`** scalar; resolvers decode with `parsePlaylistId(id)` etc. before calling use cases.

### Core

- **`schema/user.schema.ts`** — `User` (id, email, firstName, lastName, playlists), `PlaylistsResult` (items).
- **`schema/playlist.schema.ts`** — `CleanArchPlaylist` (id, name, description, isPublic, createdAt, updatedAt, createdById, updatedById, tracks?, stats?).
- **`schema/playlist-track.schema.ts`** — `CleanArchPlaylistTrack` (id, position, addedAt, trackId, playlistId).
- **`schema/playlist-stats.schema.ts`** — `CleanArchPlaylistStats` (bpmRange, energyRange, genresCount, subgenresCount, topGenres, topSubgenres, numberOfTracks, totalDuration).
- **`schema/common.schema.ts`** — `Range` (min, max).
- **`schema/playlist.input.ts`** — `CleanArchCreatePlaylistInput`, `CleanArchUpdatePlaylistInput`.

### Other Clean Arch types

- **`schema/playlist-sorting.schema.ts`**, **`schema/playlist-sorting.input.ts`** — Playlist sorting types and inputs.
- **`schema/playlist-track.input.ts`** — Inputs for adding/moving playlist tracks.
- **`schema/queue-item.schema.ts`**, **`schema/queue.input.ts`** — Playback queue types and inputs.
- **`schema/track.schema.ts`** — Music track (Clean Arch).
- **`schema/saved-filter.schema.ts`**, **`schema/saved-filter.input.ts`** — Saved filter types and inputs.
- **`schema/metrics.schema.ts`** — Home/dashboard metrics.
- **`schema/music-player.schema.ts`** — Music player state (e.g. now playing).
- **`schema/common.input.ts`** — Shared input types.

## Resolvers

Resolvers decode input (e.g. Base64ID → kernel ID), call one use case or a DataLoader from context, then return the result. Domain errors (e.g. `NotFoundError`) bubble to `DomainErrorExceptionFilter`.

- **`UserResolver`** — Root query `me` (current user from `user()`). Field `playlists` → `GetPlaylists` use case, returns `PlaylistsResult`.
- **`CleanArchPlaylistResolver`** — Root: `playlist(id)`, `playlists()`. Mutations: `caCreatePlaylist`, `caUpdatePlaylist`, `caDeletePlaylist`. Field resolvers `stats` and `tracks` use **DataLoaders** from context (`playlistStats`, `playlistTracks`) to avoid N+1. All ID args use `parsePlaylistId`; guarded by `AuthGuard`.
- **`PlaylistTrackResolver`** — Mutations/queries for adding/removing/reordering playlist tracks; uses playlist-track use cases and loaders where appropriate.
- **`PlaybackQueueResolver`** — Queries/mutations for queue (get, add, remove, reorder, reset); uses playback-queue use cases.
- **`SavedFilterResolver`** — Queries/mutations for saved filters; uses saved-filter use cases.
- **`MusicPlayerResolver`** — Music player state (e.g. now playing); uses application ports/use cases as needed.
- **`NodeResolver`** — Global `node(id)` for Relay-style node interface if used.

## DataLoaders

DataLoaders are **per-request**, created in GraphQL context in `app.module.ts` (see [08-app-wiring.md](08-app-wiring.md)).

- **`playlistStats`** — `createPlaylistStatsLoader(statsQuery)`. Field `CleanArchPlaylist.stats`.
- **`playlistTracks`** — `createPlaylistTracksLoader(playlistTrackRepository)`. Field `CleanArchPlaylist.tracks`.
- **`playlistContainsTrack`** — `createPlaylistContainsTrackLoader(playlistTrackRepository)`.
- **`playlistTracksWithTrack`** — `createPlaylistTracksWithTrackLoader(playlistTrackRepository)`.

Field resolvers use `context.loaders.playlistStats.load(parent.id)` (and similarly for other loaders) so that many playlists in one query share a single batched call per loader type.

## Mappers

GraphQL ↔ domain/kernel DTOs when resolvers need to shape output:

- **`mappers/saved-filter.mapper.ts`** — Saved filter domain → GraphQL type.
- **`mappers/track.mapper.ts`** — Track domain → GraphQL type.

Playlist/playlist-track often use kernel types directly or minimal mapping in the resolver.

## Context and auth

- **`AuthGuard`** — Ensures a current user (e.g. sets `req.user = getAnonymousUser()` when no real auth). Used by resolvers that require a user.
- **`ActionContextMiddleware`** — Runs for all routes (configured in `app.module.ts`). Builds `ActionContext { now, user }` and runs the rest of the request inside `als.run(actionContext, () => next())` so `now()` and `user()` work for the whole request, including field resolvers. This is the **only** ALS setup in use (no separate ActionContextInterceptor).
- **`kernel/types/defaults.ts`** — `getAnonymousUser()` returns a kernel `User` when no real auth is present.

## Errors

- **`DomainErrorExceptionFilter`** — Registered as `APP_FILTER`. If the thrown value is `isDomainError(exception)` (e.g. `NotFoundError`), maps to a `GraphQLError` with `extensions.code: 'NOT_FOUND'` and no stack. Other errors are rethrown.

## Scalars and utils

- **`scalars/base64-id.scalar.ts`** — `Base64ID` scalar; serializes/parses IDs with base64 encoding.
- **`adapters/common/utils/id-encoding.ts`** — `toBase64Id`, `fromBase64Id`.
- **`adapters/common/utils/parse-id.ts`** — `parsePlaylistId(value)`, `parseUserId(value)`, `parseMusicTrackId(value)`, etc. Validate and return kernel IDs or throw `BadRequestException`. Use `Maybe` from `kernel/common` in schema/inputs for nullable fields (not GraphQL’s `Maybe`).

## Module

**`CleanArchGraphQLModule`** — Imports `UseCasesModule`. Registers: all resolvers above, `AuthGuard`, `Base64ID`, `DomainErrorExceptionFilter` (APP_FILTER). Does **not** register `ActionContextInterceptor`; request-scoped context is set by **`ActionContextMiddleware`** in `app.module.ts`. GraphQL path receives DataLoaders via `GraphQLModule.forRootAsync` context in `app.module.ts`.
