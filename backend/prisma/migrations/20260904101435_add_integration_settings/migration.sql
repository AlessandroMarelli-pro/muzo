-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cosineApiKey" TEXT,
    "spotifyClientId" TEXT,
    "spotifyClientSecret" TEXT,
    "tidalClientId" TEXT,
    "tidalClientSecret" TEXT,
    "youtubeClientId" TEXT,
    "youtubeClientSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);
