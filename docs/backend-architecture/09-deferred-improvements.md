# Deferred Clean Architecture Improvements

This document lists improvements to the clean-arch backend that can be done later. These are optional and do not block current work.

---

## 1. Required fixes (high priority)

These break the layer isolation rules and should be addressed first:

- **Application layer depending on `shared`**
  - `application/use-cases/job-scheduler/ScheduleBatchAudioScan.ts` imports `FileInfo` from `src/shared/services/file-scanning.service`
  - **Fix:** Use `FileInfo` from `application/ports/dtos/FileInfo.ts` instead

- **Infrastructure depending on `shared`**
  - `infrastructure/job-scheduler/audio-scan-scheduler-producer.adapter.ts` imports `FileInfo` from `src/shared/services/file-scanning.service`
  - **Fix:** Use `FileInfo` from `application/ports/dtos/FileInfo.ts` instead

---

## 2. Optional improvements (later)

These further reduce coupling to NestJS and improve separation of concerns.

### 2.1 NestJS imports in application layer

Several application files import from `@nestjs/*`:

| File | Import | Purpose |
|------|--------|---------|
| `UpdatePlaylistTracksPositions.ts` | `NotFoundException` | Thrown when playlist not found |
| `GetWaveformData.ts` | `NotFoundException` | Thrown when track not found |
| `AddImageSearchRecord.ts` | `ConfigService` | Config access |
| `create-use-case.provider.ts` | `FactoryProvider` | DI wiring |
| `use-cases.module.ts` | `ConfigModule`, `ConfigService` | Nest module setup |
| `create-token.ts` | `Type` | Typed DI token |

**Possible approach:**

- Introduce application-level exceptions (e.g. `ApplicationNotFoundError`) in the kernel or application layer and use those instead of `NotFoundException`.
- Move `ConfigService` usage: inject config via a port (e.g. `IConfigReader`) so use cases stay framework-agnostic.
- Keep `FactoryProvider`, `Type`, `ConfigModule`, `ConfigService` in `create-use-case.provider.ts` and `use-cases.module.ts` as composition-root concerns, or move them to a separate `composition/` layer outside the application.

### 2.2 Duplicate `FileInfo` definitions

There are multiple `FileInfo` interfaces:

- `application/ports/dtos/FileInfo.ts` (canonical for clean-arch)
- `application/ports/dtos/AudioAnalysis.ts` (duplicate)
- `shared/services/file-scanning.service.ts`
- `modules/ai-integration/ai-service.types.ts`

**Possible approach:** Consolidate to a single source (e.g. `application/ports/dtos/FileInfo.ts`) and have other modules re-export or depend on it.

---

## Reference

- Clean architecture docs: `docs/clean-architecture-nestjs.md`, `docs/backend-architecture/`
- Context: `.cursor/clean-arch-context.md`
