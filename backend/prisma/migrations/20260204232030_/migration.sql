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
    "supportedFormats" TEXT NOT NULL DEFAULT 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
    "maxFileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_music_libraries" ("analyzedTracks", "autoScan", "createdAt", "failedTracks", "id", "includeSubdirectories", "lastIncrementalScanAt", "lastScanAt", "maxFileSize", "name", "pendingTracks", "rootPath", "scanInterval", "scanStatus", "supportedFormats", "totalTracks", "updatedAt") SELECT "analyzedTracks", "autoScan", "createdAt", "failedTracks", "id", "includeSubdirectories", "lastIncrementalScanAt", "lastScanAt", "maxFileSize", "name", "pendingTracks", "rootPath", "scanInterval", "scanStatus", "supportedFormats", "totalTracks", "updatedAt" FROM "music_libraries";
DROP TABLE "music_libraries";
ALTER TABLE "new_music_libraries" RENAME TO "music_libraries";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
