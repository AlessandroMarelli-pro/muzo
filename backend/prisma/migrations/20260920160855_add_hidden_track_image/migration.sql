-- Preserve cover art when a track is hidden, before its ImageSearch row
-- cascade-deletes along with the MusicTrack.
ALTER TABLE "hidden_music_tracks" ADD COLUMN "imageData" BYTEA;
ALTER TABLE "hidden_music_tracks" ADD COLUMN "imageMimeType" TEXT;
