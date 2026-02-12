-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_playlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);
INSERT INTO "new_playlists" ("createdAt", "description", "id", "isPublic", "name", "updatedAt", "userId") SELECT "createdAt", "description", "id", "isPublic", "name", "updatedAt", "userId" FROM "playlists";
DROP TABLE "playlists";
ALTER TABLE "new_playlists" RENAME TO "playlists";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
