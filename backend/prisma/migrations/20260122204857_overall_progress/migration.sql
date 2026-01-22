-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_scan_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCANNING',
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "completedBatches" INTEGER NOT NULL DEFAULT 0,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "completedTracks" INTEGER NOT NULL DEFAULT 0,
    "failedTracks" INTEGER NOT NULL DEFAULT 0,
    "overallProgress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_scan_sessions" ("completedAt", "completedBatches", "completedTracks", "createdAt", "errorMessage", "failedTracks", "id", "sessionId", "startedAt", "status", "totalBatches", "totalTracks", "updatedAt") SELECT "completedAt", "completedBatches", "completedTracks", "createdAt", "errorMessage", "failedTracks", "id", "sessionId", "startedAt", "status", "totalBatches", "totalTracks", "updatedAt" FROM "scan_sessions";
DROP TABLE "scan_sessions";
ALTER TABLE "new_scan_sessions" RENAME TO "scan_sessions";
CREATE UNIQUE INDEX "scan_sessions_sessionId_key" ON "scan_sessions"("sessionId");
CREATE INDEX "scan_sessions_sessionId_idx" ON "scan_sessions"("sessionId");
CREATE INDEX "scan_sessions_status_idx" ON "scan_sessions"("status");
CREATE INDEX "scan_sessions_startedAt_idx" ON "scan_sessions"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
