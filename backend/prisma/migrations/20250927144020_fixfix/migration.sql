/*
  Warnings:

  - You are about to drop the column `aiSubGenre` on the `music_tracks` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_music_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" REAL NOT NULL,
    "format" TEXT NOT NULL,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "originalTitle" TEXT,
    "originalArtist" TEXT,
    "originalAlbum" TEXT,
    "originalGenre" TEXT,
    "originalYear" INTEGER,
    "aiTitle" TEXT,
    "aiArtist" TEXT,
    "aiAlbum" TEXT,
    "aiGenre" TEXT,
    "aiConfidence" REAL,
    "aiSubgenre" TEXT,
    "aiSubgenreConfidence" REAL,
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userGenre" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisStartedAt" DATETIME,
    "analysisCompletedAt" DATETIME,
    "analysisError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "libraryId" TEXT NOT NULL,
    CONSTRAINT "music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_music_tracks" ("aiAlbum", "aiArtist", "aiConfidence", "aiGenre", "aiSubgenreConfidence", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "bitrate", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "id", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalArtist", "originalGenre", "originalTitle", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userGenre", "userTags", "userTitle") SELECT "aiAlbum", "aiArtist", "aiConfidence", "aiGenre", "aiSubgenreConfidence", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "bitrate", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "id", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalArtist", "originalGenre", "originalTitle", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userGenre", "userTags", "userTitle" FROM "music_tracks";
DROP TABLE "music_tracks";
ALTER TABLE "new_music_tracks" RENAME TO "music_tracks";
CREATE UNIQUE INDEX "music_tracks_filePath_key" ON "music_tracks"("filePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
