/*
  Warnings:

  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'ADMISSIONS', 'TEACHER', 'STUDENT');

-- AlterTable: add student link, safely cast role to enum
ALTER TABLE "User"
ADD COLUMN "studentId" INTEGER;

-- Cast existing role values to the new enum without dropping data
ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text)::"UserRole";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
