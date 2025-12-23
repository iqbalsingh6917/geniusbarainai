-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Settlement" ADD COLUMN "paidByUserId" INTEGER;
ALTER TABLE "Settlement" ADD COLUMN "paymentRef" TEXT;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
