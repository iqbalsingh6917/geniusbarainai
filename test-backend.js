const { PrismaClient } = require('./packages/db/node_modules/.prisma/client');

const prisma = new PrismaClient();

async function testBackend() {
  try {
    console.log('Testing backend API logic directly...');
    
    // Test 1: Get courses with modules and level counts (similar to abacusCourses route)
    console.log('\n1. Testing courses with modules and level counts...');
    
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
    
    console.log(`Found ${courses.length} courses`);
    
    // For each course and module, get the level count
    const coursesWithLevelCounts = await Promise.all(courses.map(async (course) => {
      const modulesWithLevelCounts = await Promise.all(course.modules.map(async (module) => {
        // Use Prisma's $queryRaw to bypass the type checking issue
        const levelCountResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AbacusLevel" WHERE "moduleId" = ${module.id}`;
        const levelCount = parseInt(levelCountResult[0].count);
        
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
    
    console.log('Course details with level counts:');
    coursesWithLevelCounts.forEach(course => {
      console.log(`  Course: ${course.name} (${course.code})`);
      course.modules.forEach(module => {
        console.log(`    Module ${module.index}: ${module.title} - ${module.levelCount} levels`);
      });
    });
    
    // Test 2: Get levels for a specific module (similar to superadminAbacusLevels route)
    console.log('\n2. Testing levels for first module...');
    
    if (coursesWithLevelCounts.length > 0 && coursesWithLevelCounts[0].modules.length > 0) {
      const firstModuleId = coursesWithLevelCounts[0].modules[0].id;
      console.log(`Getting levels for module ID: ${firstModuleId}`);
      
      const levels = await prisma.$queryRaw`SELECT * FROM "AbacusLevel" WHERE "moduleId" = ${firstModuleId} ORDER BY "order" ASC`;
      console.log(`Found ${levels.length} levels for module ${firstModuleId}`);
      
      // Show first few levels
      levels.slice(0, 3).forEach(level => {
        console.log(`  Level ${level.id}: ${level.name} (Order: ${level.order}, Difficulty: ${level.difficulty})`);
      });
    }
    
    // Test 3: Test level counts for all modules
    console.log('\n3. Testing level counts for all modules...');
    
    for (const course of coursesWithLevelCounts) {
      console.log(`Course: ${course.name}`);
      for (const module of course.modules) {
        // Double-check the count with a direct query
        const directCountResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AbacusLevel" WHERE "moduleId" = ${module.id}`;
        const directCount = parseInt(directCountResult[0].count);
        
        console.log(`  Module ${module.index} (${module.title}): ${module.levelCount} levels (direct count: ${directCount})`);
        
        // Verify the counts match
        if (module.levelCount !== directCount) {
          console.warn(`  WARNING: Level count mismatch for module ${module.id}!`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing backend:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBackend();