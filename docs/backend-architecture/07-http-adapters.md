# HTTP adapters

**Path:** `backend/src/adapters/http/`

HTTP adapters expose application use cases via REST-style endpoints. They depend on kernel and application (use cases); they do not contain business rules.

## Controllers

- **`controllers/image.controller.ts`** — Serves image bytes (e.g. artwork). Uses image use cases and/or `IImageFileReader`; may use `ServeImage` use case.
- **`controllers/audio-streaming.controller.ts`** — Audio streaming (e.g. track playback). Uses application layer for track resolution and stream handling.

Controllers decode request (path, query, body), call one or more use cases, and return HTTP response (e.g. binary stream, JSON). Auth/context: see **Context and auth** below.

## Context and auth

- **`context/http-auth.guard.ts`** — `HttpAuthGuard`: ensures a user (or anonymous) for HTTP routes that need action context. Use so that `getCurrentUserId()` and `user()` work in use cases invoked from HTTP.

Request-scoped action context is still provided by **`ActionContextMiddleware`** applied globally in `app.module.ts`, so `now()` and `user()` are available in HTTP handlers as well as GraphQL.

## Utilities

- **`utils/audio-content-type.ts`** — Content-Type / range handling for audio streaming if needed.

## Module

**`HttpModule`** — Imports `ConfigModule` and `UseCasesModule`. Registers `ImageController`, `AudioStreamingController`, and `HttpAuthGuard`. Registered in **`AppModule`** alongside `CleanArchGraphQLModule` and other feature modules.
