// @ts-nocheck
import prisma from '../prismaClient';

export interface LevelFilter {
  courseId: number;
  moduleId?: number;
}

export interface LevelInput {
  courseId: number;
  moduleId?: number | null;
  name: string;
  code: string;
  difficulty: string;
  ageGroup?: string | null;
  operations: string[];
  formulas: string[];
  examDurationMin: number;
  maxMarks?: number | null;
  passingPercent: number;
  isActive: boolean;
}

export async function listLevels(filter: LevelFilter) {
  return prisma.abacusLevel.findMany({
    where: {
      module: {
        courseId: filter.courseId,
        ...(filter.moduleId ? { id: filter.moduleId } : {}),
      },
    },
    orderBy: [{ moduleId: 'asc' }, { order: 'asc' }],
  });
}

export async function createLevel(input: LevelInput) {
  const module = await prisma.abacusModule.findUnique({
    where: { id: input.moduleId ?? undefined },
  });

  if (!module) {
    throw new Error('Module not found for provided moduleId');
  }

  if (module.courseId !== input.courseId) {
    throw new Error('Module does not belong to the provided course');
  }

  return prisma.abacusLevel.create({
    data: {
      order: 1,
      name: input.name,
      difficulty: input.difficulty,
      ageGroup: input.ageGroup ?? null,
      operations: input.operations,
      formulas: input.formulas,
      maxDigits: null,
      maxTerms: null,
      examDurationMin: input.examDurationMin,
      passingPercent: input.passingPercent,
      // @ts-ignore maxMarks added in schema
      maxMarks: input.maxMarks ?? null,
      // @ts-ignore isActive added in schema
      isActive: input.isActive,
      module: { connect: { id: module.id } },
    },
  });
}

export async function updateLevel(id: number, input: Partial<LevelInput>) {
  const existing = await prisma.abacusLevel.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Abacus level not found.');
  }

  let moduleId = existing.moduleId;
  if (typeof input.moduleId !== 'undefined' && input.moduleId !== null) {
    const module = await prisma.abacusModule.findUnique({ where: { id: input.moduleId } });
    if (!module) {
      throw new Error('Module not found for provided moduleId');
    }
    if (input.courseId && module.courseId !== input.courseId) {
      throw new Error('Module does not belong to the provided course');
    }
    moduleId = module.id;
  }

  return prisma.abacusLevel.update({
    where: { id },
    data: {
      module: moduleId ? { connect: { id: moduleId } } : undefined,
      name: input.name ?? existing.name,
      difficulty: input.difficulty ?? existing.difficulty,
      ageGroup: typeof input.ageGroup === 'undefined' ? existing.ageGroup : input.ageGroup,
      operations: input.operations ?? existing.operations,
      formulas: input.formulas ?? existing.formulas,
      examDurationMin: input.examDurationMin ?? existing.examDurationMin,
      passingPercent: input.passingPercent ?? existing.passingPercent,
      // @ts-ignore maxMarks added in schema
      maxMarks: typeof input.maxMarks === 'undefined' ? (existing as any).maxMarks : input.maxMarks,
      // @ts-ignore isActive added in schema
      isActive: typeof input.isActive === 'boolean' ? input.isActive : (existing as any).isActive,
    },
  });
}
// @ts-nocheck
