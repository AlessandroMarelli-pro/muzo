-- CreateTable
CREATE TABLE "ai_atmosphere_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "track_ai_atmosphere_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "aiAtmosphereTagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "track_ai_atmosphere_tags_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_ai_atmosphere_tags_aiAtmosphereTagId_fkey" FOREIGN KEY ("aiAtmosphereTagId") REFERENCES "ai_atmosphere_tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_atmosphere_tags_name_key" ON "ai_atmosphere_tags"("name");

-- CreateIndex
CREATE INDEX "ai_atmosphere_tags_name_idx" ON "ai_atmosphere_tags"("name");

-- CreateIndex
CREATE INDEX "track_ai_atmosphere_tags_trackId_idx" ON "track_ai_atmosphere_tags"("trackId");

-- CreateIndex
CREATE INDEX "track_ai_atmosphere_tags_aiAtmosphereTagId_idx" ON "track_ai_atmosphere_tags"("aiAtmosphereTagId");

-- CreateIndex
CREATE UNIQUE INDEX "track_ai_atmosphere_tags_trackId_aiAtmosphereTagId_key" ON "track_ai_atmosphere_tags"("trackId", "aiAtmosphereTagId");
