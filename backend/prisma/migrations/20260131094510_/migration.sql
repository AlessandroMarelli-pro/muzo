-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_playlist_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "playlist_tracks_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "playlist_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_playlist_tracks" ("addedAt", "id", "playlistId", "position", "trackId") SELECT "addedAt", "id", "playlistId", "position", "trackId" FROM "playlist_tracks";
DROP TABLE "playlist_tracks";
ALTER TABLE "new_playlist_tracks" RENAME TO "playlist_tracks";
CREATE INDEX "playlist_tracks_playlistId_idx" ON "playlist_tracks"("playlistId");
CREATE INDEX "playlist_tracks_position_idx" ON "playlist_tracks"("position");
CREATE UNIQUE INDEX "playlist_tracks_playlistId_trackId_key" ON "playlist_tracks"("playlistId", "trackId");
CREATE TABLE "new_playlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_playlists" ("createdAt", "createdById", "description", "id", "isPublic", "name", "updatedAt", "updatedById", "userId") SELECT "createdAt", "createdById", "description", "id", "isPublic", "name", "updatedAt", "updatedById", "userId" FROM "playlists";
DROP TABLE "playlists";
ALTER TABLE "new_playlists" RENAME TO "playlists";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
