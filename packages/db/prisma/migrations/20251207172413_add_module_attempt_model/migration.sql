-- CreateEnum
CREATE TYPE "ModuleAttemptStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "ModuleAttempt" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "moduleIndex" INTEGER NOT NULL,
    "status" "ModuleAttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "ModuleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleAttempt_enrollmentId_idx" ON "ModuleAttempt"("enrollmentId");

-- CreateIndex
CREATE INDEX "ModuleAttempt_courseCode_moduleIndex_idx" ON "ModuleAttempt"("courseCode", "moduleIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleAttempt_enrollmentId_courseCode_moduleIndex_key" ON "ModuleAttempt"("enrollmentId", "courseCode", "moduleIndex");

-- AddForeignKey
ALTER TABLE "ModuleAttempt" ADD CONSTRAINT "ModuleAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "AbacusEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
