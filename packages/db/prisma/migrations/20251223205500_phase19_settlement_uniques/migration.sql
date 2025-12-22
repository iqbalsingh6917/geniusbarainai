-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Settlement" ADD COLUMN "finalizedByUserId" INTEGER;

-- DropIndex
DROP INDEX IF EXISTS "Settlement_orgUnitId_periodStart_periodEnd_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_orgUnitId_periodStart_periodEnd_key" ON "Settlement"("orgUnitId", "periodStart", "periodEnd");
