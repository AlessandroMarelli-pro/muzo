-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_saved_filters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "criteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_saved_filters" ("createdAt", "createdById", "criteria", "id", "name", "updatedAt", "updatedById") SELECT "createdAt", "createdById", "criteria", "id", "name", "updatedAt", "updatedById" FROM "saved_filters";
DROP TABLE "saved_filters";
ALTER TABLE "new_saved_filters" RENAME TO "saved_filters";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
