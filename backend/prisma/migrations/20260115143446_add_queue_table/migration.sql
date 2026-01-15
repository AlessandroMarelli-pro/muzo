-- CreateTable
CREATE TABLE "queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "queue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "queue_trackId_idx" ON "queue"("trackId");

-- CreateIndex
CREATE INDEX "queue_position_idx" ON "queue"("position");

-- CreateIndex
CREATE UNIQUE INDEX "queue_trackId_key" ON "queue"("trackId");
