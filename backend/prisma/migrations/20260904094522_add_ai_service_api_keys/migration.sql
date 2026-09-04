-- AlterTable
ALTER TABLE "ai_service_settings" ADD COLUMN     "discogsApiKeys" TEXT,
ADD COLUMN     "geminiApiKey" TEXT,
ADD COLUMN     "hfToken" TEXT,
ADD COLUMN     "lastfmApiKey" TEXT,
ADD COLUMN     "lastfmSecret" TEXT;
