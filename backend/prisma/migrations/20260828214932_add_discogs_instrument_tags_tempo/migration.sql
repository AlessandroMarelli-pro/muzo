-- AlterTable
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsVoice" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsInstruments" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsTags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsTempo" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsTempoConfidence" REAL;
