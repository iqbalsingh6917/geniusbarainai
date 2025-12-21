const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const teachers = await prisma.user.findMany({ 
      where: { role: 'TEACHER' } 
    });
    console.log('Teachers:', teachers);
    
    const students = await prisma.student.findMany();
    console.log('Students:', students);
    
    const centerUsers = await prisma.user.findMany({ 
      where: { role: 'CENTER_MANAGER' } 
    });
    console.log('Center managers:', centerUsers);
    
    const orgUnits = await prisma.orgUnit.findMany();
    console.log('Org Units:', orgUnits);
    
    const enrollments = await prisma.abacusEnrollment.findMany();
    console.log('Enrollments:', enrollments);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();