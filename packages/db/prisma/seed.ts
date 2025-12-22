import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const isDemoSeed = process.env.DEMO_SEED === 'true';

type QuestionGenType = 'NO_CARRY' | 'FIVE_COMBO' | 'MIXED' | 'SPEED';
type SubQuestionType = 'NO_BORROW' | 'BORROW_PATTERN' | 'SUB_MIXED' | 'SUB_SPEED';
type CourseSeed = {
  code: string;
  name: string;
  variant: string;
  description: string;
  ageBand?: string;
  durationWeeks?: number;
  difficultyBand?: string;
  feeAmount?: number;
  feeCurrency?: string;
};
type CommissionRuleSeed = {
  orgUnitId: number;
  type: 'LEAD' | 'ENROLLMENT';
  amount: number;
  currency?: string;
};

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

async function upsertCourse(config: CourseSeed) {
  return prisma.abacusCourse.upsert({
    where: { code: config.code },
    update: {
      name: config.name,
      variant: config.variant,
      description: config.description,
      ageBand: config.ageBand,
      durationWeeks: config.durationWeeks,
      difficultyBand: config.difficultyBand,
      feeAmount: config.feeAmount,
      feeCurrency: config.feeCurrency,
    },
    create: {
      code: config.code,
      name: config.name,
      variant: config.variant,
      description: config.description,
      ageBand: config.ageBand,
      durationWeeks: config.durationWeeks,
      difficultyBand: config.difficultyBand,
      feeAmount: config.feeAmount,
      feeCurrency: config.feeCurrency,
    },
  });
}

async function upsertCommissionRule(seed: CommissionRuleSeed) {
  const existing = await prisma.commissionRule.findFirst({
    where: { orgUnitId: seed.orgUnitId, type: seed.type },
  });

  if (existing) {
    return prisma.commissionRule.update({
      where: { id: existing.id },
      data: {
        amount: seed.amount,
        currency: seed.currency ?? existing.currency,
        isActive: true,
      },
    });
  }

  return prisma.commissionRule.create({
    data: {
      orgUnitId: seed.orgUnitId,
      type: seed.type,
      amount: seed.amount,
      currency: seed.currency ?? 'INR',
      isActive: true,
    },
  });
}

