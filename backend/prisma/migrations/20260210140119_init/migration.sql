-- CreateTable
CREATE TABLE "music_libraries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "analyzedTracks" INTEGER NOT NULL DEFAULT 0,
    "pendingTracks" INTEGER NOT NULL DEFAULT 0,
    "failedTracks" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" DATETIME,
    "lastIncrementalScanAt" DATETIME,
    "scanStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "autoScan" BOOLEAN NOT NULL DEFAULT true,
    "scanInterval" INTEGER,
    "includeSubdirectories" BOOLEAN NOT NULL DEFAULT true,
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
    "maxFileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "fileCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" REAL NOT NULL,
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
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    "libraryId" TEXT NOT NULL,
    CONSTRAINT "music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audio_fingerprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "mfcc" TEXT NOT NULL DEFAULT '[]',
    "spectralCentroid" TEXT NOT NULL DEFAULT '{}',
    "spectralRolloff" TEXT NOT NULL DEFAULT '{}',
    "spectralSpread" TEXT NOT NULL DEFAULT '{}',
    "spectralBandwith" TEXT NOT NULL DEFAULT '{}',
    "spectralFlatness" TEXT NOT NULL DEFAULT '{}',
    "spectralContrast" TEXT NOT NULL DEFAULT '{}',
    "chroma" TEXT NOT NULL DEFAULT '{}',
    "tonnetz" TEXT NOT NULL DEFAULT '{}',
    "zeroCrossingRate" TEXT NOT NULL DEFAULT '{}',
    "rms" TEXT NOT NULL DEFAULT '{}',
    "tempo" REAL NOT NULL,
    "key" TEXT NOT NULL,
    "camelotKey" TEXT NOT NULL DEFAULT '',
    "valence" REAL NOT NULL DEFAULT 0.0,
    "valenceMood" TEXT NOT NULL DEFAULT '',
    "arousal" REAL NOT NULL DEFAULT 0.0,
    "arousalMood" TEXT NOT NULL DEFAULT '',
    "danceability" REAL NOT NULL,
    "danceabilityFeeling" TEXT NOT NULL DEFAULT '',
    "rhythmStability" REAL NOT NULL DEFAULT 0.0,
    "bassPresence" REAL NOT NULL DEFAULT 0.0,
    "tempoRegularity" REAL NOT NULL DEFAULT 0.0,
    "tempoAppropriateness" REAL NOT NULL DEFAULT 0.0,
    "energyFactor" REAL NOT NULL DEFAULT 0.0,
    "syncopation" REAL NOT NULL DEFAULT 0.0,
    "acousticness" REAL NOT NULL,
    "instrumentalness" REAL NOT NULL,
    "speechiness" REAL NOT NULL DEFAULT 0.0,
    "liveness" REAL NOT NULL DEFAULT 0.0,
    "modeFactor" REAL NOT NULL DEFAULT 0.0,
    "modeConfidence" REAL NOT NULL DEFAULT 0.0,
    "modeWeight" REAL NOT NULL DEFAULT 0.0,
    "tempoFactor" REAL NOT NULL DEFAULT 0.0,
    "brightnessFactor" REAL NOT NULL DEFAULT 0.0,
    "harmonicFactor" REAL NOT NULL DEFAULT 0.0,
    "spectralBalance" REAL NOT NULL DEFAULT 0.0,
    "beatStrength" REAL NOT NULL DEFAULT 0.0,
    "audioHash" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "energyComment" TEXT NOT NULL DEFAULT '',
    "energyKeywords" TEXT NOT NULL DEFAULT '[]',
    "energyByBand" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "audio_fingerprints_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "intelligent_editor_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "suggestions" TEXT NOT NULL,
    "userActions" TEXT NOT NULL,
    "confidenceThreshold" REAL,
    "sessionDuration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "intelligent_editor_sessions_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'MANUAL',
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "volume" REAL,
    "quality" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "playback_sessions_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultVolume" REAL NOT NULL DEFAULT 0.7,
    "autoPlay" BOOLEAN NOT NULL DEFAULT false,
    "shuffleMode" BOOLEAN NOT NULL DEFAULT false,
    "repeatMode" TEXT NOT NULL DEFAULT 'NONE',
    "autoAnalyze" BOOLEAN NOT NULL DEFAULT true,
    "confidenceThreshold" REAL NOT NULL DEFAULT 0.8,
    "preferredGenres" TEXT,
    "autoScan" BOOLEAN NOT NULL DEFAULT true,
    "scanInterval" INTEGER NOT NULL DEFAULT 24,
    "includeSubdirectories" BOOLEAN NOT NULL DEFAULT true,
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
    "shareListeningData" BOOLEAN NOT NULL DEFAULT false,
    "shareAnalysisData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
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

-- CreateTable
CREATE TABLE "image_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imagePath" TEXT,
    "imageUrl" TEXT,
    "error" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "image_searches_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "criteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "subgenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "track_genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "track_genres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "track_subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "subgenreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "track_subgenres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_subgenres_subgenreId_fkey" FOREIGN KEY ("subgenreId") REFERENCES "subgenres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    "libraryId" TEXT NOT NULL,
    CONSTRAINT "hidden_music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "third_party_oauth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "playlist_sorting" (
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

-- CreateTable
CREATE TABLE "queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "queue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scan_sessions" (
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
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "music_tracks_filePath_key" ON "music_tracks"("filePath");

-- CreateIndex
CREATE INDEX "music_tracks_libraryId_idx" ON "music_tracks"("libraryId");

-- CreateIndex
CREATE INDEX "music_tracks_analysisStatus_idx" ON "music_tracks"("analysisStatus");

-- CreateIndex
CREATE INDEX "music_tracks_isFavorite_idx" ON "music_tracks"("isFavorite");

-- CreateIndex
CREATE INDEX "music_tracks_format_idx" ON "music_tracks"("format");

-- CreateIndex
CREATE INDEX "music_tracks_aiConfidence_idx" ON "music_tracks"("aiConfidence");

-- CreateIndex
CREATE INDEX "music_tracks_createdAt_idx" ON "music_tracks"("createdAt");

-- CreateIndex
CREATE INDEX "music_tracks_listeningCount_idx" ON "music_tracks"("listeningCount");

-- CreateIndex
CREATE INDEX "music_tracks_lastPlayedAt_idx" ON "music_tracks"("lastPlayedAt");

-- CreateIndex
CREATE INDEX "music_tracks_libraryId_analysisStatus_idx" ON "music_tracks"("libraryId", "analysisStatus");

-- CreateIndex
CREATE INDEX "music_tracks_libraryId_isFavorite_idx" ON "music_tracks"("libraryId", "isFavorite");

-- CreateIndex
CREATE INDEX "music_tracks_analysisStatus_createdAt_idx" ON "music_tracks"("analysisStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audio_fingerprints_trackId_key" ON "audio_fingerprints"("trackId");

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
CREATE UNIQUE INDEX "playlist_tracks_playlistId_trackId_key" ON "playlist_tracks"("playlistId", "trackId");

-- CreateIndex
CREATE INDEX "image_searches_trackId_idx" ON "image_searches"("trackId");

-- CreateIndex
CREATE INDEX "image_searches_status_idx" ON "image_searches"("status");

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

-- CreateIndex
CREATE INDEX "third_party_oauth_tokens_userId_idx" ON "third_party_oauth_tokens"("userId");

-- CreateIndex
CREATE INDEX "third_party_oauth_tokens_provider_idx" ON "third_party_oauth_tokens"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "third_party_oauth_tokens_userId_provider_key" ON "third_party_oauth_tokens"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_sorting_playlistId_key" ON "playlist_sorting"("playlistId");

-- CreateIndex
CREATE INDEX "queue_trackId_idx" ON "queue"("trackId");

-- CreateIndex
CREATE INDEX "queue_position_idx" ON "queue"("position");

-- CreateIndex
CREATE UNIQUE INDEX "queue_trackId_key" ON "queue"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "scan_sessions_sessionId_key" ON "scan_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "scan_sessions_sessionId_idx" ON "scan_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "scan_sessions_status_idx" ON "scan_sessions"("status");

-- CreateIndex
CREATE INDEX "scan_sessions_startedAt_idx" ON "scan_sessions"("startedAt");

