# Clean Architecture with NestJS

This document describes the Clean Architecture used in this backend and how it works. All clean-arch code is under **`backend/src/clean-arch/`**; the structure is **kernel → application → adapters → infrastructure** (no separate `domain/`; entity shapes live in kernel). Composition root: **`backend/src/app.module.ts`**.

Details: [docs/backend-architecture/](backend-architecture/README.md)
---

## 1. Why this structure

- **Dependency rule**: Dependencies point **inward**. The kernel does not depend on anything outside itself; the application depends only on the kernel and on **port** interfaces (not concrete adapters). Adapters and infrastructure implement those ports. So the core logic (use cases, types) stays independent of GraphQL, Prisma, or HTTP.
- **Testability**: Use cases can be tested by passing mock implementations of the port interfaces; no need to spin up Nest or a database.
- **Clear boundaries**: Ports (interfaces + typed tokens) define the contract between application and the outside world; adapters own the mapping from that contract to GraphQL, DB, or external services.
- **NestJS-native**: Layers are wired with Nest modules and DI; use cases are registered via **`createUseCaseProvider`**, and port tokens (**`createToken<IPort>('...')`**) are bound to implementations in **`AdaptersPersistenceModule`** and **`ElasticsearchModule`**.

---

## 2. Folder structure (this repo: `backend/src/clean-arch/`)

Clean-arch code lives under **`backend/src/clean-arch/`**. There is **no separate `domain/`** folder; entity shapes and value types live in **kernel/types** (e.g. `model-types.ts`, `value-object.ts`). The composition root is **`backend/src/app.module.ts`** (no separate `app/` folder).

```
backend/src/clean-arch/
├── kernel/                           # Types, IDs, errors, context — no deps on outer layers
│   ├── types/                        # model-types, context, errors, models, pagination, value-object, defaults, factory
│   │   ├── model-types.ts            # Playlist, User, MusicTrack, etc.; ModelBase; ActionContext
│   │   ├── context.ts                # als, now(), user(), getCurrentUserId()
│   │   ├── errors.ts                 # NotFoundError, DomainError, isDomainError
│   │   ├── models.ts                 # models.playlist.id(), models.playlist.isId(), etc.
│   │   ├── pagination.ts             # PaginationResult, CursorPaginationResult, Maybe from common
│   │   ├── value-object.ts           # Email, Name
│   │   └── ...
│   ├── ids/                          # Branded IDs, modelIdFactory, extractModelId
│   │   ├── factory.ts
│   │   ├── scalars.ts
│   │   └── index.ts
│   └── common.ts                     # Maybe<T>, fail()
│
├── application/                      # Ports + use cases — depends only on kernel + port tokens
│   ├── ports/                        # Interfaces and typed tokens (createToken<IPort>('...'))
│   │   ├── repositories/             # IPlaylistRepository, IMusicTrackRepository, ...
│   │   ├── queries/                  # IPlaylistStatsQuery, IRecommendationSearchPort, ITrackIndexerPort, ...
│   │   ├── infrastructure/          # IAudioWaveformGenerator, IImageFileReader
│   │   └── dtos/                     # AudioFeatures, RecommendationMatch, PlaylistTrackWithDetail, ...
│   ├── use-cases/                    # One class per use case; plain constructor; wired via createUseCaseProvider
│   │   ├── playlist/                 # CreatePlaylist, GetPlaylist, GetPlaylists, UpdatePlaylist, ...
│   │   ├── playlist-track/           # AddTrackToPlaylist, GetPlaylistTracks, ...
│   │   ├── playback-queue/           # GetQueue, AddTrackToQueue, ...
│   │   ├── music-track/              # GetTrack, GetTracks, GetWaveformData, ToggleFavorite, ...
│   │   ├── music-library/            # CreateLibrary, GetLibrary, GetLibraries, DeleteLibrary
│   │   ├── saved-filter/             # GetSavedFilter, CreateSavedFilter, ...
│   │   ├── recommendation/           # GetPlaylistRecommendations, SyncTrackToElasticSearch, ...
│   │   ├── image/                    # AddImageSearchRecord, ServeImage
│   │   ├── metrics/                  # GetHomeMetrics
│   │   ├── create-use-case.provider.ts   # createUseCaseProvider(UseCaseClass, inject) for Nest
│   │   └── use-cases.module.ts       # UseCasesModule: providers from createUseCaseProvider
│   └── utils/
│       └── create-token.ts           # createToken<T>(name), InjectionToken<T> — for port DI + order safety
│
├── adapters/                         # Implement ports; call use cases; depend on kernel + application (ports)
│   ├── persistence/                  # Repositories, queries, loaders, mappers — AdaptersPersistenceModule
│   │   ├── repositories/             # playlist/, playlist-track/, music-track/, queue/, saved-filter/, ...
│   │   ├── queries/                  # playlist/playlist-stats, metrics, saved-filter, music-track
│   │   ├── recommendation/           # RecommendationDataAdapter
│   │   └── persistence.module.ts    # AdaptersPersistenceModule (@Global), port → implementation bindings
│   ├── graphql/                      # Schema, resolvers, context, auth, filters — CleanArchGraphQLModule
│   │   ├── schema/                   # Types and inputs (code-first)
│   │   ├── resolvers/                # UserResolver, CleanArchPlaylistResolver, NodeResolver, ...
│   │   ├── mappers/                  # GraphQL ↔ kernel/domain DTOs
│   │   ├── context/                  # AuthGuard
│   │   ├── filters/                  # DomainErrorExceptionFilter
│   │   └── scalars/                  # Base64ID
│   ├── http/                         # REST controllers — HttpModule
│   │   ├── controllers/              # image, audio-streaming, recommendation
│   │   └── context/                  # HttpAuthGuard
│   └── common/                       # Shared adapter utilities
│       ├── middlewares/              # ActionContextMiddleware (ALS)
│       └── utils/                    # parse-id.ts, id-encoding.ts
│
└── infrastructure/                   # DB, audio, filesystem, external services — used by adapters only
    ├── database/                     # PrismaService
    ├── audio/                        # WaveformGenerator (IAudioWaveformGenerator)
    ├── filesystem/                   # FileSystemImageReader (IImageFileReader)
    └── external-services/
        └── elasticsearch/            # ElasticsearchTrackIndexerAdapter, RecommendationSearchAdapter
            ├── elasticsearch-track-indexer.adapter.ts
            ├── recommendation-search.adapter.ts
            ├── elasticsearch.client.ts
            ├── elasticsearch.module.ts   # TRACK_INDEXER_PORT, RECOMMENDATION_SEARCH_PORT
            ├── mappers/              # track-index-document.mapper (MusicTrack ↔ ES doc)
            └── ...
```

