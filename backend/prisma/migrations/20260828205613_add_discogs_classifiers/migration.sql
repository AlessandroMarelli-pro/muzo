-- AlterTable
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsDanceability" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsMoodAggressive" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsMoodHappy" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsMoodParty" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsMoodRelaxed" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsMoodSad" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "discogsGenres" TEXT NOT NULL DEFAULT '[]';
