-- AlterTable
ALTER TABLE "audio_fingerprints" ADD COLUMN "acousticness" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "audioHash" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "camelot_key" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "chroma_std" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "audio_fingerprints" ADD COLUMN "instrumentalness" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "liveness" REAL;
ALTER TABLE "audio_fingerprints" ADD COLUMN "speechiness" REAL;

-- AlterTable
ALTER TABLE "music_tracks" ADD COLUMN "originalAlbumartist" TEXT;
ALTER TABLE "music_tracks" ADD COLUMN "originalBpm" INTEGER;
ALTER TABLE "music_tracks" ADD COLUMN "originalComment" TEXT;
ALTER TABLE "music_tracks" ADD COLUMN "originalComposer" TEXT;
ALTER TABLE "music_tracks" ADD COLUMN "originalCopyright" TEXT;
ALTER TABLE "music_tracks" ADD COLUMN "originalDate" DATETIME;
ALTER TABLE "music_tracks" ADD COLUMN "originalDisc_number" TEXT;
ALTER TABLE "music_tracks" ADD COLUMN "originalTrack_number" INTEGER;
