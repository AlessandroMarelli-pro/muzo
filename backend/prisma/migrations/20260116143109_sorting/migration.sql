-- CreateTable
CREATE TABLE "playlist_sorting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "sortingKey" TEXT NOT NULL DEFAULT 'position',
    "sortingDirection" TEXT NOT NULL DEFAULT 'asc',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "playlist_sorting_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_sorting_playlistId_key" ON "playlist_sorting"("playlistId");