**Layers in this repo:**

| Layer           | Path                    | Role                                                                 |
| --------------- | ----------------------- | -------------------------------------------------------------------- |
| **kernel**      | `clean-arch/kernel/`    | Types, IDs, errors, context (ALS). No imports from outer layers.     |
| **application** | `clean-arch/application/` | Ports (interfaces + `createToken`), use cases (wired via `createUseCaseProvider`), DTOs. Depends only on kernel + port tokens. |
| **adapters**    | `clean-arch/adapters/`  | Persistence (repos, queries, loaders), GraphQL (resolvers, schema), HTTP (controllers). Implement ports; call use cases. |
| **infrastructure** | `clean-arch/infrastructure/` | Prisma, waveform, image reader, Elasticsearch. Implements ports used by adapters/use cases. |
| **composition root** | `backend/src/app.module.ts` | Imports `AdaptersPersistenceModule`, `UseCasesModule`, `CleanArchGraphQLModule`, `HttpModule`, `ElasticsearchModule`; GraphQL context + DataLoaders; `ActionContextMiddleware`. |

---

## 3. Dependency flow

| Layer              | Depends on                              | Must not depend on                                               |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| **kernel**         | Nothing (internal + Node/stdlib only)   | application, adapters, infrastructure (no GraphQL)              |
| **application**    | kernel, **port interfaces & tokens**     | adapters, infrastructure (only port types; no concrete classes) |
| **adapters**       | application (ports, use cases), kernel  | — (may use infrastructure)                                      |
| **infrastructure** | kernel (types/IDs as needed)             | application use cases, adapters                                 |
| **app**            | adapters, infrastructure, app modules   | — (wires everything)                                            |

**Rule**: Source code dependencies only point **inward**. Application defines **port** interfaces; adapters and infrastructure **implement** them. Use Nest’s DI to bind implementations at the composition root (`app.module.ts`). In this repo: no separate domain layer (entities in kernel); use cases depend on port tokens via `createToken`; bindings live in `AdaptersPersistenceModule` and `ElasticsearchModule`.

---

## 4. NestJS integration

### 4.1 Modules (this repo)

