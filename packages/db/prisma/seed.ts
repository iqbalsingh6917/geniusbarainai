import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const isDemoSeed = process.env.DEMO_SEED === 'true';

type QuestionGenType = 'NO_CARRY' | 'FIVE_COMBO' | 'MIXED' | 'SPEED';
type SubQuestionType = 'NO_BORROW' | 'BORROW_PATTERN' | 'SUB_MIXED' | 'SUB_SPEED';

const pairBanks: Record<QuestionGenType, Array<[number, number]>> = {
  NO_CARRY: [
    [1, 1],
    [1, 2],
    [2, 2],
    [3, 1],
    [2, 3],
    [3, 3],
    [4, 1],
    [4, 2],
    [4, 3],
    [5, 1],
    [5, 2],
    [6, 1],
    [6, 2],
    [7, 1],
    [7, 2],
    [8, 1],
  ],
  FIVE_COMBO: [
    [1, 4],
    [2, 3],
    [3, 2],
    [4, 1],
    [5, 0],
    [6, 4],
    [4, 6],
    [7, 3],
    [3, 7],
    [8, 2],
    [2, 8],
    [9, 1],
    [1, 9],
    [5, 5],
  ],
  MIXED: [
    [1, 5],
    [2, 6],
    [3, 5],
    [4, 4],
    [2, 7],
    [3, 6],
    [4, 5],
    [7, 2],
    [6, 3],
    [5, 4],
    [8, 1],
    [9, 0],
    [7, 1],
    [6, 2],
    [5, 3],
    [4, 2],
    [3, 4],
  ],
  SPEED: [
    [9, 1],
    [8, 2],
    [7, 3],
    [6, 4],
    [5, 5],
    [4, 6],
    [3, 7],
    [2, 8],
    [1, 9],
    [0, 9],
    [9, 0],
    [8, 1],
    [7, 2],
    [6, 3],
    [5, 4],
    [4, 5],
    [3, 6],
  ],
};

const subPairBanks: Record<SubQuestionType, Array<[number, number]>> = {
  NO_BORROW: [
    [9, 1],
    [8, 1],
    [7, 2],
    [6, 2],
    [5, 3],
    [4, 1],
    [5, 2],
    [6, 3],
    [7, 4],
    [8, 2],
    [9, 3],
    [6, 1],
    [4, 2],
    [3, 1],
    [2, 1],
  ],
  BORROW_PATTERN: [
    [10, 1],
    [10, 2],
    [10, 3],
    [9, 5],
    [9, 4],
    [8, 5],
    [8, 6],
    [7, 5],
    [10, 6],
    [10, 7],
    [10, 8],
    [9, 6],
    [9, 7],
    [8, 7],
  ],
  SUB_MIXED: [
    [9, 8],
    [8, 7],
    [7, 6],
    [6, 5],
    [9, 5],
    [8, 4],
    [7, 3],
    [6, 2],
    [5, 1],
    [9, 2],
    [8, 3],
    [7, 1],
    [6, 4],
    [5, 2],
    [4, 3],
  ],
  SUB_SPEED: [
    [9, 0],
    [9, 1],
    [9, 2],
    [8, 0],
    [8, 1],
    [7, 0],
    [7, 1],
    [6, 0],
    [6, 1],
    [5, 0],
    [5, 1],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
    [9, 3],
    [8, 4],
  ],
};

function generateQuestions(type: QuestionGenType, count: number) {
  const pairs = pairBanks[type];
  const questions: { prompt: string; correctAnswer: string; maxMarks: number }[] = [];
  let idx = 0;
  while (questions.length < count) {
    const [a, b] = pairs[idx % pairs.length];
    const sum = a + b;
    // Ensure no-carry constraint when requested
    if (type === 'NO_CARRY' && sum > 9) {
      idx++;
      continue;
    }
    questions.push({
      prompt: `${a} + ${b} =`,
      correctAnswer: String(sum),
      maxMarks: 1,
    });
    idx++;
  }
  return questions;
}

function generateSubQuestions(type: SubQuestionType, count: number) {
  const pairs = subPairBanks[type];
  const questions: { prompt: string; correctAnswer: string; maxMarks: number }[] = [];
  let idx = 0;
  while (questions.length < count) {
    const [a, b] = pairs[idx % pairs.length];
    if (a < b) {
      idx++;
      continue;
    }
    const diff = a - b;
    questions.push({
      prompt: `${a} - ${b} =`,
      correctAnswer: String(diff),
      maxMarks: 1,
    });
    idx++;
  }
  return questions;
}

