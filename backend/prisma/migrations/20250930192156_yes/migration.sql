-- CreateTable
CREATE TABLE "image_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imagePath" TEXT,
    "imageUrl" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "image_searches_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
