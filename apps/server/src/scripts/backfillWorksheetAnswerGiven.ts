import { prisma } from '@lms/db';

/**
 * One-time backfill to ensure StudentWorksheetAnswer.answerGiven is never NULL/blank.
 * This protects legacy rows so downstream serializers/UI that rely on answerGiven stay safe.
 */
async function main() {
  console.log('Backfilling StudentWorksheetAnswer.answerGiven to non-empty strings when null/blank...');

  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "StudentWorksheetAnswer"
    SET "answerGiven" = COALESCE("answerGiven", '')
    WHERE "answerGiven" IS NULL
       OR TRIM("answerGiven") = '';
  `);

  console.log(`Rows updated: ${updated}`);
}

main()
  .catch((err) => {
    console.error('Error during backfill:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
