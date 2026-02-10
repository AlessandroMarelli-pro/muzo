# GraphQL API (Clean Arch)

This document describes the **Clean Architecture** GraphQL API exposed under the same GraphQL endpoint as the rest of the app. Types and operations below are implemented in `backend/src/adapters/graphql/`.

**Scope:** The tables below detail **User** and **Playlist** (and related types). The same endpoint also exposes Clean Arch operations for: **playlist tracks** (add/remove/reorder), **playback queue** (get, add, remove, reorder, reset), **saved filters** (CRUD, active/current filter, static options), **music player** state, and **metrics**. For their exact fields and arguments, see the schema (e.g. `schema.gql`) or the resolver/schema files in `adapters/graphql/`.

## Root queries

| Field                     | Returns        | Description                                               |
| ------------------------- | -------------- | --------------------------------------------------------- |
| `me`                      | `User!`        | Current user (from action context).                       |
| `playlist(id: Base64ID!)` | `Playlist`     | Single playlist by ID; NOT_FOUND if missing or not owned. |
| `playlists`               | `[Playlist!]!` | All playlists for the current user.                       |

## Root mutations

| Field              | Arguments                                      | Returns     | Description                                         |
| ------------------ | ---------------------------------------------- | ----------- | --------------------------------------------------- |
| `caCreatePlaylist` | `input: CreatePlaylistInput!`                  | `Playlist!` | Create a playlist (name, description?, isPublic?).  |
| `caUpdatePlaylist` | `id: Base64ID!`, `input: UpdatePlaylistInput!` | `Playlist!` | Update playlist; NOT_FOUND if missing or not owned. |
| `caDeletePlaylist` | `id: Base64ID!`                                | `Boolean!`  | Delete playlist; NOT_FOUND if missing or not owned. |

## Types

### User

- `id: Base64ID!`
- `email: String`
- `firstName: String`
- `lastName: String`
- `playlists: PlaylistsResult!` — `{ items: [Playlist!]! }`

### Playlist

- `id: Base64ID!`
- `name: String!`
- `description: String`
- `isPublic: Boolean!`
- `createdAt: DateTime!`
- `updatedAt: DateTime!`
- `createdById: Base64ID!`
- `updatedById: Base64ID`
- `tracks: [PlaylistTrack]` — resolved via DataLoader `context.loaders.playlistTracks` (batched per request).
- `stats: PlaylistStats` — resolved via DataLoader `context.loaders.playlistStats` (batched per request).

### PlaylistTrack

- `id: Base64ID!`
- `position: Int!`
- `addedAt: DateTime!`
- `trackId: Base64ID!`
- `playlistId: Base64ID!`

### PlaylistStats

- `bpmRange: Range!` — `{ min, max }`
- `energyRange: Range!`
- `genresCount: Int!`
- `subgenresCount: Int!`
- `topGenres: [String!]!`
- `topSubgenres: [String!]!`
- `numberOfTracks: Int!`
- `totalDuration: Float!`

### Inputs

- **CreatePlaylistInput**: `name: String!`, `description: String`, `isPublic: Boolean`
- **UpdatePlaylistInput**: `name: String`, `description: String`, `isPublic: Boolean`

### Scalars

- **Base64ID** — Opaque ID; decode on server to kernel IDs (e.g. PlaylistId).

## Errors

- Domain `NotFoundError` is mapped to GraphQL errors with `extensions.code: "NOT_FOUND"` and a message. No stack traces in production formatting.
