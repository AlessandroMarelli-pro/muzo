-- CreateEnum
CREATE TYPE "HqAudioSource" AS ENUM ('TIDAL', 'QOBUZ', 'DEEZER', 'BANDCAMP', 'SOULSEEK', 'ORIGINAL', 'ENHANCED');

-- AlterTable
ALTER TABLE "music_tracks" ADD COLUMN     "hqAudioSource" "HqAudioSource",
ADD COLUMN     "hqAudioSpectralCutoffHz" DOUBLE PRECISION,
ADD COLUMN     "hqAudioVerified" BOOLEAN NOT NULL DEFAULT false;
