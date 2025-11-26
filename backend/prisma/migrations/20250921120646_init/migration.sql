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
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG',
    "maxFileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "music_tracks" (
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

-- CreateTable
CREATE TABLE "audio_fingerprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "mfcc" TEXT NOT NULL,
    "spectralCentroid" REAL NOT NULL,
    "spectralRolloff" REAL NOT NULL,
    "spectralContrast" TEXT NOT NULL,
    "chroma" TEXT NOT NULL,
    "zeroCrossingRate" REAL NOT NULL,
    "tempo" REAL,
    "key" TEXT,
    "energy" REAL,
    "valence" REAL,
    "danceability" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "audio_fingerprints_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_analysis_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "fingerprintId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "genreClassification" TEXT NOT NULL,
    "artistSuggestion" TEXT,
    "albumSuggestion" TEXT,
    "processingTime" REAL NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ai_analysis_results_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_analysis_results_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "audio_fingerprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG',
    "shareListeningData" BOOLEAN NOT NULL DEFAULT false,
    "shareAnalysisData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "music_tracks_filePath_key" ON "music_tracks"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "audio_fingerprints_trackId_key" ON "audio_fingerprints"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analysis_results_trackId_key" ON "ai_analysis_results"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analysis_results_fingerprintId_key" ON "ai_analysis_results"("fingerprintId");
