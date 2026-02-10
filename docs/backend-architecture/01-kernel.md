# Kernel layer

**Path:** `backend/src/kernel/`

The kernel holds shared **types**, **identities (IDs)**, **errors**, and **action context**. It has no dependencies on application, adapters, or infrastructure. Used by domain, application, and adapters.

## Contents

### Types (`kernel/types/`)

- **`model-types.ts`** — Domain entity shapes: `Playlist`, `User`, `PlaylistTrack`, `MusicTrack`. All extend `ModelBase<Id>` (id, createdAt, createdById, updatedAt, updatedById). Optional fields use `Maybe<T>`.
- **`value-object.ts`** — Value objects (e.g. `Email`, `Name`).
- **`context.ts`** — Action context access:
  - `als`: `AsyncLocalStorage<ActionContext>` for request-scoped context.
  - `now()`, `user()`: read current timestamp and current user from ALS (throw if missing).
  - `getCurrentUserId()`: returns DB-ready user ID (`extractModelId(user().id).dbId`) for persistence `where` clauses.
- **`errors.ts`** — Domain errors:
  - `NotFoundError`, `createNotFoundError(message)`.
  - `DomainError` union; `isDomainError(x)` type guard (object with `errorType`, no `error` property).
- **`models.ts`** — Re-exports model/ID helpers (e.g. `models.playlist.id`, `models.playlist.isId`).
- **`common.ts`** — Shared helpers (e.g. `Maybe`, `fail`).
- **`factory.ts`** — Type/factory re-exports.

### IDs (`kernel/ids/`)

- **Branded IDs** — e.g. `PlaylistId`, `UserId`, `MusicTrackId`, `PlaylistTrackId` (branded strings like `"Playlist:uuid"`).
- **`factory.ts`** — `modelIdFactory(prefix)` returns `{ isId, id }`: `id(raw)` builds `"prefix:raw"`, `isId(x)` type guard. `extractModelId(id)` returns `{ modelName, dbId }` for persistence.
- **`scalars.ts`** — Brand type definition.
- **Usage:** Domain and application use branded IDs; persistence uses `extractModelId(id).dbId`; GraphQL uses Base64ID scalar and `parsePlaylistId`/`parseUserId` at the boundary.

### Pagination (`kernel/types/pagination.ts`)

- **`PaginationResult<T>`**, **`CursorPaginationResult<T>`**, **`WithCursorPagination<T>`**, **`PaginationOptions`**, **`SortingOptions`**. Uses `Maybe` from `kernel/common.ts` (kernel must not import from GraphQL or other outer layers).

## Dependency rule

Kernel does **not** import from `application/`, `adapters/`, or `infrastructure/`. Only from Node/TS and its own files. Do not use `Maybe` from `graphql/jsutils/Maybe`; use `Maybe` from `kernel/common.ts`.

## Domain layer (this project)

This project does **not** use a separate `domain/` folder. Entity shapes and value types live in **kernel/types** (e.g. `model-types.ts`, `value-object.ts`). Optional domain entities/aggregates would go in `domain/entities/<aggregate-name>/` if introduced later.
