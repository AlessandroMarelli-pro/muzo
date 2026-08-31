-- CreateTable
CREATE TABLE "cosine_track_matches" (
    "id" TEXT NOT NULL,
    "musicTrackId" TEXT NOT NULL,
    "cosineTrackId" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "cosine_track_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cosine_track_matches_musicTrackId_key" ON "cosine_track_matches"("musicTrackId");

-- AddForeignKey
ALTER TABLE "cosine_track_matches" ADD CONSTRAINT "cosine_track_matches_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
