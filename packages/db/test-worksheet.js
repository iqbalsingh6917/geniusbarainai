async function testWorksheetCreation() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Get all modules
    const modules = await prisma.abacusModule.findMany({
      where: {
        course: {
          code: 'ABACUS_L1_REGULAR'
        }
      },
      orderBy: {
        index: 'asc'
      }
    });
    
    console.log('Modules found:', modules.length);
    modules.forEach(module => {
      console.log(`  Module ${module.index}: ${module.title}`);
    });
    
    // Get levels for the first module
    if (modules.length > 0) {
      const levels = await prisma.abacusLevel.findMany({
        where: {
          moduleId: modules[0].id
        },
        orderBy: {
          order: 'asc'
        }
      });
      
      console.log(`\nLevels for module "${modules[0].title}":`, levels.length);
      levels.forEach(level => {
        console.log(`  Level ${level.order}: ${level.name}`);
      });
      
      // Try to create a worksheet for the first level
      if (levels.length > 0) {
        console.log('\nTrying to create a worksheet...');
        
        // Delete existing worksheets for this level
        const deleteResult = await prisma.abacusWorksheet.deleteMany({
          where: {
            levelId: levels[0].id
          }
        });
        console.log(`Deleted ${deleteResult.count} existing worksheets`);
        
        // Create a new worksheet
        const worksheet = await prisma.abacusWorksheet.create({
          data: {
            levelId: levels[0].id,
            title: 'Test Worksheet',
            kind: 'PRACTICE',
            difficultyBand: 'EASY',
            questionCount: 10,
            notes: 'Test worksheet for testing'
          }
        });
        
        console.log('Created worksheet:', worksheet.title);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWorksheetCreation();