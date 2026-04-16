/*
  Warnings:

  - You are about to drop the column `userId` on the `third_party_oauth_tokens` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_third_party_oauth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" DATETIME,
    "updatedById" TEXT
);
INSERT INTO "new_third_party_oauth_tokens" ("accessToken", "createdAt", "expiresAt", "id", "provider", "refreshToken", "scope", "updatedAt") SELECT "accessToken", "createdAt", "expiresAt", "id", "provider", "refreshToken", "scope", "updatedAt" FROM "third_party_oauth_tokens";
DROP TABLE "third_party_oauth_tokens";
ALTER TABLE "new_third_party_oauth_tokens" RENAME TO "third_party_oauth_tokens";
CREATE INDEX "third_party_oauth_tokens_createdById_idx" ON "third_party_oauth_tokens"("createdById");
CREATE INDEX "third_party_oauth_tokens_provider_idx" ON "third_party_oauth_tokens"("provider");
CREATE UNIQUE INDEX "third_party_oauth_tokens_createdById_provider_key" ON "third_party_oauth_tokens"("createdById", "provider");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
