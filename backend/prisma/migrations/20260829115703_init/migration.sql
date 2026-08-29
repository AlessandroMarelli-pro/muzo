-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('IDLE', 'SCANNING', 'ANALYZING', 'ERROR');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RepeatMode" AS ENUM ('NONE', 'ONE', 'ALL');

-- CreateEnum
CREATE TYPE "ImageSearchStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlaylistSortingKey" AS ENUM ('addedAt', 'position');

-- CreateEnum
CREATE TYPE "PlaylistSortingDirection" AS ENUM ('asc', 'desc');

-- CreateTable
CREATE TABLE "music_libraries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "analyzedTracks" INTEGER NOT NULL DEFAULT 0,
    "pendingTracks" INTEGER NOT NULL DEFAULT 0,
    "failedTracks" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMP(3),
    "lastIncrementalScanAt" TIMESTAMP(3),
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'IDLE',
    "autoScan" BOOLEAN NOT NULL DEFAULT true,
    "scanInterval" INTEGER,
    "includeSubdirectories" BOOLEAN NOT NULL DEFAULT true,
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
    "maxFileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "music_libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "hqAudioPath" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "fileCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" DOUBLE PRECISION NOT NULL,
    "originalTitle" TEXT,
    "originalArtist" TEXT,
    "originalAlbum" TEXT,
    "originalYear" INTEGER,
    "originalAlbumartist" TEXT,
    "originalDate" TIMESTAMP(3),
    "originalBpm" INTEGER,
    "originalTrack_number" INTEGER,
    "originalDisc_number" TEXT,
    "originalComment" TEXT,
    "originalComposer" TEXT,
    "originalCopyright" TEXT,
    "aiTitle" TEXT,
    "aiArtist" TEXT,
    "aiAlbum" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiSubgenreConfidence" DOUBLE PRECISION,
    "aiDescription" TEXT,
    "aiTags" TEXT,
    "vocalsDesc" TEXT,
    "contextBackground" TEXT,
    "contextImpact" TEXT,
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLiked" BOOLEAN NOT NULL DEFAULT false,
    "isBanger" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisStartedAt" TIMESTAMP(3),
    "analysisCompletedAt" TIMESTAMP(3),
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "libraryId" TEXT NOT NULL,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_fingerprints" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "tempo" DOUBLE PRECISION,
    "tempoConfidence" DOUBLE PRECISION,
    "key" TEXT,
    "camelotKey" TEXT,
    "mode" TEXT,
    "valence" DOUBLE PRECISION,
    "arousal" DOUBLE PRECISION,
    "danceability" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "moodHappy" DOUBLE PRECISION,
    "moodSad" DOUBLE PRECISION,
    "moodRelaxed" DOUBLE PRECISION,
    "moodAggressive" DOUBLE PRECISION,
    "moodParty" DOUBLE PRECISION,
    "voice" DOUBLE PRECISION,
    "valenceMood" TEXT,
    "arousalMood" TEXT,
    "danceabilityFeeling" TEXT,
    "instruments" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "embedding" TEXT NOT NULL DEFAULT '[]',
    "embeddingDim" INTEGER,
    "schemaVersion" INTEGER NOT NULL DEFAULT 2,
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "audio_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "autoPlay" BOOLEAN NOT NULL DEFAULT false,
    "shuffleMode" BOOLEAN NOT NULL DEFAULT false,
    "repeatMode" "RepeatMode" NOT NULL DEFAULT 'NONE',
    "autoAnalyze" BOOLEAN NOT NULL DEFAULT true,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "preferredGenres" TEXT,
    "autoScan" BOOLEAN NOT NULL DEFAULT true,
    "scanInterval" INTEGER NOT NULL DEFAULT 24,
    "includeSubdirectories" BOOLEAN NOT NULL DEFAULT true,
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
    "shareListeningData" BOOLEAN NOT NULL DEFAULT false,
    "shareAnalysisData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_searches" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "status" "ImageSearchStatus" NOT NULL DEFAULT 'PENDING',
    "imagePath" TEXT,
    "imageUrl" TEXT,
    "error" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "image_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "criteria" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subgenres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "subgenres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_genres" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_subgenres" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "subgenreId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "track_subgenres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_atmosphere_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "ai_atmosphere_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_ai_atmosphere_tags" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "aiAtmosphereTagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "track_ai_atmosphere_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hidden_music_tracks" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "format" TEXT NOT NULL,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "originalTitle" TEXT,
    "originalArtist" TEXT,
    "originalAlbum" TEXT,
    "originalYear" INTEGER,
    "originalAlbumartist" TEXT,
    "originalDate" TIMESTAMP(3),
    "originalBpm" INTEGER,
    "originalTrack_number" INTEGER,
    "originalDisc_number" TEXT,
    "originalComment" TEXT,
    "originalComposer" TEXT,
    "originalCopyright" TEXT,
    "aiTitle" TEXT,
    "aiArtist" TEXT,
    "aiAlbum" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiSubgenreConfidence" DOUBLE PRECISION,
    "aiDescription" TEXT,
    "aiTags" TEXT,
    "vocalsDesc" TEXT,
    "contextBackground" TEXT,
    "contextImpact" TEXT,
    "userTitle" TEXT,
    "userArtist" TEXT,
    "userAlbum" TEXT,
    "userTags" TEXT,
    "listeningCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLiked" BOOLEAN NOT NULL DEFAULT false,
    "isBanger" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisStartedAt" TIMESTAMP(3),
    "analysisCompletedAt" TIMESTAMP(3),
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "libraryId" TEXT NOT NULL,

    CONSTRAINT "hidden_music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_oauth_tokens" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "third_party_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_sorting" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "sortingKey" "PlaylistSortingKey" NOT NULL DEFAULT 'position',
    "sortingDirection" "PlaylistSortingDirection" NOT NULL DEFAULT 'asc',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "playlist_sorting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'SCANNING',
    "libraryId" TEXT,
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "completedBatches" INTEGER NOT NULL DEFAULT 0,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "completedTracks" INTEGER NOT NULL DEFAULT 0,
    "failedTracks" INTEGER NOT NULL DEFAULT 0,
    "overallProgress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "audio_fingerprints_instrumentalness_idx" ON "audio_fingerprints"("instrumentalness");

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
CREATE UNIQUE INDEX "ai_atmosphere_tags_name_key" ON "ai_atmosphere_tags"("name");

