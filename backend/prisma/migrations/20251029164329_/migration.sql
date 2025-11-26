/*
  Warnings:

  - You are about to drop the column `arousal_mood` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `chroma_std` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `danceability_feeling` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `energy` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `energy_by_band` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `energy_comment` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `energy_keywords` on the `audio_fingerprints` table. All the data in the column will be lost.
  - You are about to drop the column `valence_mood` on the `audio_fingerprints` table. All the data in the column will be lost.
  - Made the column `acousticness` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `audioHash` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `camelot_key` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `danceability` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fileHash` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `instrumentalness` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `key` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tempo` on table `audio_fingerprints` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audio_fingerprints" (
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
    "camelot_key" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "audio_fingerprints_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_audio_fingerprints" ("acousticness", "arousal", "audioHash", "camelot_key", "chroma", "createdAt", "danceability", "fileHash", "id", "instrumentalness", "key", "liveness", "mfcc", "spectralBandwith", "spectralCentroid", "spectralContrast", "spectralFlatness", "spectralRolloff", "spectralSpread", "speechiness", "tempo", "trackId", "updatedAt", "valence", "zeroCrossingRate") SELECT "acousticness", coalesce("arousal", 0.0) AS "arousal", "audioHash", "camelot_key", "chroma", "createdAt", "danceability", "fileHash", "id", "instrumentalness", "key", coalesce("liveness", 0.0) AS "liveness", "mfcc", coalesce("spectralBandwith", '{}') AS "spectralBandwith", "spectralCentroid", "spectralContrast", coalesce("spectralFlatness", '{}') AS "spectralFlatness", "spectralRolloff", coalesce("spectralSpread", '{}') AS "spectralSpread", coalesce("speechiness", 0.0) AS "speechiness", "tempo", "trackId", "updatedAt", coalesce("valence", 0.0) AS "valence", "zeroCrossingRate" FROM "audio_fingerprints";
DROP TABLE "audio_fingerprints";
ALTER TABLE "new_audio_fingerprints" RENAME TO "audio_fingerprints";
CREATE UNIQUE INDEX "audio_fingerprints_trackId_key" ON "audio_fingerprints"("trackId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
