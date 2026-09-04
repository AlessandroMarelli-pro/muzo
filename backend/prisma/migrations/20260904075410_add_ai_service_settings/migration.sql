-- CreateTable
CREATE TABLE "ai_service_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mode" TEXT NOT NULL DEFAULT 'remote',
    "remoteUrl" TEXT,
    "authToken" TEXT,
    "replicas" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'userId',
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "ai_service_settings_pkey" PRIMARY KEY ("id")
);
