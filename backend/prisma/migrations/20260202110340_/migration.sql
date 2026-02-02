-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_genres" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "genres";
DROP TABLE "genres";
ALTER TABLE "new_genres" RENAME TO "genres";
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");
CREATE INDEX "genres_name_idx" ON "genres"("name");
CREATE TABLE "new_image_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imagePath" TEXT,
    "imageUrl" TEXT,
    "error" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "image_searches_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_image_searches" ("createdAt", "error", "id", "imagePath", "imageUrl", "searchUrl", "source", "status", "trackId", "updatedAt") SELECT "createdAt", "error", "id", "imagePath", "imageUrl", "searchUrl", "source", "status", "trackId", "updatedAt" FROM "image_searches";
DROP TABLE "image_searches";
ALTER TABLE "new_image_searches" RENAME TO "image_searches";
CREATE INDEX "image_searches_trackId_idx" ON "image_searches"("trackId");
CREATE INDEX "image_searches_status_idx" ON "image_searches"("status");
CREATE TABLE "new_saved_filters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_saved_filters" ("createdAt", "criteria", "id", "name", "updatedAt") SELECT "createdAt", "criteria", "id", "name", "updatedAt" FROM "saved_filters";
DROP TABLE "saved_filters";
ALTER TABLE "new_saved_filters" RENAME TO "saved_filters";
CREATE TABLE "new_subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "subgenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_subgenres" ("createdAt", "description", "genreId", "id", "name", "updatedAt") SELECT "createdAt", "description", "genreId", "id", "name", "updatedAt" FROM "subgenres";
DROP TABLE "subgenres";
ALTER TABLE "new_subgenres" RENAME TO "subgenres";
CREATE UNIQUE INDEX "subgenres_name_key" ON "subgenres"("name");
CREATE INDEX "subgenres_name_idx" ON "subgenres"("name");
CREATE INDEX "subgenres_genreId_idx" ON "subgenres"("genreId");
CREATE TABLE "new_track_genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "track_genres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_track_genres" ("createdAt", "genreId", "id", "trackId") SELECT "createdAt", "genreId", "id", "trackId" FROM "track_genres";
DROP TABLE "track_genres";
ALTER TABLE "new_track_genres" RENAME TO "track_genres";
CREATE INDEX "track_genres_trackId_idx" ON "track_genres"("trackId");
CREATE INDEX "track_genres_genreId_idx" ON "track_genres"("genreId");
CREATE UNIQUE INDEX "track_genres_trackId_genreId_key" ON "track_genres"("trackId", "genreId");
CREATE TABLE "new_track_subgenres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "subgenreId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT,
    CONSTRAINT "track_subgenres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "music_tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "track_subgenres_subgenreId_fkey" FOREIGN KEY ("subgenreId") REFERENCES "subgenres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_track_subgenres" ("createdAt", "id", "subgenreId", "trackId") SELECT "createdAt", "id", "subgenreId", "trackId" FROM "track_subgenres";
DROP TABLE "track_subgenres";
ALTER TABLE "new_track_subgenres" RENAME TO "track_subgenres";
CREATE INDEX "track_subgenres_trackId_idx" ON "track_subgenres"("trackId");
CREATE INDEX "track_subgenres_subgenreId_idx" ON "track_subgenres"("subgenreId");
CREATE UNIQUE INDEX "track_subgenres_trackId_subgenreId_key" ON "track_subgenres"("trackId", "subgenreId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
