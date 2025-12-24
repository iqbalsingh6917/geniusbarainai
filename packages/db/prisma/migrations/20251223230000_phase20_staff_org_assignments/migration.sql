-- Add new roles to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HEAD_COORDINATOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COORDINATOR';

-- Create StaffOrgRoleType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffOrgRoleType') THEN
    CREATE TYPE "StaffOrgRoleType" AS ENUM ('HEAD_COORDINATOR', 'COORDINATOR');
  END IF;
END$$;

-- Create StaffOrgUnitAssignment table
CREATE TABLE IF NOT EXISTS "StaffOrgUnitAssignment" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "orgUnitId" INTEGER NOT NULL,
  "roleType" "StaffOrgRoleType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffOrgUnitAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StaffOrgUnitAssignment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "StaffOrgUnitAssignment_userId_idx" ON "StaffOrgUnitAssignment"("userId");
CREATE INDEX IF NOT EXISTS "StaffOrgUnitAssignment_orgUnitId_idx" ON "StaffOrgUnitAssignment"("orgUnitId");
CREATE INDEX IF NOT EXISTS "StaffOrgUnitAssignment_roleType_idx" ON "StaffOrgUnitAssignment"("roleType");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffOrgUnitAssignment_userId_orgUnitId_roleType_key" ON "StaffOrgUnitAssignment"("userId", "orgUnitId", "roleType");
