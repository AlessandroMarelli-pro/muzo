-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "queue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_queue" ("createdAt", "id", "position", "trackId", "updatedAt") SELECT "createdAt", "id", "position", "trackId", "updatedAt" FROM "queue";
DROP TABLE "queue";
ALTER TABLE "new_queue" RENAME TO "queue";
CREATE INDEX "queue_trackId_idx" ON "queue"("trackId");
CREATE INDEX "queue_position_idx" ON "queue"("position");
CREATE UNIQUE INDEX "queue_trackId_key" ON "queue"("trackId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