function buildQuestionsFor(levelOrder: number, kind: string) {
  const lowerKind = kind.toUpperCase();
  if (levelOrder === 1) {
    if (lowerKind === 'EXAM') return generateQuestions('NO_CARRY', 30);
    if (lowerKind === 'SPEED') return generateQuestions('NO_CARRY', 25);
    return generateQuestions('NO_CARRY', 20);
  }
  if (levelOrder === 2) {
    if (lowerKind === 'EXAM') return generateQuestions('MIXED', 30);
    if (lowerKind === 'SPEED') return generateQuestions('FIVE_COMBO', 25);
    return generateQuestions('FIVE_COMBO', 20);
  }
  if (levelOrder === 3) {
    if (lowerKind === 'EXAM') return generateQuestions('MIXED', 35);
    if (lowerKind === 'SPEED') return generateQuestions('MIXED', 30);
    return generateQuestions('MIXED', 25);
  }
  // Level 4 and beyond: speed-focused mixed set
  if (lowerKind === 'EXAM') return generateQuestions('SPEED', 50);
  if (lowerKind === 'SPEED') return generateQuestions('SPEED', 40);
  return generateQuestions('SPEED', 30);
}

function buildSubQuestionsFor(levelOrder: number, kind: string) {
  const lowerKind = kind.toUpperCase();
  if (levelOrder === 1) {
    if (lowerKind === 'EXAM') return generateSubQuestions('NO_BORROW', 30);
    if (lowerKind === 'SPEED') return generateSubQuestions('NO_BORROW', 25);
    return generateSubQuestions('NO_BORROW', 20);
  }
  if (levelOrder === 2) {
    if (lowerKind === 'EXAM') return generateSubQuestions('BORROW_PATTERN', 30);
    if (lowerKind === 'SPEED') return generateSubQuestions('BORROW_PATTERN', 25);
    return generateSubQuestions('BORROW_PATTERN', 20);
  }
  if (levelOrder === 3) {
    if (lowerKind === 'EXAM') return generateSubQuestions('SUB_MIXED', 35);
    if (lowerKind === 'SPEED') return generateSubQuestions('SUB_MIXED', 30);
    return generateSubQuestions('SUB_MIXED', 25);
  }
  if (lowerKind === 'EXAM') return generateSubQuestions('SUB_SPEED', 50);
  if (lowerKind === 'SPEED') return generateSubQuestions('SUB_SPEED', 40);
  return generateSubQuestions('SUB_SPEED', 30);
}

