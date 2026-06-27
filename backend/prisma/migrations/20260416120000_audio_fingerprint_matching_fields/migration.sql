-- AlterTable (SQLite: one ADD COLUMN per ALTER TABLE)
ALTER TABLE "audio_fingerprints" ADD COLUMN "onsetDensity" REAL NOT NULL DEFAULT 0;
ALTER TABLE "audio_fingerprints" ADD COLUMN "dynamicRange" REAL NOT NULL DEFAULT 0;
ALTER TABLE "audio_fingerprints" ADD COLUMN "mfccStd" TEXT NOT NULL DEFAULT '[]';
