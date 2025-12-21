const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssignments() {
  try {
    const assignments = await prisma.teacherStudentAssignment.findMany();
    console.log('Existing assignments:', assignments);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssignments();