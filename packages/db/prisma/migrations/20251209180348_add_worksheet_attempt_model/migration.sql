-- CreateEnum
CREATE TYPE "WorksheetAttemptStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "WorksheetAttempt" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "worksheetId" INTEGER NOT NULL,
    "status" "WorksheetAttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "WorksheetAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorksheetAttempt_enrollmentId_idx" ON "WorksheetAttempt"("enrollmentId");

-- CreateIndex
CREATE INDEX "WorksheetAttempt_worksheetId_idx" ON "WorksheetAttempt"("worksheetId");

-- CreateIndex
CREATE UNIQUE INDEX "WorksheetAttempt_enrollmentId_worksheetId_key" ON "WorksheetAttempt"("enrollmentId", "worksheetId");

-- AddForeignKey
ALTER TABLE "WorksheetAttempt" ADD CONSTRAINT "WorksheetAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "AbacusEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksheetAttempt" ADD CONSTRAINT "WorksheetAttempt_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "AbacusWorksheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
