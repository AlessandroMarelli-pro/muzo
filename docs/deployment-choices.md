# Deployment & distribution choices

Summary of architecture and distribution decisions for Muzo.

---

## 1. Deployment (cloud / production)

- **Containers:** Docker for backend, frontend (if served from a container), Redis, etc.
- **Database:** **Turso** (libsql) as the primary database — no database container in the stack.
- **Search:** **Elasticsearch** is run **externally** (separate cluster or cloud). Backend connects via `ELASTICSEARCH_NODE` (and optional auth).
- **AI:** No AI server in the first phase.

---

## 2. App package (distributable “single app” for end users)

- **Goal:** One app that people can run locally (no Docker required for the app itself).
- **Stack:** Frontend + backend + Redis on the host; **Elasticsearch is external** (not shipped or started by the package).
- **Launcher:** A single entry point (e.g. script, or script + bundled Redis) that starts Redis (if not already running), then the backend, then the frontend (dev server or built assets).
- **No desktop packager** for now: no Electron/Tauri; the “package” is the repo + launcher script (and optionally a bundled Redis binary).

---

## 3. Local installation (developer / end-user local setup)

- **Environment:** **Non-Docker** for the app: frontend, backend, and Redis run on the host (native install or script).
- **Database:** **Offline-capable** via a **Turso embedded replica** — local SQLite replica that syncs with Turso when online (not a single shared DB; local has its own replica).
- **Redis:** Run on the host (e.g. `redis-server`) or started by the launcher / bundled binary.
- **Elasticsearch:** **External** — not installed or started as part of local setup; app points to an external ES URL (or recommendations are disabled if ES is not configured).
- **AI:** Optional; not required for the local “single app” to run.

---

## Summary table

| Area | Choice |
|------|--------|
| **Deployment** | Docker (backend, frontend, Redis) + Turso + external Elasticsearch; no AI server initially. |
| **App package** | Single app = launcher script (+ optional bundled Redis); frontend + backend on host; ES external. |
| **Local installation** | Non-Docker (host); Turso replica for offline sync; Redis on host or from launcher; ES external. |
