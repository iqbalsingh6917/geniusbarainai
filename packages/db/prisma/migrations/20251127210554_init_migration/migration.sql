-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbacusCourse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbacusCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbacusModule" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbacusModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbacusLevel" (
    "id" SERIAL NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "ageGroup" TEXT,
    "operations" TEXT[],
    "formulas" TEXT[],
    "visualization" TEXT,
    "maxDigits" INTEGER,
    "maxTerms" INTEGER,
    "examDurationMin" INTEGER NOT NULL,
    "passingPercent" INTEGER NOT NULL,
    "timeBonusEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scoringRules" JSONB,
    "worksheetUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbacusLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AbacusCourse_code_key" ON "AbacusCourse"("code");

-- AddForeignKey
ALTER TABLE "AbacusModule" ADD CONSTRAINT "AbacusModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AbacusCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
