-- CreateTable
CREATE TABLE "hidden_music_tracks" (
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
    "originalYear" INTEGER,
    "originalAlbumartist" TEXT,
    "originalDate" DATETIME,
    "originalBpm" INTEGER,
    "originalTrack_number" INTEGER,
    "originalDisc_number" TEXT,
    "originalComment" TEXT,
    "originalComposer" TEXT,
    "originalCopyright" TEXT,
    "aiTitle" TEXT,
    "aiArtist" TEXT,
    "aiAlbum" TEXT,
    "aiConfidence" REAL,
    "aiSubgenreConfidence" REAL,
    "aiDescription" TEXT,
    "aiTags" TEXT,
    "vocalsDesc" TEXT,
    "atmosphereDesc" TEXT,
    "contextBackground" TEXT,
    "contextImpact" TEXT,
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLiked" BOOLEAN NOT NULL DEFAULT false,
    "isBanger" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisStartedAt" DATETIME,
    "analysisCompletedAt" DATETIME,
    "analysisError" TEXT,
    "hasMusicbrainz" BOOLEAN,
    "hasDiscogs" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "libraryId" TEXT NOT NULL,
    CONSTRAINT "hidden_music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "originalYear" INTEGER,
    "originalAlbumartist" TEXT,
    "originalDate" DATETIME,
    "originalBpm" INTEGER,
    "originalTrack_number" INTEGER,
    "originalDisc_number" TEXT,
    "originalComment" TEXT,
    "originalComposer" TEXT,
    "originalCopyright" TEXT,
    "aiTitle" TEXT,
    "aiArtist" TEXT,
    "aiAlbum" TEXT,
    "aiConfidence" REAL,
    "aiSubgenreConfidence" REAL,
    "aiDescription" TEXT,
    "aiTags" TEXT,
    "vocalsDesc" TEXT,
    "atmosphereDesc" TEXT,
    "contextBackground" TEXT,
    "contextImpact" TEXT,
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLiked" BOOLEAN NOT NULL DEFAULT false,
    "isBanger" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisStartedAt" DATETIME,
    "analysisCompletedAt" DATETIME,
    "analysisError" TEXT,
    "hasMusicbrainz" BOOLEAN,
    "hasDiscogs" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "libraryId" TEXT NOT NULL,
    CONSTRAINT "music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_music_tracks" ("aiAlbum", "aiArtist", "aiConfidence", "aiDescription", "aiSubgenreConfidence", "aiTags", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "atmosphereDesc", "bitrate", "contextBackground", "contextImpact", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "hasDiscogs", "hasMusicbrainz", "id", "isFavorite", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalAlbumartist", "originalArtist", "originalBpm", "originalComment", "originalComposer", "originalCopyright", "originalDate", "originalDisc_number", "originalTitle", "originalTrack_number", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userTags", "userTitle", "vocalsDesc") SELECT "aiAlbum", "aiArtist", "aiConfidence", "aiDescription", "aiSubgenreConfidence", "aiTags", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "atmosphereDesc", "bitrate", "contextBackground", "contextImpact", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "hasDiscogs", "hasMusicbrainz", "id", "isFavorite", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalAlbumartist", "originalArtist", "originalBpm", "originalComment", "originalComposer", "originalCopyright", "originalDate", "originalDisc_number", "originalTitle", "originalTrack_number", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userTags", "userTitle", "vocalsDesc" FROM "music_tracks";
DROP TABLE "music_tracks";
ALTER TABLE "new_music_tracks" RENAME TO "music_tracks";
CREATE UNIQUE INDEX "music_tracks_filePath_key" ON "music_tracks"("filePath");
CREATE INDEX "music_tracks_libraryId_idx" ON "music_tracks"("libraryId");
CREATE INDEX "music_tracks_analysisStatus_idx" ON "music_tracks"("analysisStatus");
CREATE INDEX "music_tracks_isFavorite_idx" ON "music_tracks"("isFavorite");
CREATE INDEX "music_tracks_format_idx" ON "music_tracks"("format");
CREATE INDEX "music_tracks_aiConfidence_idx" ON "music_tracks"("aiConfidence");
CREATE INDEX "music_tracks_createdAt_idx" ON "music_tracks"("createdAt");
CREATE INDEX "music_tracks_listeningCount_idx" ON "music_tracks"("listeningCount");
CREATE INDEX "music_tracks_lastPlayedAt_idx" ON "music_tracks"("lastPlayedAt");
CREATE INDEX "music_tracks_libraryId_analysisStatus_idx" ON "music_tracks"("libraryId", "analysisStatus");
CREATE INDEX "music_tracks_libraryId_isFavorite_idx" ON "music_tracks"("libraryId", "isFavorite");
CREATE INDEX "music_tracks_analysisStatus_createdAt_idx" ON "music_tracks"("analysisStatus", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "hidden_music_tracks_filePath_key" ON "hidden_music_tracks"("filePath");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_libraryId_idx" ON "hidden_music_tracks"("libraryId");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_analysisStatus_idx" ON "hidden_music_tracks"("analysisStatus");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_isFavorite_idx" ON "hidden_music_tracks"("isFavorite");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_format_idx" ON "hidden_music_tracks"("format");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_aiConfidence_idx" ON "hidden_music_tracks"("aiConfidence");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_createdAt_idx" ON "hidden_music_tracks"("createdAt");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_listeningCount_idx" ON "hidden_music_tracks"("listeningCount");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_lastPlayedAt_idx" ON "hidden_music_tracks"("lastPlayedAt");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_libraryId_analysisStatus_idx" ON "hidden_music_tracks"("libraryId", "analysisStatus");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_libraryId_isFavorite_idx" ON "hidden_music_tracks"("libraryId", "isFavorite");

-- CreateIndex
CREATE INDEX "hidden_music_tracks_analysisStatus_createdAt_idx" ON "hidden_music_tracks"("analysisStatus", "createdAt");
