import { prisma } from '@lms/db';
import { ModuleAttemptStatus } from '@prisma/client';
import { updateCourseProgressForEnrollment } from '../enrollment/enrollmentProgress.service';

export interface StartModuleAttemptInput {
  enrollmentId: number;
  courseCode: string;
  moduleIndex: number;
}

export interface CompleteModuleAttemptInput {
  enrollmentId: number;
  courseCode: string;
  moduleIndex: number;
  score?: number;
  maxScore?: number;
}

export interface GradeModuleAttemptInput {
  enrollmentId: number;
  courseCode: string;
  moduleIndex: number;
  score: number;
  maxScore?: number;
}

export async function startModuleAttempt(input: StartModuleAttemptInput) {
  const { enrollmentId, courseCode, moduleIndex } = input;

  const enrollment = await prisma.abacusEnrollment.findUnique({
    where: { id: enrollmentId },
  });

  if (!enrollment) {
    throw new Error('ENROLLMENT_NOT_FOUND');
  }

  const existing = await prisma.moduleAttempt.findUnique({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
  });

  // If already in progress or completed, return as-is
  if (existing && existing.status !== ModuleAttemptStatus.NOT_STARTED) {
    return existing;
  }

  const now = new Date();

  const attempt = await prisma.moduleAttempt.upsert({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
    update: {
      status: ModuleAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
    create: {
      enrollmentId,
      courseCode,
      moduleIndex,
      status: ModuleAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
  });

  return attempt;
}

export async function completeModuleAttempt(input: CompleteModuleAttemptInput) {
  const { enrollmentId, courseCode, moduleIndex, score, maxScore } = input;

  const attempt = await prisma.moduleAttempt.findUnique({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
  });

  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const now = new Date();

  const updated = await prisma.moduleAttempt.update({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
    data: {
      status: ModuleAttemptStatus.COMPLETED,
      completedAt: now,
      score: score ?? attempt.score,
      maxScore: maxScore ?? attempt.maxScore,
    },
  });

  await updateCourseProgressForEnrollment(updated.enrollmentId);

  return updated;
}

export async function getModuleAttemptsForEnrollment(enrollmentId: number) {
  const attempts = await prisma.moduleAttempt.findMany({
    where: { enrollmentId },
    orderBy: [{ courseCode: 'asc' }, { moduleIndex: 'asc' }],
  });
  return attempts;
}

export async function gradeModuleAttempt(input: GradeModuleAttemptInput) {
  const { enrollmentId, courseCode, moduleIndex, score, maxScore } = input;
  const attempt = await prisma.moduleAttempt.findUnique({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
  });

  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  return prisma.moduleAttempt.update({
    where: {
      enrollmentId_courseCode_moduleIndex: {
        enrollmentId,
        courseCode,
        moduleIndex,
      },
    },
    data: {
      score,
      maxScore: maxScore ?? attempt.maxScore,
    },
  });
}
