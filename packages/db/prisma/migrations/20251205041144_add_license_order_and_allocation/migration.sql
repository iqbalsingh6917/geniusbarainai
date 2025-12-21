-- CreateTable
CREATE TABLE "LicenseOrder" (
    "id" TEXT NOT NULL,
    "buyerOrgUnitId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "seatQuantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "totalPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseAllocation" (
    "id" TEXT NOT NULL,
    "parentOrgUnitId" INTEGER NOT NULL,
    "childOrgUnitId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "allocatedSeats" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseAllocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LicenseOrder" ADD CONSTRAINT "LicenseOrder_buyerOrgUnitId_fkey" FOREIGN KEY ("buyerOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_parentOrgUnitId_fkey" FOREIGN KEY ("parentOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_childOrgUnitId_fkey" FOREIGN KEY ("childOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
