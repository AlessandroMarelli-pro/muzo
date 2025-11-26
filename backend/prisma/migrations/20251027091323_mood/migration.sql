-- AlterTable
ALTER TABLE "audio_fingerprints" ADD COLUMN "arousal" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "arousal_mood" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "danceability_feeling" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "energy_by_band" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "energy_comment" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "energy_keywords" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "spectralBandwith" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "spectralFlatness" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "spectralSpread" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "valence_mood" TEXT;