async function cloneCourseStructure(sourceCourseId: number, targetCourseId: number) {
  const existingModules = await prisma.abacusModule.findMany({
    where: { courseId: targetCourseId },
    select: { id: true },
  });
  if (existingModules.length > 0) {
    return;
  }

  const sourceModules = await prisma.abacusModule.findMany({
    where: { courseId: sourceCourseId },
    include: {
      levels: {
        include: {
          worksheets: {
            include: {
              questions: {
                include: { options: true },
              },
            },
          },
        },
      },
    },
    orderBy: { index: 'asc' },
  });

  for (const module of sourceModules) {
    const newModule = await prisma.abacusModule.create({
      data: {
        courseId: targetCourseId,
        index: module.index,
        title: module.title,
        summary: module.summary,
        skillFocus: module.skillFocus,
      },
    });

    for (const level of module.levels) {
      const newLevel = await prisma.abacusLevel.create({
        data: {
          moduleId: newModule.id,
          moduleCode: level.moduleCode,
          order: level.order,
          name: level.name,
          difficulty: level.difficulty,
          ageGroup: level.ageGroup,
          operations: level.operations,
          formulas: level.formulas,
          visualization: level.visualization,
          maxDigits: level.maxDigits,
          maxTerms: level.maxTerms,
          examDurationMin: level.examDurationMin,
          passingPercent: level.passingPercent,
          maxMarks: level.maxMarks,
          timeBonusEnabled: level.timeBonusEnabled,
          scoringRules: level.scoringRules,
          notes: level.notes,
          isActive: level.isActive,
        },
      });

      for (const worksheet of level.worksheets) {
        const newWorksheet = await prisma.abacusWorksheet.create({
          data: {
            levelId: newLevel.id,
            title: worksheet.title,
            kind: worksheet.kind,
            difficultyBand: worksheet.difficultyBand,
            questionCount: worksheet.questionCount,
            notes: worksheet.notes,
            generationMode: worksheet.generationMode,
            generationConfig: worksheet.generationConfig,
          },
        });

        for (const question of worksheet.questions) {
          const newQuestion = await prisma.worksheetQuestion.create({
            data: {
              worksheetId: newWorksheet.id,
              orderIndex: question.orderIndex,
              questionType: question.questionType,
              prompt: question.prompt,
              imageUrl: question.imageUrl,
              correctAnswer: question.correctAnswer,
              correctText: question.correctText,
              correctNum: question.correctNum,
              maxMarks: question.maxMarks,
            },
          });

          if (question.options.length > 0) {
            await prisma.worksheetOption.createMany({
              data: question.options.map((opt) => ({
                questionId: newQuestion.id,
                text: opt.text,
                isCorrect: opt.isCorrect,
              })),
            });
          }
        }
      }
    }
  }
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
  
  const courseConfigs: CourseSeed[] = [
    {
      code: 'ABACUS_L1_REGULAR',
      name: 'Abacus Level 1 (Regular)',
      variant: 'REGULAR',
      description: 'Introduction to abacus learning for beginners',
      ageBand: '7-9',
      durationWeeks: 16,
      difficultyBand: 'FOUNDATION',
      feeAmount: 12000,
      feeCurrency: 'INR',
    },
    {
      code: 'ABACUS_L1_JUNIOR',
      name: 'Abacus Level 1 (Junior)',
      variant: 'JUNIOR',
      description: 'Junior track with slower pacing and guided practice',
      ageBand: '5-7',
      durationWeeks: 20,
      difficultyBand: 'FOUNDATION',
      feeAmount: 10000,
      feeCurrency: 'INR',
    },
    {
      code: 'ABACUS_L1_SENIOR',
      name: 'Abacus Level 1 (Senior)',
      variant: 'SENIOR',
      description: 'Senior track with accelerated pacing',
      ageBand: '9-12',
      durationWeeks: 14,
      difficultyBand: 'ADVANCED',
      feeAmount: 14000,
      feeCurrency: 'INR',
    },
  ];

  const courseByCode = new Map<string, Awaited<ReturnType<typeof upsertCourse>>>();
  const baseCourse = await upsertCourse(courseConfigs[0]);
  courseByCode.set(baseCourse.code, baseCourse);
  const courseById = new Map<number, Awaited<ReturnType<typeof upsertCourse>>>();
  courseById.set(baseCourse.id, baseCourse);
  console.log(`Created/Updated Abacus Course with id: ${baseCourse.id}`);
  const baseFeeAmount = baseCourse.feeAmount ?? 12000;
  
  // Create Abacus Modules
  const modulesData = [
    {
      courseId: baseCourse.id,
      index: 1,
      title: 'Holding practice',
      summary: 'Learn the basics of abacus and finger techniques',
      skillFocus: 'Finger techniques and basic bead manipulation',
    },
    {
      courseId: baseCourse.id,
      index: 2,
      title: 'Addition 1-digit',
      summary: 'Master addition of single-digit numbers',
      skillFocus: '1-digit addition',
    },
    {
      courseId: baseCourse.id,
      index: 3,
      title: 'Subtraction 1-digit',
      summary: 'Master subtraction of single-digit numbers',
      skillFocus: '1-digit subtraction',
    },
    {
      courseId: baseCourse.id,
      index: 4,
      title: '2-digit operations',
      summary: 'Practice addition and subtraction together',
      skillFocus: 'Mixed 2-digit operations',
    },
    {
      courseId: baseCourse.id,
      index: 5,
      title: 'Mixed 2-digit',
      summary: 'Learn addition of two-digit numbers',
      skillFocus: 'Mixed 2-digit operations',
    },
    {
      courseId: baseCourse.id,
      index: 6,
      title: 'Carry / Borrow basics',
      summary: 'Learn subtraction of two-digit numbers',
      skillFocus: 'Carry and borrow techniques',
    },
    {
      courseId: baseCourse.id,
      index: 7,
      title: '3-digit operations',
      summary: 'Practice addition and subtraction of two-digit numbers',
      skillFocus: '3-digit operations',
    },
    {
      courseId: baseCourse.id,
      index: 8,
      title: 'Speed enhancement',
      summary: 'Improve calculation speed and accuracy',
      skillFocus: 'Speed and accuracy',
    },
    {
      courseId: baseCourse.id,
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

  // Clone L1 Regular into Junior/Senior tracks
  for (const config of courseConfigs.slice(1)) {
    const targetCourse = await upsertCourse(config);
    await cloneCourseStructure(baseCourse.id, targetCourse.id);
    courseByCode.set(targetCourse.code, targetCourse);
    courseById.set(targetCourse.id, targetCourse);
    console.log(`Ensured course clone for ${config.code} with id: ${targetCourse.id}`);
  }

  const commissionRuleSeeds: CommissionRuleSeed[] = [
    { orgUnitId: bp001.id, type: 'LEAD', amount: 200 },
    { orgUnitId: bp001.id, type: 'ENROLLMENT', amount: 500 },
    { orgUnitId: fr001.id, type: 'LEAD', amount: 150 },
    { orgUnitId: fr001.id, type: 'ENROLLMENT', amount: 400 },
    { orgUnitId: ce001.id, type: 'LEAD', amount: 100 },
    { orgUnitId: ce001.id, type: 'ENROLLMENT', amount: 300 },
  ];

  const commissionRules = await Promise.all(
    commissionRuleSeeds.map((seed) => upsertCommissionRule(seed))
  );
  const commissionRuleByKey = new Map<string, (typeof commissionRules)[number]>();
  for (const rule of commissionRules) {
    commissionRuleByKey.set(`${rule.orgUnitId}:${rule.type}`, rule);
  }
  
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
    {
      code: 'ST0006',
      firstName: 'Myra',
      lastName: 'Bansal',
      age: 6,
      parentName: 'Ritika Bansal',
      contactPhone: '+91 98765 43215',
      contactEmail: 'ritika.bansal@email.com',
      status: 'ACTIVE',
      orgUnitId: ce001.id,
    },
    {
      code: 'ST0007',
      firstName: 'Dev',
      lastName: 'Mehta',
      age: 10,
      parentName: 'Sanjay Mehta',
      contactPhone: '+91 98765 43216',
      contactEmail: 'sanjay.mehta@email.com',
      status: 'ACTIVE',
      orgUnitId: ce001.id,
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
  const enrollmentsData: any[] = [];
  const baseEnrollmentStudents = createdStudents.slice(0, 3);

  for (const student of baseEnrollmentStudents) {
    const existingEnrollment = await prisma.abacusEnrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: baseCourse.id,
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
          courseId: baseCourse.id,
          currentModuleId: createdModules[0].id,
          currentLevelId: null,
          status: 'ONGOING',
          startDate: new Date(),
          notes: 'New batch - evening slot',
          orgUnitId: ce001.id,
        },
      });
      console.log(`Created Enrollment with id: ${enrollment.id}`);
    }

    enrollmentsData.push(enrollment);
  }

  const juniorCourse = courseByCode.get('ABACUS_L1_JUNIOR');
  const seniorCourse = courseByCode.get('ABACUS_L1_SENIOR');
  const juniorStudent = createdStudents[5];
  const seniorStudent = createdStudents[6];

  let juniorEnrollment: any = null;
  let seniorEnrollment: any = null;

  if (juniorCourse && juniorStudent) {
    const juniorModules = await prisma.abacusModule.findMany({
      where: { courseId: juniorCourse.id },
      orderBy: { index: 'asc' },
    });
    const existingJuniorEnrollment = await prisma.abacusEnrollment.findFirst({
      where: { studentId: juniorStudent.id, courseId: juniorCourse.id },
    });
    juniorEnrollment =
      existingJuniorEnrollment ??
      (await prisma.abacusEnrollment.create({
        data: {
          studentId: juniorStudent.id,
          courseId: juniorCourse.id,
          currentModuleId: juniorModules[0]?.id ?? null,
          currentLevelId: null,
          status: 'ONGOING',
          startDate: new Date(),
          notes: 'Junior track - morning slot',
          orgUnitId: ce001.id,
        },
      }));
    enrollmentsData.push(juniorEnrollment);
  }

  if (seniorCourse && seniorStudent) {
    const seniorModules = await prisma.abacusModule.findMany({
      where: { courseId: seniorCourse.id },
      orderBy: { index: 'asc' },
    });
    const existingSeniorEnrollment = await prisma.abacusEnrollment.findFirst({
      where: { studentId: seniorStudent.id, courseId: seniorCourse.id },
    });
    seniorEnrollment =
      existingSeniorEnrollment ??
      (await prisma.abacusEnrollment.create({
        data: {
          studentId: seniorStudent.id,
          courseId: seniorCourse.id,
          currentModuleId: seniorModules[0]?.id ?? null,
          currentLevelId: null,
          status: 'ONGOING',
          startDate: new Date(),
          notes: 'Senior track - weekend slot',
          orgUnitId: ce001.id,
        },
      }));
    enrollmentsData.push(seniorEnrollment);
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
      WHERE m."courseId" = ${enrollment.courseId}
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
    const demoEnrollmentIds = enrollmentsData.map((enrollment) => enrollment.id);
    if (demoEnrollmentIds.length > 0) {
      await prisma.moduleAttempt.deleteMany({ where: { enrollmentId: { in: demoEnrollmentIds } } });
      await prisma.worksheetAttempt.deleteMany({ where: { enrollmentId: { in: demoEnrollmentIds } } });
      await prisma.studentWorksheetAttempt.deleteMany({
        where: { enrollmentId: { in: demoEnrollmentIds } },
      });
    }

    const juniorFeeAmount = juniorCourse?.feeAmount ?? baseFeeAmount;
    const seniorFeeAmount = seniorCourse?.feeAmount ?? baseFeeAmount;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const demoLeads = [
      {
        firstName: 'Sanya',
        lastName: 'Malhotra',
        contactEmail: 'sanya@example.com',
        stage: 'NEW',
        source: 'CAMPAIGN',
        city: 'Delhi',
        nextFollowUpAt: tomorrow,
      },
      {
        firstName: 'Kabir',
        lastName: 'Singh',
        contactPhone: '+91-9915100011',
        stage: 'CONTACTED',
        source: 'REFERRAL',
        city: 'Jaipur',
        nextFollowUpAt: yesterday,
      },
      {
        firstName: 'Ishaan',
        lastName: 'Khurana',
        contactEmail: 'ishaan@parent.com',
        stage: 'TRIAL_DONE',
        source: 'WALK_IN',
        city: 'Chandigarh',
      },
      {
        firstName: 'Meera',
        lastName: 'Bedi',
        contactPhone: '+91-9815900099',
        stage: 'CONVERTED',
        source: 'WHATSAPP',
        city: 'Mumbai',
      },
      {
        firstName: 'Rhea',
        lastName: 'Kapoor',
        contactEmail: 'rhea@demo.com',
        stage: 'LOST',
        source: 'OTHER',
        city: 'Pune',
        lostReason: 'No response after demo',
      },
    ];
    const demoLeadsCreated: Array<{ id: number; stage: string }> = [];

    for (const lead of demoLeads) {
      const createdLead = await prisma.lead.create({
        data: {
          ...lead,
          orgUnitId: ce001.id,
          createdByUserId: bpUser.id,
          assignedToUserId: centerManager.id,
          lastStageChangedAt: new Date(),
          lastStageChangedBy: centerManager.id,
        },
      });
      demoLeadsCreated.push({ id: createdLead.id, stage: createdLead.stage });
    }
    console.log(`Seeded ${demoLeads.length} demo leads for CE001`);

    const feeRecords: any[] = [];
    for (const enrollment of enrollmentsData.slice(0, 2)) {
      const feeRecord = await prisma.studentFeeRecord.create({
        data: {
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          orgUnitId: ce001.id,
          amount: baseFeeAmount,
          status: 'PENDING',
        },
      });
      feeRecords.push(feeRecord);
    }

    if (feeRecords.length > 0) {
      await prisma.studentFeeRecord.update({
        where: { id: feeRecords[0].id },
        data: { status: 'PARTIAL', amount: Math.round(baseFeeAmount / 2) },
      });
      console.log('Marked first fee record as PARTIAL for quick demos');
    }

    await prisma.paymentTransaction.create({
      data: {
        orgUnitId: ce001.id,
        amount: Math.round(baseFeeAmount / 2),
        type: 'CREDIT',
        method: 'UPI',
        notes: 'Demo upfront payment',
      },
    });

    if (juniorEnrollment) {
      await prisma.studentFeeRecord.create({
        data: {
          studentId: juniorEnrollment.studentId,
          enrollmentId: juniorEnrollment.id,
          orgUnitId: ce001.id,
          amount: juniorFeeAmount,
          status: 'PAID',
        },
      });

      await prisma.paymentTransaction.create({
        data: {
          orgUnitId: ce001.id,
          amount: juniorFeeAmount,
          type: 'CREDIT',
          method: 'BANK',
          notes: 'Junior track full payment',
        },
      });
    }

    if (seniorEnrollment) {
      await prisma.studentFeeRecord.create({
        data: {
          studentId: seniorEnrollment.studentId,
          enrollmentId: seniorEnrollment.id,
          orgUnitId: ce001.id,
          amount: seniorFeeAmount,
          status: 'PENDING',
        },
      });
    }

    if (juniorEnrollment && juniorCourse) {
      const juniorWorksheet = await prisma.abacusWorksheet.findFirst({
        where: { level: { module: { courseId: juniorCourse.id } } },
        orderBy: { id: 'asc' },
      });
      if (juniorWorksheet) {
        await prisma.worksheetAttempt.upsert({
          where: {
            enrollmentId_worksheetId: {
              enrollmentId: juniorEnrollment.id,
              worksheetId: juniorWorksheet.id,
            },
          },
          update: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          create: {
            enrollmentId: juniorEnrollment.id,
            worksheetId: juniorWorksheet.id,
            status: 'COMPLETED',
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });
        await prisma.studentWorksheetAttempt.create({
          data: {
            studentId: juniorEnrollment.studentId,
            worksheetId: juniorWorksheet.id,
            enrollmentId: juniorEnrollment.id,
            status: 'COMPLETED',
            startedAt: new Date(),
            submittedAt: new Date(),
            totalScore: 18,
            maxScore: 20,
            autoGraded: true,
          },
        });
      }
      await prisma.moduleAttempt.upsert({
        where: {
          enrollmentId_courseCode_moduleIndex: {
            enrollmentId: juniorEnrollment.id,
            courseCode: juniorCourse.code,
            moduleIndex: 1,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
          score: 80,
          maxScore: 100,
        },
        create: {
          enrollmentId: juniorEnrollment.id,
          courseCode: juniorCourse.code,
          moduleIndex: 1,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          score: 80,
          maxScore: 100,
        },
      });
    }

    if (seniorEnrollment && seniorCourse) {
      const seniorWorksheet = await prisma.abacusWorksheet.findFirst({
        where: { level: { module: { courseId: seniorCourse.id } } },
        orderBy: { id: 'asc' },
      });
      if (seniorWorksheet) {
        await prisma.worksheetAttempt.upsert({
          where: {
            enrollmentId_worksheetId: {
              enrollmentId: seniorEnrollment.id,
              worksheetId: seniorWorksheet.id,
            },
          },
          update: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
          create: {
            enrollmentId: seniorEnrollment.id,
            worksheetId: seniorWorksheet.id,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });
        await prisma.studentWorksheetAttempt.create({
          data: {
            studentId: seniorEnrollment.studentId,
            worksheetId: seniorWorksheet.id,
            enrollmentId: seniorEnrollment.id,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            totalScore: 0,
            maxScore: 20,
            autoGraded: false,
          },
        });
      }
      await prisma.moduleAttempt.upsert({
        where: {
          enrollmentId_courseCode_moduleIndex: {
            enrollmentId: seniorEnrollment.id,
            courseCode: seniorCourse.code,
            moduleIndex: 2,
          },
        },
        update: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
        create: {
          enrollmentId: seniorEnrollment.id,
          courseCode: seniorCourse.code,
          moduleIndex: 2,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });
    }

    if (juniorEnrollment) {
      const latestJuniorAssessment = await prisma.abacusAssessment.findFirst({
        where: { enrollmentId: juniorEnrollment.id },
        orderBy: { attemptDate: 'desc' },
      });
      if (latestJuniorAssessment) {
        await prisma.abacusAssessment.update({
          where: { id: latestJuniorAssessment.id },
          data: { passed: true, scorePercent: 90 },
        });
      }
    }

    if (seniorEnrollment) {
      const latestSeniorAssessment = await prisma.abacusAssessment.findFirst({
        where: { enrollmentId: seniorEnrollment.id },
        orderBy: { attemptDate: 'desc' },
      });
      if (latestSeniorAssessment) {
        await prisma.abacusAssessment.update({
          where: { id: latestSeniorAssessment.id },
          data: { passed: false, scorePercent: 62 },
        });
      }
    }

    const ceLeadRule = commissionRuleByKey.get(`${ce001.id}:LEAD`);
    if (ceLeadRule && demoLeadsCreated.length > 0) {
      await prisma.commissionRecord.createMany({
        data: demoLeadsCreated.map((lead) => ({
          orgUnitId: ce001.id,
          ruleId: ceLeadRule.id,
          entityType: 'LEAD',
          entityId: lead.id,
          amount: ceLeadRule.amount,
          currency: ceLeadRule.currency,
          meta: { stage: lead.stage, createdByUserId: bpUser.id },
        })),
        skipDuplicates: true,
      });
    }

    const ceEnrollmentRule = commissionRuleByKey.get(`${ce001.id}:ENROLLMENT`);
    if (ceEnrollmentRule && enrollmentsData.length > 0) {
      await prisma.commissionRecord.createMany({
        data: enrollmentsData.map((enrollment) => {
          const courseMeta = courseById.get(enrollment.courseId);
          return {
            orgUnitId: ce001.id,
            ruleId: ceEnrollmentRule.id,
            entityType: 'ENROLLMENT',
            entityId: enrollment.id,
            courseId: enrollment.courseId,
            courseCode: courseMeta?.code ?? null,
            amount: ceEnrollmentRule.amount,
            currency: ceEnrollmentRule.currency,
            meta: { status: enrollment.status, createdByUserId: centerManager.id },
          };
        }),
        skipDuplicates: true,
      });
    }

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
