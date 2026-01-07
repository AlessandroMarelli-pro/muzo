/*
  Warnings:

  - You are about to drop the column `aiGenre` on the `music_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `aiSubgenre` on the `music_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `originalGenre` on the `music_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `userGenre` on the `music_tracks` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subgenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "track_genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "track_genres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "track_subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "subgenreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "track_subgenres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_subgenres_subgenreId_fkey" FOREIGN KEY ("subgenreId") REFERENCES "subgenres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_music_tracks" ("aiAlbum", "aiArtist", "aiConfidence", "aiDescription", "aiSubgenreConfidence", "aiTags", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "bitrate", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "hasDiscogs", "hasMusicbrainz", "id", "isFavorite", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalAlbumartist", "originalArtist", "originalBpm", "originalComment", "originalComposer", "originalCopyright", "originalDate", "originalDisc_number", "originalTitle", "originalTrack_number", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userTags", "userTitle") SELECT "aiAlbum", "aiArtist", "aiConfidence", "aiDescription", "aiSubgenreConfidence", "aiTags", "aiTitle", "analysisCompletedAt", "analysisError", "analysisStartedAt", "analysisStatus", "bitrate", "createdAt", "duration", "fileName", "filePath", "fileSize", "format", "hasDiscogs", "hasMusicbrainz", "id", "isFavorite", "lastPlayedAt", "libraryId", "listeningCount", "originalAlbum", "originalAlbumartist", "originalArtist", "originalBpm", "originalComment", "originalComposer", "originalCopyright", "originalDate", "originalDisc_number", "originalTitle", "originalTrack_number", "originalYear", "sampleRate", "updatedAt", "userAlbum", "userArtist", "userTags", "userTitle" FROM "music_tracks";
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
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "genres_name_idx" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subgenres_name_key" ON "subgenres"("name");

-- CreateIndex
CREATE INDEX "subgenres_name_idx" ON "subgenres"("name");

-- CreateIndex
CREATE INDEX "subgenres_genreId_idx" ON "subgenres"("genreId");

-- CreateIndex
CREATE INDEX "track_genres_trackId_idx" ON "track_genres"("trackId");

-- CreateIndex
CREATE INDEX "track_genres_genreId_idx" ON "track_genres"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "track_genres_trackId_genreId_key" ON "track_genres"("trackId", "genreId");

-- CreateIndex
CREATE INDEX "track_subgenres_trackId_idx" ON "track_subgenres"("trackId");

-- CreateIndex
CREATE INDEX "track_subgenres_subgenreId_idx" ON "track_subgenres"("subgenreId");

-- CreateIndex
CREATE UNIQUE INDEX "track_subgenres_trackId_subgenreId_key" ON "track_subgenres"("trackId", "subgenreId");

-- CreateIndex
CREATE INDEX "audio_fingerprints_key_idx" ON "audio_fingerprints"("key");

-- CreateIndex
CREATE INDEX "audio_fingerprints_tempo_idx" ON "audio_fingerprints"("tempo");

-- CreateIndex
CREATE INDEX "audio_fingerprints_danceability_idx" ON "audio_fingerprints"("danceability");

-- CreateIndex
CREATE INDEX "audio_fingerprints_valence_idx" ON "audio_fingerprints"("valence");

-- CreateIndex
CREATE INDEX "audio_fingerprints_arousal_idx" ON "audio_fingerprints"("arousal");

-- CreateIndex
CREATE INDEX "audio_fingerprints_acousticness_idx" ON "audio_fingerprints"("acousticness");

-- CreateIndex
CREATE INDEX "audio_fingerprints_instrumentalness_idx" ON "audio_fingerprints"("instrumentalness");

-- CreateIndex
CREATE INDEX "audio_fingerprints_speechiness_idx" ON "audio_fingerprints"("speechiness");

-- CreateIndex
CREATE INDEX "image_searches_trackId_idx" ON "image_searches"("trackId");

-- CreateIndex
CREATE INDEX "image_searches_status_idx" ON "image_searches"("status");

-- CreateIndex
CREATE INDEX "intelligent_editor_sessions_trackId_idx" ON "intelligent_editor_sessions"("trackId");

-- CreateIndex
CREATE INDEX "intelligent_editor_sessions_sessionStatus_idx" ON "intelligent_editor_sessions"("sessionStatus");

-- CreateIndex
CREATE INDEX "playback_sessions_trackId_idx" ON "playback_sessions"("trackId");

-- CreateIndex
CREATE INDEX "playback_sessions_startTime_idx" ON "playback_sessions"("startTime");

-- CreateIndex
CREATE INDEX "playback_sessions_sessionType_idx" ON "playback_sessions"("sessionType");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlistId_idx" ON "playlist_tracks"("playlistId");

-- CreateIndex
CREATE INDEX "playlist_tracks_position_idx" ON "playlist_tracks"("position");

-- CreateIndex
CREATE INDEX "user_recommendation_preferences_userId_idx" ON "user_recommendation_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_recommendation_preferences_isDefault_idx" ON "user_recommendation_preferences"("isDefault");
