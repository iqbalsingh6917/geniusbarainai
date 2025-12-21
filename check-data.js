const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    // Check courses
    const courses = await prisma.abacusCourse.findMany({
      include: {
        modules: {
          orderBy: {
            index: 'asc'
          }
        }
      }
    });
    
    console.log('Courses:');
    console.log(JSON.stringify(courses, null, 2));
    
    // Check levels count per module
    console.log('\nLevel counts per module:');
    for (const course of courses) {
      console.log(`\nCourse: ${course.name} (${course.code})`);
      for (const module of course.modules) {
        const levelCount = await prisma.abacusLevel.count({
          where: {
            moduleId: module.id
          }
        });
        console.log(`  Module ${module.index}: ${module.title} - ${levelCount} levels`);
      }
    }
    
    // Check all levels
    const levels = await prisma.abacusLevel.findMany({
      orderBy: [
        { moduleId: 'asc' },
        { order: 'asc' }
      ]
    });
    
    console.log('\nAll levels:');
    console.log(`Total levels: ${levels.length}`);
    console.log('First few levels:');
    console.log(JSON.stringify(levels.slice(0, 10), null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();