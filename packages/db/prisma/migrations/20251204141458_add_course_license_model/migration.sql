-- CreateTable
CREATE TABLE "CourseLicense" (
    "id" TEXT NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseLicense_orgUnitId_courseCode_key" ON "CourseLicense"("orgUnitId", "courseCode");

-- AddForeignKey
ALTER TABLE "CourseLicense" ADD CONSTRAINT "CourseLicense_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
