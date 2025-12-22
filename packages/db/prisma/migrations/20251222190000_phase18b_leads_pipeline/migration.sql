-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'ONLINE';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'SCHOOL';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "city" TEXT;
ALTER TABLE "Lead" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_orgUnitId_stage_updatedAt_idx" ON "Lead"("orgUnitId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "Lead_orgUnitId_nextFollowUpAt_idx" ON "Lead"("orgUnitId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToUserId_stage_idx" ON "Lead"("assignedToUserId", "stage");