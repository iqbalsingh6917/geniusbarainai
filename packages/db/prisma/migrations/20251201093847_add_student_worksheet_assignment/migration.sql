-- CreateTable
CREATE TABLE "StudentWorksheetAssignment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "worksheetId" INTEGER NOT NULL,
    "enrollmentId" INTEGER,
    "assignedByUserId" INTEGER,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWorksheetAssignment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentWorksheetAssignment" ADD CONSTRAINT "StudentWorksheetAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAssignment" ADD CONSTRAINT "StudentWorksheetAssignment_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "AbacusWorksheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAssignment" ADD CONSTRAINT "StudentWorksheetAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "AbacusEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAssignment" ADD CONSTRAINT "StudentWorksheetAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
