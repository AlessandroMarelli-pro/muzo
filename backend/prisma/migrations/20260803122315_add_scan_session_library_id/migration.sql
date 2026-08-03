-- AlterTable
ALTER TABLE "scan_sessions" ADD COLUMN "libraryId" TEXT;

-- CreateIndex
CREATE INDEX "scan_sessions_libraryId_idx" ON "scan_sessions"("libraryId");