| Clean layer        | NestJS role                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **kernel**         | Plain TS; no Nest module. Re-exports only. No injectables.                                   |
| **application**    | `UseCasesModule`: use cases wired via `createUseCaseProvider(UseCaseClass, inject)`; exports use-case classes. Port tokens from `createToken<IPort>('...')`. |
| **adapters**       | `AdaptersPersistenceModule` (@Global): port → repository/query/adapter bindings. `CleanArchGraphQLModule`: resolvers, schema, filters. `HttpModule`: controllers. |
| **infrastructure** | `ElasticsearchModule`: `TRACK_INDEXER_PORT`, `RECOMMENDATION_SEARCH_PORT`. Prisma, waveform, image reader used by persistence module. |
| **app**            | `AppModule`: imports `AdaptersPersistenceModule`, `UseCasesModule`, `CleanArchGraphQLModule`, `HttpModule`, `ElasticsearchModule`; GraphQL context + DataLoaders; `ActionContextMiddleware`. |

### 4.2 Dependency injection (this repo)

- **Use cases** = Plain classes in `application/use-cases/...` (no `@Injectable()`). They have a plain constructor (no `@Inject`). Dependencies are wired via **`createUseCaseProvider(UseCaseClass, inject)`** in `UseCasesModule`; `inject` is a tuple of port tokens (and e.g. `ConfigService`) in the **same order** as the constructor. Constructor receives **port interfaces** (e.g. `IPlaylistRepository`), not concrete classes.
- **Ports** = TypeScript interfaces in `application/ports/repositories/`, `application/ports/queries/`, `application/ports/infrastructure/`. Each port has a **typed token** from **`createToken<IPort>('TOKEN_NAME')`** (`application/utils/create-token.ts`) so DI order is type-checked. Implementations live in `adapters/` and `infrastructure/`.
- **Resolvers** = In `adapters/graphql/resolvers/`. They inject use-case classes and call them. No business logic in resolvers.
- **Repository/adapter implementations** = In `adapters/persistence/` and `infrastructure/`. They implement port interfaces; name classes `*Repository` or `*Adapter`, not `*Port`.

**Composition root:** In `AdaptersPersistenceModule` and `ElasticsearchModule`, register e.g.:

```ts
{ provide: PLAYLIST_REPOSITORY, useClass: PlaylistRepository }
```

Use cases receive implementations via the tokens; they never import concrete adapter classes.

### 4.3 Responsibilities

| Component                | Responsibility                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Resolver**             | Decode GraphQL input → call one use case → map result to GraphQL. No business rules.                        |
| **Use case**             | Orchestrate domain and ports: load/save via repositories, call domain logic, return result or domain error. |
| **Repository (adapter)** | Implement port: map domain ↔ DB; use Prisma/Drizzle only here.                                              |
| **Domain entity**        | Encapsulate invariants and domain rules.                                                                    |

---

## 5. Flow of a request

1. **Client** sends GraphQL request.
2. **Resolver** (adapter): validates/decodes input, gets use-case service from DI, calls e.g. `createPlaylistUseCase.execute(input)`.
3. **Use case** (application): uses `IPlaylistRepository` and other ports to load/save; uses domain entities and kernel types; returns domain result or domain error.
4. **Repository** (adapter): implements port; uses Prisma/Drizzle to persist; maps DB ↔ domain/kernel types.
5. **Resolver**: maps use-case result to GraphQL (or error union) and returns response.

Domain and application never touch GraphQL or Prisma directly; they only depend on kernel types and port interfaces.

---

## 6. Kernel: types vs ids

### kernel/types

**What**: Shared **data shapes** used by domain and application — no behavior, only types/interfaces.

**Typical contents**:

- **Entity types** — Interfaces for domain aggregates/entities (e.g. `Playlist`, `MusicTrack`, `MusicLibrary`): fields, relations as IDs. Same idea as `modelTypes.ts` in the backend-architecture-examples.

- **Value-object types** — Branded or plain types for domain values: `Name`, `Email`, `FileName` (if you define them in kernel rather than a validators package), or things like `PaginationInput` / `PaginationResult`, `DateRange`, etc.

- **Context / viewer types** — e.g. `Viewer` (current user), or any execution-context type used by use cases.

- **Shared DTO-like types** — Input/result shapes that cross layer boundaries (e.g. `CreatePlaylistInput`, `PlaylistResult`) when they’re expressed in domain terms rather than GraphQL-specific.

So: **kernel/types** = “what shape is this object?” — entity interfaces, value types, context, shared domain-facing shapes.

### kernel/ids

**What**: Everything about **identity** — types and runtime helpers to create, validate, and narrow IDs (and optionally “is this a Playlist?” style guards).

**Typical contents**:

