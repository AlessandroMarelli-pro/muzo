-- AlterTable
ALTER TABLE "music_tracks" ADD COLUMN "aiDescription" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_music_libraries" (
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
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS',
    "maxFileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_music_libraries" ("analyzedTracks", "autoScan", "createdAt", "failedTracks", "id", "includeSubdirectories", "lastIncrementalScanAt", "lastScanAt", "maxFileSize", "name", "pendingTracks", "rootPath", "scanInterval", "scanStatus", "supportedFormats", "totalTracks", "updatedAt") SELECT "analyzedTracks", "autoScan", "createdAt", "failedTracks", "id", "includeSubdirectories", "lastIncrementalScanAt", "lastScanAt", "maxFileSize", "name", "pendingTracks", "rootPath", "scanInterval", "scanStatus", "supportedFormats", "totalTracks", "updatedAt" FROM "music_libraries";
DROP TABLE "music_libraries";
ALTER TABLE "new_music_libraries" RENAME TO "music_libraries";
CREATE TABLE "new_user_preferences" (
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
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS',
    "shareListeningData" BOOLEAN NOT NULL DEFAULT false,
    "shareAnalysisData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_user_preferences" ("autoAnalyze", "autoPlay", "autoScan", "confidenceThreshold", "createdAt", "defaultVolume", "id", "includeSubdirectories", "language", "preferredGenres", "repeatMode", "scanInterval", "shareAnalysisData", "shareListeningData", "shuffleMode", "supportedFormats", "theme", "timezone", "updatedAt", "userId") SELECT "autoAnalyze", "autoPlay", "autoScan", "confidenceThreshold", "createdAt", "defaultVolume", "id", "includeSubdirectories", "language", "preferredGenres", "repeatMode", "scanInterval", "shareAnalysisData", "shareListeningData", "shuffleMode", "supportedFormats", "theme", "timezone", "updatedAt", "userId" FROM "user_preferences";
DROP TABLE "user_preferences";
ALTER TABLE "new_user_preferences" RENAME TO "user_preferences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
