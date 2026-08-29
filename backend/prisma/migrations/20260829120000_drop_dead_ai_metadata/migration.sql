-- DropForeignKey
ALTER TABLE "track_ai_atmosphere_tags" DROP CONSTRAINT "track_ai_atmosphere_tags_aiAtmosphereTagId_fkey";

-- DropForeignKey
ALTER TABLE "track_ai_atmosphere_tags" DROP CONSTRAINT "track_ai_atmosphere_tags_trackId_fkey";

-- AlterTable
ALTER TABLE "hidden_music_tracks" DROP COLUMN "aiAlbum",
DROP COLUMN "aiArtist",
DROP COLUMN "aiDescription",
DROP COLUMN "aiSubgenreConfidence",
DROP COLUMN "aiTags",
DROP COLUMN "aiTitle",
DROP COLUMN "contextBackground",
DROP COLUMN "contextImpact",
DROP COLUMN "userAlbum",
DROP COLUMN "userArtist",
DROP COLUMN "userTags",
DROP COLUMN "userTitle",
DROP COLUMN "vocalsDesc";

-- AlterTable
ALTER TABLE "music_tracks" DROP COLUMN "aiAlbum",
DROP COLUMN "aiArtist",
DROP COLUMN "aiDescription",
DROP COLUMN "aiSubgenreConfidence",
DROP COLUMN "aiTags",
DROP COLUMN "aiTitle",
DROP COLUMN "contextBackground",
DROP COLUMN "contextImpact",
DROP COLUMN "userAlbum",
DROP COLUMN "userArtist",
DROP COLUMN "userTags",
DROP COLUMN "userTitle",
DROP COLUMN "vocalsDesc";

-- DropTable
DROP TABLE "ai_atmosphere_tags";

-- DropTable
DROP TABLE "track_ai_atmosphere_tags";

