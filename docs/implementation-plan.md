# Implementation plan: deployment & local app

Order to achieve the goals in [deployment-choices.md](./deployment-choices.md).

---

## First priority

**Deploy the full stack on a VPS — without AI service and without database sync.**

- **VPS:** One server (e.g. Hetzner, DigitalOcean) running backend + frontend + Redis (+ SQLite on disk or a single DB). Elasticsearch stays external.
- **No AI:** Backend must start and run without the Python AI service; analysis features are disabled or no-op.
- **No database sync:** No Turso, no replica, no local↔cloud sync yet. Use SQLite on the VPS (or a simple hosted DB) so the app is live; Turso and sync come later.

Everything below is ordered so that **Phase 1** delivers this first priority; later phases add Turso, sync, and the local “single app” launcher.

---

## Phase 1 — Deploy on VPS (no AI, no sync)

*Goal: get the app running on a VPS with no AI service and no database sync.*

### 1.1 Make the backend run without the AI server

- **Why first:** AiModule is always loaded; the AI pool does startup health checks and can block or slow boot if no AI is running.
- **Goal:** Backend starts and stays up with no AI process.
- **Options:** Make AiModule conditional (e.g. env `AI_SERVICE_ENABLED=false`) or make the AI pool tolerate “no instances” (no assignment, analysis jobs no-op or deferred).
- **Outcome:** You can deploy on the VPS without running the Python AI service.

### 1.2 Make Elasticsearch optional / graceful

- **Why next:** ES is always imported; connection or index creation can fail at boot or first use and break the app.
- **Goal:** Backend starts and runs when `ELASTICSEARCH_NODE` is unset or ES is unreachable; recommendation/sync features degrade (empty or “unavailable”) instead of crashing.
- **Options:** Conditional ElasticsearchModule (e.g. only when `ELASTICSEARCH_NODE` is set), or wrap ES client usage in try/catch and return safe defaults.
- **Outcome:** VPS can run with external ES or without ES; no ES container on the VPS.

### 1.3 Deploy full stack on VPS (Docker or direct)

- **Goal:** Backend + frontend + Redis on the VPS; database = SQLite file on the VPS (or single DB), no Turso, no sync.
- **Work:** Docker Compose (or direct install): backend container/process, Redis container/process, frontend built and served (by backend or nginx). `DATABASE_URL=file:/path/to/muzo.db` (or similar). `ELASTICSEARCH_NODE` points to external ES or is unset.
- **Outcome:** App is live on the VPS; no AI, no database sync.

---

## Phase 2 — Database: Turso (cloud) then replica (local) — *later*

*Only after Phase 1 is done. Adds Turso and local↔cloud sync.*

### 2.1 Add Turso as the production database

- **Goal:** Backend on the VPS (or in Docker) uses Turso via `DATABASE_URL` (libsql URL) instead of SQLite file.
- **Work:** Prisma + Turso adapter; migrations against Turso; env for Turso URL.
- **Outcome:** Deployed app uses Turso; no DB container.

### 2.2 Add Turso embedded replica for local/offline

- **Goal:** Local backend uses a libsql replica; works offline and syncs when online.
- **Work:** Local env uses replica URL/path; document “local = replica, cloud = Turso URL”.
- **Outcome:** Local install is offline-capable and in sync with cloud when online.

---

## Phase 3 — Prove native local run (no Docker) — *later*

### 3.1 Document and validate “native” local run

- **Goal:** Clear steps to run on a clean machine: Redis, backend `.env` (SQLite or Turso replica), frontend dev or built.
- **Outcome:** Known-good sequence for the launcher to automate.

### 3.2 (Optional) Single-command dev script

- **Goal:** e.g. `./scripts/dev.sh` that starts Redis (or checks it), then backend, then frontend.
- **Outcome:** One-command local dev.

---

## Phase 4 — “Single app” launcher for end users — *later*

### 4.1 Launcher script

- **Goal:** One entry point that checks/starts Redis, starts backend, starts frontend (dev or serve `dist`).
- **Outcome:** “Single app” = clone + deps + one script.

### 4.2 (Optional) Bundle Redis

- **Goal:** Launcher starts a bundled `redis-server`; users don’t install Redis.
- **Outcome:** Fewer prerequisites.

---

## Order summary

| Priority | Step | What |
|----------|------|------|
| **First** | 1.1 | Backend without AI — so VPS can run without Python AI. |
| **First** | 1.2 | ES optional — so VPS can use external ES or none. |
| **First** | 1.3 | Deploy full stack on VPS (backend + frontend + Redis + SQLite); no AI, no sync. |
| Later | 2.1 | Turso as production DB. |
| Later | 2.2 | Turso replica for local/offline sync. |
| Later | 3.1–3.2 | Native local run docs + dev script. |
| Later | 4.1–4.2 | Launcher script + optional bundled Redis. |

**Principle:** Deliver **VPS deployment without AI and without database sync** first (Phase 1). Then add Turso, sync, and the local “single app” launcher in later phases.
