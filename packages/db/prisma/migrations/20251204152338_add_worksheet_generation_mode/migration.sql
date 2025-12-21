-- CreateEnum
CREATE TYPE "WorksheetGenerationMode" AS ENUM ('STATIC', 'TEMPLATE', 'AI');

-- AlterTable
ALTER TABLE "AbacusWorksheet" ADD COLUMN     "generationConfig" JSONB,
ADD COLUMN     "generationMode" "WorksheetGenerationMode" NOT NULL DEFAULT 'STATIC';
