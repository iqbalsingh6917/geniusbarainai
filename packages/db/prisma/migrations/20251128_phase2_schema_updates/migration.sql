-- AlterTable to add new columns and handle existing data
ALTER TABLE "AbacusLevel" ADD COLUMN IF NOT EXISTS "moduleId" INTEGER;

-- AddForeignKey to link AbacusLevel to AbacusModule
ALTER TABLE "AbacusLevel" ADD COLUMN IF NOT EXISTS "moduleCode" TEXT;

-- Add skillFocus to AbacusModule
ALTER TABLE "AbacusModule" ADD COLUMN IF NOT EXISTS "skillFocus" TEXT;

-- Create AbacusWorksheet table
CREATE TABLE IF NOT EXISTS "AbacusWorksheet" (
    "id" SERIAL NOT NULL,
    "levelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "difficultyBand" TEXT,
    "questionCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbacusWorksheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for AbacusWorksheet
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AbacusWorksheet_levelId_idx') THEN
        CREATE INDEX "AbacusWorksheet_levelId_idx" ON "AbacusWorksheet"("levelId");
    END IF;
END $$;

-- AddForeignKey for AbacusWorksheet
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AbacusWorksheet_levelId_fkey') THEN
        ALTER TABLE "AbacusWorksheet" ADD CONSTRAINT "AbacusWorksheet_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AbacusLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Update existing AbacusLevel records to set moduleId
-- This assumes we have a way to map existing levels to modules
-- In a real scenario, you'd need to customize this based on your data
UPDATE "AbacusLevel" SET "moduleId" = 1 WHERE "id" = 1;
UPDATE "AbacusLevel" SET "moduleId" = 1 WHERE "id" = 2;
UPDATE "AbacusLevel" SET "moduleId" = 1 WHERE "id" = 3;

-- Make moduleId required
ALTER TABLE "AbacusLevel" ALTER COLUMN "moduleId" SET NOT NULL;

-- AddForeignKey for AbacusLevel
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AbacusLevel_moduleId_fkey') THEN
        ALTER TABLE "AbacusLevel" ADD CONSTRAINT "AbacusLevel_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AbacusModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex for AbacusLevel moduleId_order
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AbacusLevel_moduleId_order_key') THEN
        CREATE UNIQUE INDEX "AbacusLevel_moduleId_order_key" ON "AbacusLevel"("moduleId", "order");
    END IF;
END $$;