import prisma from '../prismaClient';

export interface ModuleCompletionResult {
  completed: boolean;
  moduleId?: number;
  courseId?: number;
  nextModuleId?: number | null;
}

export async function checkAndHandleModuleCompletion(
  studentId: number,
  worksheetId: number
): Promise<ModuleCompletionResult> {
  const worksheet = await prisma.abacusWorksheet.findUnique({
    where: { id: worksheetId },
    include: {
      level: {
        include: {
          module: true,
        },
      },
    },
  });

  if (!worksheet || !worksheet.level || !worksheet.level.module) {
    return { completed: false };
  }

  const moduleId = worksheet.level.moduleId;
  const courseId = worksheet.level.module.courseId;

  const totalWorksheets = await prisma.abacusWorksheet.count({
    where: { level: { moduleId } },
  });
  if (totalWorksheets === 0) {
    return { completed: false };
  }

  const submittedAttempts = await prisma.studentWorksheetAttempt.count({
    where: {
      studentId,
      worksheet: { level: { moduleId } },
      status: { in: ['SUBMITTED', 'GRADED'] },
    },
  });

  if (submittedAttempts < totalWorksheets) {
    return { completed: false };
  }

  const existing = await prisma.abacusModuleCompletion.findFirst({
    where: { studentId, moduleId },
  });
  if (!existing) {
    await prisma.abacusModuleCompletion.create({
      data: {
        studentId,
        moduleId,
      },
    });
  }

  const enrollment = await prisma.abacusEnrollment.findFirst({
    where: {
      studentId,
      courseId,
      status: 'ONGOING',
    },
    orderBy: { startDate: 'desc' },
  });

  let nextModuleId: number | null = null;
  if (enrollment) {
    const modules = await prisma.abacusModule.findMany({
      where: { courseId },
      orderBy: { index: 'asc' },
    });

    const currentIndex = modules.findIndex((m) => m.id === moduleId);
    const nextModule = currentIndex >= 0 ? modules[currentIndex + 1] : null;
    nextModuleId = nextModule ? nextModule.id : null;

    if (nextModule) {
      const firstLevel = await prisma.abacusLevel.findFirst({
        where: { moduleId: nextModule.id },
        orderBy: { order: 'asc' },
      });
      await prisma.abacusEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentModuleId: nextModule.id,
          currentLevelId: firstLevel?.id ?? null,
          updatedAt: new Date(),
        },
      });
    }
  }

  return { completed: true, moduleId, courseId, nextModuleId };
}
