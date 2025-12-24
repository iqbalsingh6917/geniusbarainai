/*
  Warnings:

  - A unique constraint covering the columns `[convertedToStudentId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "StaffOrgUnitAssignment" DROP CONSTRAINT "StaffOrgUnitAssignment_orgUnitId_fkey";

-- DropForeignKey
ALTER TABLE "StaffOrgUnitAssignment" DROP CONSTRAINT "StaffOrgUnitAssignment_userId_fkey";

-- DropIndex
DROP INDEX "Lead_assignedToUserId_stage_idx";

-- DropIndex
DROP INDEX "Lead_createdAt_idx";

-- DropIndex
DROP INDEX "Lead_orgUnitId_nextFollowUpAt_idx";

-- DropIndex
DROP INDEX "Lead_orgUnitId_stage_updatedAt_idx";

-- DropIndex
DROP INDEX "Lead_stage_idx";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "convertedToStudentId" INTEGER;

-- CreateIndex
CREATE INDEX "Lead_convertedToStudentId_idx" ON "Lead"("convertedToStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedToStudentId_key" ON "Lead"("convertedToStudentId");

-- AddForeignKey
ALTER TABLE "StaffOrgUnitAssignment" ADD CONSTRAINT "StaffOrgUnitAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOrgUnitAssignment" ADD CONSTRAINT "StaffOrgUnitAssignment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedToStudentId_fkey" FOREIGN KEY ("convertedToStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
