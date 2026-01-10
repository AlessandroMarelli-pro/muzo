-- CreateTable
CREATE TABLE "third_party_oauth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "third_party_oauth_tokens_userId_idx" ON "third_party_oauth_tokens"("userId");

-- CreateIndex
CREATE INDEX "third_party_oauth_tokens_provider_idx" ON "third_party_oauth_tokens"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "third_party_oauth_tokens_userId_provider_key" ON "third_party_oauth_tokens"("userId", "provider");
