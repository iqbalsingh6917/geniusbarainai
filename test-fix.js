const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFix() {
  try {
    // Test the abacus courses endpoint logic
    console.log('Testing abacus courses endpoint logic...');
    
    // First get courses with modules
    const courses = await prisma.abacusCourse.findMany({
      include: {
        modules: {
          orderBy: {
            index: 'asc',
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    
    console.log('Found courses:', courses.length);
    
    // For each course and module, get the level count
    const coursesWithLevelCounts = await Promise.all(courses.map(async (course) => {
      const modulesWithLevelCounts = await Promise.all(course.modules.map(async (module) => {
        // Use Prisma's $queryRaw to bypass the type checking issue
        const levelCountResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AbacusLevel" WHERE "moduleId" = ${module.id}`;
        const levelCount = parseInt(levelCountResult[0].count);
        
        console.log(`Module ${module.id} (${module.title}) has ${levelCount} levels`);
        
        return {
          ...module,
          levelCount,
        };
      }));
      
      return {
        ...course,
        modules: modulesWithLevelCounts,
      };
    }));
    
    console.log('Courses with level counts:');
    for (const course of coursesWithLevelCounts) {
      console.log(`Course: ${course.name}`);
      for (const module of course.modules) {
        console.log(`  Module ${module.index}: ${module.title} - ${module.levelCount} levels`);
      }
    }
    
    // Test the abacus levels endpoint logic
    console.log('\nTesting abacus levels endpoint logic...');
    
    // Get levels for the first module
    if (coursesWithLevelCounts.length > 0 && coursesWithLevelCounts[0].modules.length > 0) {
      const firstModuleId = coursesWithLevelCounts[0].modules[0].id;
      console.log(`Getting levels for module ${firstModuleId}...`);
      
      const levels = await prisma.$queryRaw`SELECT * FROM "AbacusLevel" WHERE "moduleId" = ${firstModuleId} ORDER BY "order" ASC`;
      console.log(`Found ${levels.length} levels for module ${firstModuleId}`);
      
      // Convert BigInt values to numbers for JSON serialization
      const serializedLevels = levels.map((level) => {
        const serializedLevel = {};
        for (const [key, value] of Object.entries(level)) {
          if (typeof value === 'bigint') {
            serializedLevel[key] = Number(value);
          } else {
            serializedLevel[key] = value;
          }
        }
        return serializedLevel;
      });
      
      console.log('Serialized levels sample:', JSON.stringify(serializedLevels.slice(0, 2), null, 2));
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testFix();