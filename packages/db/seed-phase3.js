const { PrismaClient } = require('@prisma/client');

async function seedPhase3() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Seeding Phase 3: Students, Enrollments, and Assessments');
    
    // Create Students using raw queries
    console.log('\nCreating students...');
    const studentsData = [
      {
        code: 'ST0001',
        firstName: 'Agam',
        lastName: 'Singh',
        age: 8,
        parentName: 'Rajesh Singh',
        contactPhone: '+91 98765 43210',
        contactEmail: 'rajesh.singh@email.com',
        status: 'ACTIVE',
      },
      {
        code: 'ST0002',
        firstName: 'Mehar',
        lastName: 'Kaur',
        age: 7,
        parentName: 'Harpreet Kaur',
        contactPhone: '+91 98765 43211',
        contactEmail: 'harpreet.kaur@email.com',
        status: 'ACTIVE',
      },
      {
        code: 'ST0003',
        firstName: 'Rohan',
        lastName: 'Verma',
        age: 9,
        parentName: 'Anita Verma',
        contactPhone: '+91 98765 43212',
        contactEmail: 'anita.verma@email.com',
        status: 'ACTIVE',
      },
      {
        code: 'ST0004',
        firstName: 'Priya',
        lastName: 'Sharma',
        age: 8,
        parentName: 'Vikram Sharma',
        contactPhone: '+91 98765 43213',
        contactEmail: 'vikram.sharma@email.com',
        status: 'ACTIVE',
      },
      {
        code: 'ST0005',
        firstName: 'Arjun',
        lastName: 'Patel',
        age: 7,
        parentName: 'Meera Patel',
        contactPhone: '+91 98765 43214',
        contactEmail: 'meera.patel@email.com',
        status: 'ACTIVE',
      },
    ];
    
    let studentsCreated = 0;
    for (const studentData of studentsData) {
      // Check if student already exists
      const existingStudent = await prisma.$queryRaw`
        SELECT * FROM "Student" WHERE "code" = ${studentData.code}
      `;
      
      if (existingStudent.length > 0) {
        console.log(`Student ${studentData.firstName} ${studentData.lastName} (${studentData.code}) already exists`);
        studentsCreated++;
        continue;
      }
      
      // Create student using raw query
      const student = await prisma.$queryRaw`
        INSERT INTO "Student" (
          "code", "firstName", "lastName", "age", "parentName", 
          "contactPhone", "contactEmail", "status", "createdAt", "updatedAt"
        ) VALUES (
          ${studentData.code}, ${studentData.firstName}, ${studentData.lastName}, 
          ${studentData.age}, ${studentData.parentName}, ${studentData.contactPhone}, 
          ${studentData.contactEmail}, ${studentData.status}, NOW(), NOW()
        ) RETURNING *
      `;
      
      console.log(`Created Student: ${student[0].firstName} ${student[0].lastName} (${student[0].code})`);
      studentsCreated++;
    }
    
    console.log(`Seeded ${studentsCreated} students`);
    
    // Get ABACUS_L1_REGULAR course
    const abacusCourseResult = await prisma.$queryRaw`
      SELECT * FROM "AbacusCourse" WHERE "code" = 'ABACUS_L1_REGULAR'
    `;
    
    if (abacusCourseResult.length === 0) {
      console.error('ABACUS_L1_REGULAR course not found!');
      return;
    }
    
    const abacusCourse = abacusCourseResult[0];
    console.log(`Found course: ${abacusCourse.name}`);
    
    // Get modules
    const holdingPracticeModule = await prisma.$queryRaw`
      SELECT * FROM "AbacusModule" WHERE "courseId" = ${abacusCourse.id} AND "index" = 1
    `;
    
    const additionModule = await prisma.$queryRaw`
      SELECT * FROM "AbacusModule" WHERE "courseId" = ${abacusCourse.id} AND "index" = 2
    `;
    
    // Get all students
    const students = await prisma.$queryRaw`SELECT * FROM "Student"`;
    
    // Create Enrollments
    console.log('\nCreating enrollments...');
    let enrollmentsCreated = 0;
    
    for (const student of students) {
      // Determine which module to start with
      let moduleId = 0;
      let levels = [];
      
      if (student.code === 'ST0001' || student.code === 'ST0002') {
        // First two students start with Holding practice
        moduleId = holdingPracticeModule[0]?.id || 0;
        if (moduleId) {
          levels = await prisma.$queryRaw`
            SELECT * FROM "AbacusLevel" WHERE "moduleId" = ${moduleId} ORDER BY "order" ASC
          `;
        }
      } else {
        // Other students start with Addition 1-digit
        moduleId = additionModule[0]?.id || 0;
        if (moduleId) {
          levels = await prisma.$queryRaw`
            SELECT * FROM "AbacusLevel" WHERE "moduleId" = ${moduleId} ORDER BY "order" ASC
          `;
        }
      }
      
      if (levels.length > 0) {
        const levelId = levels[0].id; // Start with first level
        
        // Check if enrollment already exists
        const existingEnrollment = await prisma.$queryRaw`
          SELECT * FROM "AbacusEnrollment" 
          WHERE "studentId" = ${student.id} AND "courseId" = ${abacusCourse.id}
        `;
        
        if (existingEnrollment.length > 0) {
          console.log(`Enrollment for ${student.firstName} ${student.lastName} already exists`);
          enrollmentsCreated++;
          continue;
        }
        
        // Create enrollment using raw query
        const enrollment = await prisma.$queryRaw`
          INSERT INTO "AbacusEnrollment" (
            "studentId", "courseId", "currentModuleId", "currentLevelId", 
            "status", "notes", "startDate", "createdAt", "updatedAt"
          ) VALUES (
            ${student.id}, ${abacusCourse.id}, ${moduleId}, ${levelId}, 
            'ONGOING', 'New batch - evening slot', NOW(), NOW(), NOW()
          ) RETURNING *
        `;
        
        console.log(`Created enrollment for ${student.firstName} ${student.lastName} in ${abacusCourse.name}`);
        enrollmentsCreated++;
      }
    }
    
    console.log(`Seeded ${enrollmentsCreated} enrollments`);
    
    // Create Assessments
    console.log('\nCreating assessments...');
    const enrollments = await prisma.$queryRaw`SELECT * FROM "AbacusEnrollment"`;
    let assessmentsCreated = 0;
    
    for (const enrollment of enrollments) {
      // Get the current level for this enrollment
      const levelResult = await prisma.$queryRaw`
        SELECT * FROM "AbacusLevel" WHERE "id" = ${enrollment.currentLevelId}
      `;
      
      if (levelResult.length > 0) {
        const level = levelResult[0];
        
        // Create 1-2 assessments per enrollment
        const assessmentCount = 1 + (enrollment.id % 2);
        
        for (let i = 1; i <= assessmentCount; i++) {
          const scorePercent = 70 + (i * 10) + (enrollment.id % 10); // Scores between 70-99
          const passed = scorePercent >= 80;
          const remarks = passed ? 'Good speed' : 'Need more practice';
          
          // Create assessment using raw query
          const assessment = await prisma.$queryRaw`
            INSERT INTO "AbacusAssessment" (
              "enrollmentId", "levelId", "scorePercent", "passed", 
              "remarks", "attemptDate", "createdAt", "updatedAt"
            ) VALUES (
              ${enrollment.id}, ${level.id}, ${scorePercent}, ${passed}, 
              ${remarks}, NOW(), NOW(), NOW()
            ) RETURNING *
          `;
          
          console.log(`Created assessment for enrollment ${enrollment.id}: ${scorePercent}% (${passed ? 'PASS' : 'FAIL'})`);
          assessmentsCreated++;
        }
      }
    }
    
    console.log(`Seeded ${assessmentsCreated} assessments`);
    
    console.log('\nPhase 3 seeding completed successfully!');
  } catch (error) {
    console.error('Error during Phase 3 seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPhase3();