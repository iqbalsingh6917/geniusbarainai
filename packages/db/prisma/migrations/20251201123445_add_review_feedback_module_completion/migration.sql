-- AlterTable
ALTER TABLE "StudentWorksheetAttempt" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "teacherAdjustedScore" INTEGER,
ADD COLUMN     "teacherComment" TEXT;

-- CreateTable
CREATE TABLE "AbacusModuleCompletion" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbacusModuleCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbacusModuleCompletion_studentId_moduleId_key" ON "AbacusModuleCompletion"("studentId", "moduleId");

-- AddForeignKey
ALTER TABLE "AbacusModuleCompletion" ADD CONSTRAINT "AbacusModuleCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbacusModuleCompletion" ADD CONSTRAINT "AbacusModuleCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AbacusModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
