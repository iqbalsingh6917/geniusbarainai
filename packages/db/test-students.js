const { PrismaClient } = require('@prisma/client');

async function testStudents() {
  const prisma = new PrismaClient();
  
  try {
    // Test if students table exists by querying it
    const students = await prisma.$queryRaw`SELECT * FROM "Student" LIMIT 5`;
    console.log('Students table exists and has data:');
    console.log(students);
    
    // Test if enrollments table exists
    const enrollments = await prisma.$queryRaw`SELECT * FROM "AbacusEnrollment" LIMIT 5`;
    console.log('\nEnrollments table exists and has data:');
    console.log(enrollments);
    
    // Test if assessments table exists
    const assessments = await prisma.$queryRaw`SELECT * FROM "AbacusAssessment" LIMIT 5`;
    console.log('\nAssessments table exists and has data:');
    console.log(assessments);
  } catch (error) {
    console.error('Error testing tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStudents();