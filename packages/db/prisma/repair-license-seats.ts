import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting CourseLicense.usedSeats to 0...');
  await prisma.courseLicense.updateMany({
    data: { usedSeats: 0 },
  });

  console.log('Recomputing usedSeats from ongoing enrollments...');
  const enrollments = await prisma.abacusEnrollment.findMany({
    where: { status: 'ONGOING' },
    include: { course: true },
  });

  const counts = new Map<string, number>();
  enrollments.forEach((e) => {
    const key = `${e.orgUnitId}:${e.course.code}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  for (const [key, count] of counts.entries()) {
    const [orgUnitIdStr, courseCode] = key.split(':');
    const orgUnitId = Number(orgUnitIdStr);
    await prisma.courseLicense.updateMany({
      where: { orgUnitId, courseCode },
      data: { usedSeats: count },
    });
  }

  console.log('Repair completed.');
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
