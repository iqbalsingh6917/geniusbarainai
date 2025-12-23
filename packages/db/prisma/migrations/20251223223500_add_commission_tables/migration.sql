-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" SERIAL NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" SERIAL NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "courseCode" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRule_orgUnitId_idx" ON "CommissionRule"("orgUnitId");

-- CreateIndex
CREATE INDEX "CommissionRule_type_idx" ON "CommissionRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_ruleId_entityType_entityId_key" ON "CommissionRecord"("ruleId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_entityType_entityId_key" ON "CommissionRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommissionRecord_orgUnitId_idx" ON "CommissionRecord"("orgUnitId");

-- CreateIndex
CREATE INDEX "CommissionRecord_entityType_idx" ON "CommissionRecord"("entityType");

-- CreateIndex
CREATE INDEX "CommissionRecord_courseCode_idx" ON "CommissionRecord"("courseCode");

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