- **Branded ID types** — e.g. `PlaylistId`, `MusicTrackId`, `UserId` (e.g. `Brand<string, 'PlaylistId'>`). These are the _types_ for IDs.

- **ID factories** — Functions that take a raw string (or DB id) and return a branded ID, e.g. `playlistId(id: string): PlaylistId`, and maybe a reverse like `extractPlaylistId(id: PlaylistId): { dbId: string }` for persistence.

- **ID guards** — Type guards: `isPlaylistId(x: string): x is PlaylistId`, `isPlaylist(obj: { id: string }): obj is Playlist`.

- **Optional: small “model” registry** — A single place that groups per-entity id/isId/is (and maybe `instantiateNew`) for that entity, like `models.playlist.id`, `models.playlist.isId`, `models.playlist.is` in the examples. That registry can live in **kernel/ids** (or a thin `kernel/models.ts` that re-exports from ids + types).

So: **kernel/ids** = “identities only”: ID types, creation, validation, and type guards. No entity _shape_ definitions — those stay in **kernel/types**.

**Rule of thumb**: if it’s “what shape is this object?” → **types**; if it’s “is this a valid ID / which entity is this?” → **ids**.

---

## 7. Why ID factories and typed IDs?

### 1. Type safety — don’t mix IDs

Without branding, every ID is a `string`. You can pass a track ID where a playlist ID is expected and the compiler won’t complain; bugs show up at runtime (wrong resource, weird errors).

With branded types and a factory:

- `PlaylistId` and `MusicTrackId` are different types.
- Functions can require `PlaylistId` or `MusicTrackId`.
- The compiler rejects `getPlaylist(trackId)` or `addTrack(playlistId, playlistId)`.

So: **typed IDs prevent mixing identities at compile time.**

### 2. Single place for format and creation

IDs often have a rule: e.g. `"Playlist:uuid"`, or base64, or a prefix. The **factory** is the single place that:

- Knows that format.
- Creates a value and types it as `PlaylistId`.

If you later change format (prefix, encoding, etc.), you change the factory (and maybe the guard), not every call site. So: **factory = single place for “how we build this ID”.**

### 3. Validate once at the boundary

Input from GraphQL or the DB is untrusted. You validate once (e.g. “does this string look like a valid PlaylistId?”) using a guard or the factory. After that, the **type** carries the information “this is a valid PlaylistId”; the rest of the code doesn’t re-validate. So: **check at the boundary, then rely on types inside.**

### 4. Clearer domain and refactors

`function getPlaylist(id: PlaylistId)` is clearer than `function getPlaylist(id: string)`. The type documents intent and makes refactors safer (e.g. renaming or changing ID shape) because the compiler tracks every use.

### Summary

| Idea                | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| **Branded ID type** | Compiler enforces “playlist ID vs track ID”; no accidental swapping.       |
| **ID factory**      | Single place to create valid IDs and enforce format; easy to change later. |
| **ID guard**        | Validate at boundaries (API, DB); after that, type = “already checked”.    |

So the point of having an ID factory and checking ID types is: **safer code (no wrong IDs), one place for format/creation, and validate once at the edge.** If your IDs are always “any string” and you never mix them, you can skip it, but in larger codebases the factory + typed IDs usually pay off.

---

## 8. Related docs

- **docs/backend-architecture/** — Per-layer docs for `backend/src/clean-arch/`: kernel (01), application (02), persistence (03), GraphQL (04), GraphQL API (05), infrastructure (06), HTTP adapters (07), app wiring (08).

---

## 9. Quick reference

| Concept                    | Location                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| Types, errors, IDs, context | `clean-arch/kernel/`                                                    |
| Entity shapes (no domain/) | `clean-arch/kernel/types/model-types.ts`, `value-object.ts`             |
| Port interfaces + tokens   | `clean-arch/application/ports/` (use `createToken<IPort>('...')`)      |
| Use cases + wiring         | `clean-arch/application/use-cases/` + `createUseCaseProvider(..., inject)` in `use-cases.module.ts` |
| createToken helper         | `clean-arch/application/utils/create-token.ts`                         |
| Persistence (repos, queries, loaders) | `clean-arch/adapters/persistence/`                             |
| GraphQL resolvers, schema  | `clean-arch/adapters/graphql/`                                         |
| HTTP controllers           | `clean-arch/adapters/http/controllers/`                                |
| DB, Elasticsearch, audio, filesystem | `clean-arch/infrastructure/`                                  |
| Port → implementation     | `AdaptersPersistenceModule`, `ElasticsearchModule`                     |
| Composition root          | `backend/src/app.module.ts`                                             |