-- CreateIndex
CREATE INDEX "ai_atmosphere_tags_name_idx" ON "ai_atmosphere_tags"("name");

-- CreateIndex
CREATE INDEX "track_ai_atmosphere_tags_trackId_idx" ON "track_ai_atmosphere_tags"("trackId");

-- CreateIndex
CREATE INDEX "track_ai_atmosphere_tags_aiAtmosphereTagId_idx" ON "track_ai_atmosphere_tags"("aiAtmosphereTagId");

-- CreateIndex
CREATE UNIQUE INDEX "track_ai_atmosphere_tags_trackId_aiAtmosphereTagId_key" ON "track_ai_atmosphere_tags"("trackId", "aiAtmosphereTagId");

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
CREATE INDEX "third_party_oauth_tokens_createdById_idx" ON "third_party_oauth_tokens"("createdById");

-- CreateIndex
CREATE INDEX "third_party_oauth_tokens_provider_idx" ON "third_party_oauth_tokens"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "third_party_oauth_tokens_createdById_provider_key" ON "third_party_oauth_tokens"("createdById", "provider");

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

-- CreateIndex
CREATE INDEX "scan_sessions_libraryId_idx" ON "scan_sessions"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- AddForeignKey
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_fingerprints" ADD CONSTRAINT "audio_fingerprints_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_searches" ADD CONSTRAINT "image_searches_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subgenres" ADD CONSTRAINT "subgenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_subgenres" ADD CONSTRAINT "track_subgenres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_subgenres" ADD CONSTRAINT "track_subgenres_subgenreId_fkey" FOREIGN KEY ("subgenreId") REFERENCES "subgenres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_ai_atmosphere_tags" ADD CONSTRAINT "track_ai_atmosphere_tags_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_ai_atmosphere_tags" ADD CONSTRAINT "track_ai_atmosphere_tags_aiAtmosphereTagId_fkey" FOREIGN KEY ("aiAtmosphereTagId") REFERENCES "ai_atmosphere_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_music_tracks" ADD CONSTRAINT "hidden_music_tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_sorting" ADD CONSTRAINT "playlist_sorting_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue" ADD CONSTRAINT "queue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
