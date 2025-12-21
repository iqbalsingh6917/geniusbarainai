import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seatMatrix: { orgCode: string; courseCode: string; totalSeats: number }[] = [
  { orgCode: 'BP_ACME', courseCode: 'ABACUS_L1_REGULAR', totalSeats: 200 },
  { orgCode: 'BP_ACME', courseCode: 'ABACUS_BEATS_20', totalSeats: 150 },
  { orgCode: 'FR001', courseCode: 'ABACUS_L1_REGULAR', totalSeats: 100 },
  { orgCode: 'FR001', courseCode: 'ABACUS_BEATS_20', totalSeats: 80 },
  { orgCode: 'CE001', courseCode: 'ABACUS_L1_REGULAR', totalSeats: 60 },
  { orgCode: 'CE001', courseCode: 'ABACUS_BEATS_20', totalSeats: 40 },
];

async function main() {
  console.log('🎟️ Seeding CourseLicense entries');

  const orgCodes = Array.from(new Set(seatMatrix.map((s) => s.orgCode)));
  const courseCodes = Array.from(new Set(seatMatrix.map((s) => s.courseCode)));

  const orgUnits = await prisma.orgUnit.findMany({
    where: { code: { in: orgCodes } },
  });
  const orgByCode = new Map(orgUnits.map((o) => [o.code, o]));

  const courses = await prisma.abacusCourse.findMany({
    where: { code: { in: courseCodes } },
  });
  const courseByCode = new Map(courses.map((c) => [c.code, c]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seat of seatMatrix) {
    const orgUnit = orgByCode.get(seat.orgCode);
    if (!orgUnit) {
      console.warn(`⚠️ OrgUnit with code ${seat.orgCode} not found; skipping`);
      skipped++;
      continue;
    }
    if (!courseByCode.has(seat.courseCode)) {
      console.warn(`⚠️ Course with code ${seat.courseCode} not found; skipping`);
      skipped++;
      continue;
    }

    const result = await prisma.courseLicense.upsert({
      where: { orgUnitId_courseCode: { orgUnitId: orgUnit.id, courseCode: seat.courseCode } },
      update: {
        totalSeats: seat.totalSeats,
      },
      create: {
        orgUnitId: orgUnit.id,
        courseCode: seat.courseCode,
        totalSeats: seat.totalSeats,
        usedSeats: 0,
        validFrom: null,
        validTo: null,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(
    `✅ CourseLicense seeding complete. created=${created}, updated=${updated}, skipped=${skipped}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