async function main() {
  // Create SUPERADMIN user
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Test@12345', saltRounds);

  console.log(`Seeding demo data (DEMO_SEED=${isDemoSeed ? 'true' : 'false'})`);
  
  const superadmin = await prisma.user.upsert({
    where: { username: 'SA001' },
    update: {},
    create: {
      username: 'SA001',
      passwordHash,
      role: 'SUPERADMIN',
    },
  });
  
  console.log(`Created/Updated SUPERADMIN user with id: ${superadmin.id}`);
  
  // Create Org Units
  console.log('\nCreating org units...');
  
  // Create SUPERADMIN_ROOT org unit
  const saRoot = await prisma.orgUnit.upsert({
    where: { code: 'SA_ROOT' },
    update: {},
    create: {
      code: 'SA_ROOT',
      name: 'Superadmin Root',
      type: 'SUPERADMIN_ROOT',
    },
  });
  
  console.log(`Created/Updated SUPERADMIN_ROOT org unit with id: ${saRoot.id}`);
  
  // Create partner/franchise/center chain for demos
  const bp001 = await prisma.orgUnit.upsert({
    where: { code: 'BP001' },
    update: {},
    create: {
      code: 'BP001',
      name: 'North Zone Partner',
      type: 'BUSINESS_PARTNER',
      parentId: saRoot.id,
    },
  });

  const fr001 = await prisma.orgUnit.upsert({
    where: { code: 'FR001' },
    update: {},
    create: {
      code: 'FR001',
      name: 'Ludhiana Franchise',
      type: 'FRANCHISE',
      parentId: bp001.id,
    },
  });
  
  const ce001 = await prisma.orgUnit.upsert({
    where: { code: 'CE001' },
    update: {},
    create: {
      code: 'CE001',
      name: 'Patiala Main Center',
      type: 'CENTER',
      parentId: fr001.id,
    },
  });
  
  console.log(`Created/Updated CE001 org unit with id: ${ce001.id}`);

  // Link SUPERADMIN user to SA_ROOT
  await prisma.user.update({
    where: { id: superadmin.id },
    data: { orgUnitId: saRoot.id },
  });
  
  console.log(`Linked SA001 to SA_ROOT`);

  // Create demo users for each layer
  const bpUser = await prisma.user.upsert({
    where: { username: 'BP001' },
    update: {
      role: 'BUSINESS_PARTNER',
      orgUnitId: bp001.id,
    },
    create: {
      username: 'BP001',
      passwordHash,
      role: 'BUSINESS_PARTNER',
      orgUnitId: bp001.id,
    },
  });
  console.log(`Created/Updated BUSINESS_PARTNER user ${bpUser.username}`);

  const franchiseUser = await prisma.user.upsert({
    where: { username: 'FR001' },
    update: {
      role: 'FRANCHISE',
      orgUnitId: fr001.id,
    },
    create: {
      username: 'FR001',
      passwordHash,
      role: 'FRANCHISE',
      orgUnitId: fr001.id,
    },
  });
  console.log(`Created/Updated FRANCHISE user ${franchiseUser.username}`);

  const centerManager = await prisma.user.upsert({
    where: { username: 'CE001' },
    update: {
      role: 'CENTER_MANAGER',
      orgUnitId: ce001.id,
    },
    create: {
      username: 'CE001',
      passwordHash,
      role: 'CENTER_MANAGER',
      orgUnitId: ce001.id,
    },
  });
  console.log(`Created/Updated CENTER_MANAGER user ${centerManager.username}`);

  const admissionsUser = await prisma.user.upsert({
    where: { username: 'AD001' },
    update: {
      role: 'ADMISSIONS',
      orgUnitId: ce001.id,
    },
    create: {
      username: 'AD001',
      passwordHash,
      role: 'ADMISSIONS',
      orgUnitId: ce001.id,
    },
  });
  console.log(`Created/Updated ADMISSIONS user ${admissionsUser.username}`);

  const teacherUser = await prisma.user.upsert({
    where: { username: 'TEA001' },
    update: {
      role: 'TEACHER',
      orgUnitId: ce001.id,
    },
    create: {
      username: 'TEA001',
      passwordHash,
      role: 'TEACHER',
      orgUnitId: ce001.id,
    },
  });
  console.log(`Created/Updated TEACHER user ${teacherUser.username}`);
  
  // Create Abacus Course
  const course = await prisma.abacusCourse.upsert({
    where: { code: 'ABACUS_L1_REGULAR' },
    update: {},
    create: {
      code: 'ABACUS_L1_REGULAR',
      name: 'Abacus Level 1 (Regular)',
      variant: 'REGULAR',
      description: 'Introduction to abacus learning for beginners',
    },
  });
  
  console.log(`Created/Updated Abacus Course with id: ${course.id}`);
  
  // Create Abacus Modules
  const modulesData = [
    {
      courseId: course.id,
      index: 1,
      title: 'Holding practice',
      summary: 'Learn the basics of abacus and finger techniques',
      skillFocus: 'Finger techniques and basic bead manipulation',
    },
    {
      courseId: course.id,
      index: 2,
      title: 'Addition 1-digit',
      summary: 'Master addition of single-digit numbers',
      skillFocus: '1-digit addition',
    },
    {
      courseId: course.id,
      index: 3,
      title: 'Subtraction 1-digit',
      summary: 'Master subtraction of single-digit numbers',
      skillFocus: '1-digit subtraction',
    },
    {
      courseId: course.id,
      index: 4,
      title: '2-digit operations',
      summary: 'Practice addition and subtraction together',
      skillFocus: 'Mixed 2-digit operations',
    },
    {
      courseId: course.id,
      index: 5,
      title: 'Mixed 2-digit',
      summary: 'Learn addition of two-digit numbers',
      skillFocus: 'Mixed 2-digit operations',
    },
    {
      courseId: course.id,
      index: 6,
      title: 'Carry / Borrow basics',
      summary: 'Learn subtraction of two-digit numbers',
      skillFocus: 'Carry and borrow techniques',
    },
    {
      courseId: course.id,
      index: 7,
      title: '3-digit operations',
      summary: 'Practice addition and subtraction of two-digit numbers',
      skillFocus: '3-digit operations',
    },
    {
      courseId: course.id,
      index: 8,
      title: 'Speed enhancement',
      summary: 'Improve calculation speed and accuracy',
      skillFocus: 'Speed and accuracy',
    },
    {
      courseId: course.id,
      index: 9,
      title: 'Exam revision',
      summary: 'Comprehensive review of all Level 1 concepts',
      skillFocus: 'Comprehensive review',
    },
  ];
  
  const createdModules = [];
  for (const moduleData of modulesData) {
    const module = await prisma.abacusModule.upsert({
      where: { 
        courseId_index: {
          courseId: moduleData.courseId,
          index: moduleData.index
        }
      },
      update: {},
      create: moduleData,
    });
    
    createdModules.push(module);
    console.log(`Created/Updated Abacus Module with id: ${module.id}`);
  }
  
  // Create Abacus Levels for each module (2-4 levels per module)
  // Create levels for each module
  for (const module of createdModules) {
    const levelCount = 2 + (module.index % 3); // 2-4 levels per module
    
    console.log(`Creating ${levelCount} levels for module ${module.id} (${module.title})`);
    
    for (let i = 1; i <= levelCount; i++) {
      const existingLevel = await prisma.abacusLevel.findFirst({
        where: { moduleId: module.id, order: i },
      });
      if (existingLevel) {
        console.log(`Level with moduleId ${module.id} and order ${i} already exists with id: ${existingLevel.id}`);
        continue;
      }

      const operations = module.index <= 4 ? ['ADDITION'] : module.index <= 6 ? ['SUBTRACTION'] : ['ADDITION', 'SUBTRACTION'];
      const formulas = module.index <= 3 ? ['5-combo'] : ['5-combo', 'complement'];
      const level = await prisma.abacusLevel.create({
        data: {
          moduleId: module.id,
          order: i,
          name: `${module.title} - Level ${i}`,
          difficulty: i <= 2 ? 'EASY' : i === 3 ? 'MEDIUM' : 'HARD',
          ageGroup: '6-9',
          operations,
          formulas,
          maxDigits: module.index <= 4 ? 1 : 2,
          maxTerms: module.index <= 4 ? 2 : 3,
          examDurationMin: 10 + i * 5,
          passingPercent: 80 + i * 2,
          timeBonusEnabled: i > 2,
          isActive: true,
        },
      });

      console.log(`Created Abacus Level with id: ${level.id} for module ${module.id}`);
    }
  }
  
  // Create Abacus Worksheets for each level
  console.log('\nCreating worksheets for levels...');
  let totalWorksheets = 0;
  let totalQuestionsSeeded = 0;
  let module2Questions = 0;
  let module3Questions = 0;
  
  for (const module of createdModules) {
    console.log(`\nProcessing module: "${module.title}" (ID: ${module.id})`);
    
    // Get all levels for this module
    const levels: any = await prisma.$queryRaw`SELECT * FROM "AbacusLevel" WHERE "moduleId" = ${module.id} ORDER BY "order" ASC`;
    
    console.log(`Found ${levels.length} levels for module "${module.title}"`);
    
    if (levels.length === 0) {
      console.log(`Skipping module "${module.title}" - no levels found`);
      continue;
    }
    
    let worksheetCountForModule = 0;
    const moduleWorksheetsForQuestions: { worksheet: any; level: any }[] = [];
    
    for (const level of levels) {
      console.log(`  Processing level: "${level.name}" (ID: ${level.id})`);
      
      // Reuse existing worksheets if present to avoid breaking assignments
      const existingWorksheets = await prisma.abacusWorksheet.findMany({
        where: { levelId: level.id },
        orderBy: { id: 'asc' },
      });

      // Create 2-3 worksheets per level
      const worksheetCount = 2 + (level.order % 2);
      
      console.log(`    Creating ${worksheetCount} worksheets for level "${level.name}"`);
      const levelWorksheets: any[] = [...existingWorksheets];
      
      for (let i = 1; i <= worksheetCount; i++) {
        if (levelWorksheets.length >= worksheetCount) {
          break;
        }
        // Generate worksheet title based on module type
        let title = '';
        let kind = '';
        let difficultyBand = '';
        let notes = '';
        
        // Determine worksheet properties based on module type
        if (module.title.includes('Addition')) {
          title = `Practice Sheet ${i} – Addition ${module.title.replace('Addition ', '')} (Level ${level.order})`;
          kind = i === worksheetCount ? 'EXAM' : i % 2 === 0 ? 'SPEED' : 'PRACTICE';
          difficultyBand = level.order <= 2 ? 'EASY' : level.order === 3 ? 'MEDIUM' : 'HARD';
          notes = `Addition-focused worksheet for ${module.title}`;
        } else if (module.title.includes('Subtraction')) {
          title = `Practice Sheet ${i} – Subtraction ${module.title.replace('Subtraction ', '')} (Level ${level.order})`;
          kind = i === worksheetCount ? 'EXAM' : i % 2 === 0 ? 'SPEED' : 'PRACTICE';
          difficultyBand = level.order <= 2 ? 'EASY' : level.order === 3 ? 'MEDIUM' : 'HARD';
          notes = `Subtraction-focused worksheet for ${module.title}`;
        } else {
          title = `Practice Sheet ${i} - ${module.title} (Level ${level.order})`;
          kind = i === worksheetCount ? 'EXAM' : i % 2 === 0 ? 'SPEED' : 'PRACTICE';
          difficultyBand = level.order <= 2 ? 'EASY' : level.order === 3 ? 'MEDIUM' : 'HARD';
          notes = `Mixed operations worksheet for ${module.title}`;
        }
        
        // Create worksheet
        const worksheet = await prisma.abacusWorksheet.create({
          data: {
            levelId: level.id,
            title,
            kind,
            difficultyBand,
            questionCount: 20 + i * 5,
            notes,
          },
        });
        
        console.log(`      Created worksheet: "${title}" (ID: ${worksheet.id})`);
        worksheetCountForModule++;
        totalWorksheets++;

        if (module.index === 2 || module.index === 3) {
          moduleWorksheetsForQuestions.push({ worksheet, level });
        }
        levelWorksheets.push(worksheet);
      }

      // Collect existing worksheets for question seeding (module 2/3)
      if (module.index === 2 || module.index === 3) {
        for (const ws of existingWorksheets) {
          moduleWorksheetsForQuestions.push({ worksheet: ws, level });
        }
      }
    }
    
    if ((module.index === 2 || module.index === 3) && moduleWorksheetsForQuestions.length > 0) {
      const isAddition = module.index === 2;
      console.log(`  Seeding questions for Module ${module.index} (${isAddition ? 'Addition' : 'Subtraction'} 1-digit) worksheets...`);
      for (const entry of moduleWorksheetsForQuestions) {
        const worksheetRow = entry.worksheet;
        const levelRow = entry.level;
        try {
          await prisma.worksheetQuestion.deleteMany({ where: { worksheetId: worksheetRow.id } });
        } catch (err: any) {
          console.warn(
            `    Skipping delete for worksheet ${worksheetRow.id} due to existing answers. Leaving existing questions intact.`
          );
          continue;
        }
        const questions = isAddition
          ? buildQuestionsFor(levelRow.order, worksheetRow.kind)
          : buildSubQuestionsFor(levelRow.order, worksheetRow.kind);
        const payload = questions.map((q, idx) => ({
          worksheetId: worksheetRow.id,
          orderIndex: idx + 1,
          questionType: 'NUMERIC',
          prompt: q.prompt,
          correctAnswer: q.correctAnswer,
          maxMarks: q.maxMarks,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await prisma.worksheetQuestion.createMany({ data: payload });
        await prisma.abacusWorksheet.update({
          where: { id: worksheetRow.id },
          data: { questionCount: payload.length, updatedAt: new Date() },
        });
        totalQuestionsSeeded += payload.length;
        if (isAddition) {
          module2Questions += payload.length;
        } else {
          module3Questions += payload.length;
        }
        console.log(
          `    Seeded ${payload.length} questions for worksheet "${worksheetRow.title}" (Level order ${levelRow.order}, kind ${worksheetRow.kind})`
        );
      }
    }

    console.log(`  Completed module "${module.title}" - ${worksheetCountForModule} worksheets created`);
  }
  
  console.log(`\nTotal worksheets created: ${totalWorksheets}`);
  console.log(`Total questions seeded for Module 2: ${module2Questions}`);
  console.log(`Total questions seeded for Module 3: ${module3Questions}`);
  
  // Create Sample Students
  console.log('\nCreating sample students...');
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
      orgUnitId: ce001.id, // Link to CE001
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
      orgUnitId: ce001.id, // Link to CE001
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
      orgUnitId: ce001.id, // Link to CE001
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
      orgUnitId: ce001.id, // Link to CE001
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
      orgUnitId: ce001.id, // Link to CE001
    },
  ];
  
  const createdStudents = [];
  for (const studentData of studentsData) {
    const student = await prisma.student.upsert({
      where: { code: studentData.code },
      update: {},
      create: studentData,
    });
    
    createdStudents.push(student);
    console.log(`Created/Updated Student with id: ${student.id}`);
  }
  
  console.log(`Seeded ${createdStudents.length} students`);
  
  // Create Sample Enrollments
  console.log('\nCreating sample enrollments...');
  const enrollmentsData = [];
  
  for (const student of createdStudents) {
    // Check if enrollment already exists
    const existingEnrollment = await prisma.abacusEnrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: course.id,
      },
    });
    
    let enrollment;
    if (existingEnrollment) {
      enrollment = existingEnrollment;
      console.log(`Found existing Enrollment with id: ${enrollment.id}`);
    } else {
      enrollment = await prisma.abacusEnrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          currentModuleId: createdModules[0].id, // Start with first module
          currentLevelId: null, // Will be set after we create assessments
          status: 'ONGOING',
          startDate: new Date(),
          notes: 'New batch - evening slot',
          orgUnitId: ce001.id, // Link to CE001
        },
      });
      console.log(`Created Enrollment with id: ${enrollment.id}`);
    }
    
    enrollmentsData.push(enrollment);
  }
  
  console.log(`Seeded ${enrollmentsData.length} enrollments`);
  
  // Create Sample Assessments
  console.log('\nCreating sample assessments...');
  let assessmentsCreated = 0;
  
  for (const enrollment of enrollmentsData) {
    // Get all levels for the course
    const levels: any = await prisma.$queryRaw`
      SELECT l.* 
      FROM "AbacusLevel" l
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      WHERE m."courseId" = ${course.id}
      ORDER BY m."index", l."order"
    `;
    
    // Create 2-5 assessments per enrollment
    const assessmentCount = 2 + (enrollment.id % 4);
    
    for (let i = 0; i < Math.min(assessmentCount, levels.length); i++) {
      const level = levels[i];
      
      // Generate realistic scores
      const baseScore = 75 + (i * 3); // Increasing scores
      const scorePercent = Math.min(98, baseScore + Math.floor(Math.random() * 15) - 7); // ±7 variation
      const passed = scorePercent >= level.passingPercent;
      const remarks = passed ? 'Good speed' : 'Needs more practice';
      
      // Create assessment using raw query to avoid TypeScript issues
      const assessment: any = await prisma.$queryRaw`
        INSERT INTO "AbacusAssessment" (
          "enrollmentId", "levelId", "scorePercent", "passed", "remarks", "attemptDate", "createdAt", "updatedAt"
        ) VALUES (
          ${enrollment.id}, ${level.id}, ${scorePercent}, ${passed}, ${remarks}, 
          NOW() - INTERVAL '${i * 2} days', NOW(), NOW()
        ) RETURNING *
      `;
      
      console.log(`Created assessment for enrollment ${enrollment.id}: ${scorePercent}% (${passed ? 'PASS' : 'FAIL'})`);
      assessmentsCreated++;
    }
  }
  
  console.log(`Seeded ${assessmentsCreated} assessments`);
  
  // Debug: Log how many levels were created per module
  for (const module of createdModules) {
    // Use raw query to avoid TypeScript issues
    const levelCountResult: any = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AbacusLevel" WHERE "moduleId" = ${module.id}`;
    const levelCount = parseInt(levelCountResult[0].count);
    console.log(`DEBUG: Module ${module.index} (${module.title}) has ${levelCount} levels`);
  }

  if (isDemoSeed) {
    console.log('\nCreating demo CRM, finance, and audit fixtures...');
    await prisma.leadActivity.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.paymentTransaction.deleteMany({ where: { orgUnitId: ce001.id } });
    await prisma.studentFeeRecord.deleteMany({ where: { orgUnitId: ce001.id } });

    const demoLeads = [
      { firstName: 'Sanya', lastName: 'Malhotra', contactEmail: 'sanya@example.com', stage: 'NEW', source: 'CAMPAIGN' },
      { firstName: 'Kabir', lastName: 'Singh', contactPhone: '+91-9915100011', stage: 'CONTACTED', source: 'REFERRAL' },
      { firstName: 'Ishaan', lastName: 'Khurana', contactEmail: 'ishaan@parent.com', stage: 'TRIAL_DONE', source: 'WALK_IN' },
      { firstName: 'Meera', lastName: 'Bedi', contactPhone: '+91-9815900099', stage: 'CONVERTED', source: 'WHATSAPP' },
      { firstName: 'Rhea', lastName: 'Kapoor', contactEmail: 'rhea@demo.com', stage: 'LOST', source: 'OTHER' },
    ];

    for (const lead of demoLeads) {
      await prisma.lead.create({
        data: {
          ...lead,
          orgUnitId: ce001.id,
          createdByUserId: bpUser.id,
          assignedToUserId: centerManager.id,
          lastStageChangedAt: new Date(),
          lastStageChangedBy: centerManager.id,
        },
      });
    }
    console.log(`Seeded ${demoLeads.length} demo leads for CE001`);

    const feeRecords: any[] = [];
    for (const enrollment of enrollmentsData.slice(0, 2)) {
      const feeRecord = await prisma.studentFeeRecord.create({
        data: {
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          orgUnitId: ce001.id,
          amount: 12000,
          status: 'PENDING',
        },
      });
      feeRecords.push(feeRecord);
    }

    if (feeRecords.length > 0) {
      await prisma.studentFeeRecord.update({
        where: { id: feeRecords[0].id },
        data: { status: 'PARTIAL', amount: 6000 },
      });
      console.log('Marked first fee record as PARTIAL for quick demos');
    }

    await prisma.paymentTransaction.create({
      data: {
        orgUnitId: ce001.id,
        amount: 6000,
        type: 'CREDIT',
        method: 'UPI',
        notes: 'Demo upfront payment',
      },
    });

    // Ensure a passing assessment exists for certificate verification
    const firstEnrollment = enrollmentsData[0];
    if (firstEnrollment) {
      const assessment = await prisma.abacusAssessment.findFirst({
        where: { enrollmentId: firstEnrollment.id },
        orderBy: { attemptDate: 'desc' },
      });
      if (assessment) {
        await prisma.abacusAssessment.update({
          where: { id: assessment.id },
          data: { passed: true, scorePercent: 92 },
        });
        console.log(`Flagged assessment ${assessment.id} as PASS for enrollment ${firstEnrollment.id}`);
      }
    }

    await prisma.auditLog.createMany({
      data: [
        {
          action: 'DEMO_RESET',
          entityType: 'SYSTEM',
          entityId: 'DEMO',
          orgUnitId: ce001.id,
          userId: superadmin.id,
          meta: { demoSeed: true, timestamp: new Date().toISOString() },
          ipAddress: '127.0.0.1',
          userAgent: 'seed-script',
        },
        {
          action: 'LEADS_BOOTSTRAPPED',
          entityType: 'Lead',
          entityId: 'BATCH',
          orgUnitId: ce001.id,
          userId: centerManager.id,
          meta: { count: demoLeads.length },
          ipAddress: '127.0.0.1',
          userAgent: 'seed-script',
        },
      ],
    });
  }
  
  console.log(`\nSeeding completed! Total worksheets created: ${totalWorksheets}`);
  console.log('Seeded org units: SA_ROOT, BP001, FR001, CE001');
  console.log('Linked SA001 to SA_ROOT');
  console.log(`Linked ${createdStudents.length} students and ${enrollmentsData.length} enrollments to CE001`);

  // Create demo STUDENT user linked to first student
  if (createdStudents.length > 0) {
    const linkedStudent = createdStudents[0];
    const studentUser = await prisma.user.upsert({
      where: { username: 'STU001' },
      update: {
        studentId: linkedStudent.id,
        orgUnitId: linkedStudent.orgUnitId,
        role: 'STUDENT',
      },
      create: {
        username: 'STU001',
        passwordHash,
        role: 'STUDENT',
        orgUnitId: linkedStudent.orgUnitId,
        studentId: linkedStudent.id,
      },
    });
    console.log(
      `Seeded STUDENT user ${studentUser.username} / Test@12345 linked to student ${linkedStudent.code}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
