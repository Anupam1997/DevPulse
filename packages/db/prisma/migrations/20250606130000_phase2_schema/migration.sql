-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'BRANCH_CREATED';
ALTER TYPE "EventType" ADD VALUE 'TAG_CREATED';

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "repositories_orgId_idx" ON "repositories"("orgId");

-- CreateIndex
CREATE INDEX "events_repoId_occurredAt_idx" ON "events"("repoId", "occurredAt");

-- CreateIndex
CREATE INDEX "sprints_orgId_startDate_endDate_idx" ON "sprints"("orgId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
