# App wiring (composition root)

**Path:** `backend/src/app.module.ts` (no separate `app/` folder)

The composition root wires Clean Architecture modules and configures GraphQL context (including DataLoaders) and global middleware.

## Module order (imports)

1. **Config** — `ConfigModuleSetup`, `GraphiQLModule`.
2. **Clean-arch persistence and use cases** — `AdaptersPersistenceModule`, `UseCasesModule`. These must be loaded before GraphQL and HTTP so port tokens are available.
3. **GraphQL** — `GraphQLModule.forRootAsync(...)`, then `GraphQLModule`.
4. **Shared / feature modules** — `SharedModule`, `QueueModule`, `HealthModule`, `HttpModule`, `GraphQLModule`, `ElasticsearchModule`, `MusicLibraryModule`, etc.

`AdaptersPersistenceModule` is `@Global()`, so port bindings (e.g. `PLAYLIST_REPOSITORY` → `PlaylistRepository`) are available to any module that injects those tokens, including use cases declared in `UseCasesModule` and the GraphQL context factory. `ElasticsearchModule` provides `TRACK_INDEXER_PORT` and `RECOMMENDATION_SEARCH_PORT`.

## ActionContextMiddleware

`AppModule` configures a global middleware:

- **`ActionContextMiddleware`** — Applied to all routes (`.forRoutes({ path: '*', method: RequestMethod.ALL })`). Builds `ActionContext { now, user }` (user from `req.user` or anonymous) and runs the rest of the pipeline inside `als.run(actionContext, () => next())`. So every request (GraphQL and HTTP) has `now()` and `user()` available; use cases and repositories use `getCurrentUserId()` for scoping.

Order: GraphiQL is mounted first so that middleware runs before the GraphQL handler; the same middleware runs for HTTP routes.

## GraphQL context and DataLoaders

`GraphQLModule.forRootAsync`:

- **`imports: [AdaptersPersistenceModule]`** — So the factory’s `inject` list can resolve `PLAYLIST_STATS_QUERY` and `PLAYLIST_TRACK_REPOSITORY`.
- **`inject: [ConfigService, PLAYLIST_STATS_QUERY, PLAYLIST_TRACK_REPOSITORY]`** — Injected into the `useFactory` callback.
- **`context: ({ req, res }) => ({ req, res, loaders: { ... } })`** — For each request, creates:
  - `playlistStats: createPlaylistStatsLoader(statsQuery)`
  - `playlistTracks: createPlaylistTracksLoader(playlistTrackRepository)`
  - `playlistContainsTrack: createPlaylistContainsTrackLoader(playlistTrackRepository)`
  - `playlistTracksWithTrack: createPlaylistTracksWithTrackLoader(playlistTrackRepository)`

Resolvers receive this context and use `context.loaders.*` for batched fields (e.g. `Playlist.stats`, `Playlist.tracks`).

## Summary

| Concern                        | Where                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Port → implementation bindings | `AdaptersPersistenceModule` (persistence ports), `ElasticsearchModule` (indexer, recommendation search) |
| Use cases                      | `UseCasesModule` (wired via `createUseCaseProvider`; implementations from global/imported modules)      |
| GraphQL API                    | `GraphQLModule` + `GraphQLModule.forRootAsync` (schema, resolvers, loaders)                             |
| HTTP API                       | `HttpModule` (controllers)                                                                              |
| Request-scoped context (ALS)   | `ActionContextMiddleware` in `app.module.ts`                                                            |
| Domain errors → GraphQL        | `DomainErrorExceptionFilter` in `GraphQLModule`                                                         |
