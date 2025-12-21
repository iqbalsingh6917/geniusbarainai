/*
  Warnings:

  - You are about to drop the column `worksheetUrl` on the `AbacusLevel` table. All the data in the column will be lost.

*/

-- DropIndex
DROP INDEX IF EXISTS "AbacusLevel_moduleCode_order_key";

-- AlterTable
ALTER TABLE "AbacusLevel" DROP COLUMN "worksheetUrl",
ALTER COLUMN "moduleCode" DROP NOT NULL;