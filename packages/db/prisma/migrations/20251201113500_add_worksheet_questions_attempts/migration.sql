-- CreateTable
CREATE TABLE "WorksheetQuestion" (
    "id" SERIAL NOT NULL,
    "worksheetId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "questionType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorksheetQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWorksheetAttempt" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "worksheetId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "totalScore" INTEGER,
    "maxScore" INTEGER,
    "autoGraded" BOOLEAN NOT NULL DEFAULT false,
    "graderUserId" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWorksheetAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWorksheetAnswer" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answerGiven" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "marksAwarded" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWorksheetAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorksheetQuestion_worksheetId_orderIndex_idx" ON "WorksheetQuestion"("worksheetId", "orderIndex");

-- CreateIndex
CREATE INDEX "StudentWorksheetAttempt_studentId_worksheetId_assignmentId_idx" ON "StudentWorksheetAttempt"("studentId", "worksheetId", "assignmentId");

-- CreateIndex
CREATE INDEX "StudentWorksheetAnswer_attemptId_questionId_idx" ON "StudentWorksheetAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "WorksheetQuestion" ADD CONSTRAINT "WorksheetQuestion_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "AbacusWorksheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAttempt" ADD CONSTRAINT "StudentWorksheetAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAttempt" ADD CONSTRAINT "StudentWorksheetAttempt_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "AbacusWorksheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAttempt" ADD CONSTRAINT "StudentWorksheetAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "StudentWorksheetAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAttempt" ADD CONSTRAINT "StudentWorksheetAttempt_graderUserId_fkey" FOREIGN KEY ("graderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAnswer" ADD CONSTRAINT "StudentWorksheetAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "StudentWorksheetAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorksheetAnswer" ADD CONSTRAINT "StudentWorksheetAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "WorksheetQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
