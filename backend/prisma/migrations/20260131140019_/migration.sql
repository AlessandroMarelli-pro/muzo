-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_playlist_sorting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "sortingKey" TEXT NOT NULL DEFAULT 'position',
    "sortingDirection" TEXT NOT NULL DEFAULT 'asc',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "playlist_sorting_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_playlist_sorting" ("createdAt", "id", "playlistId", "sortingDirection", "sortingKey", "updatedAt") SELECT "createdAt", "id", "playlistId", "sortingDirection", "sortingKey", "updatedAt" FROM "playlist_sorting";
DROP TABLE "playlist_sorting";
ALTER TABLE "new_playlist_sorting" RENAME TO "playlist_sorting";
CREATE UNIQUE INDEX "playlist_sorting_playlistId_key" ON "playlist_sorting"("playlistId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
