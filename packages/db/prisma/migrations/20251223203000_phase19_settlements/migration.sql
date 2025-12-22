-- CreateTable
CREATE TABLE "Settlement" (
    "id" SERIAL NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossCollected" INTEGER NOT NULL,
    "refunds" INTEGER NOT NULL,
    "adjustments" INTEGER NOT NULL,
    "netCollected" INTEGER NOT NULL,
    "revenueSharePercent" INTEGER NOT NULL,
    "revenueShareAmount" INTEGER NOT NULL,
    "netPayable" INTEGER NOT NULL,
    "breakdown" JSONB,
    "warnings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Settlement_orgUnitId_periodStart_periodEnd_idx" ON "Settlement"("orgUnitId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
