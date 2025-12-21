/*
  Warnings:

  - A unique constraint covering the columns `[moduleCode,order]` on the table `AbacusLevel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[courseId,index]` on the table `AbacusModule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AbacusLevel_moduleCode_order_key" ON "AbacusLevel"("moduleCode", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AbacusModule_courseId_index_key" ON "AbacusModule"("courseId", "index");
