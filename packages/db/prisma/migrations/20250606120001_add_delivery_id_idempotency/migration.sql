-- AlterTable
ALTER TABLE "events" ADD COLUMN "githubDeliveryId" TEXT;

-- Backfill existing events with unique legacy IDs
UPDATE "events" SET "githubDeliveryId" = 'legacy-' || "id" WHERE "githubDeliveryId" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "events" ALTER COLUMN "githubDeliveryId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "events_githubDeliveryId_key" ON "events"("githubDeliveryId");
