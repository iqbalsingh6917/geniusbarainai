import { prisma } from '@lms/db';
import { WorksheetAttemptStatus } from '@prisma/client';

export interface StartWorksheetAttemptInput {
  enrollmentId: number;
  worksheetId: number;
}

export interface CompleteWorksheetAttemptInput {
  enrollmentId: number;
  worksheetId: number;
  score?: number;
  maxScore?: number;
}

export interface GradeWorksheetAttemptInput {
  enrollmentId: number;
  worksheetId: number;
  score?: number;
  maxScore?: number;
  feedback?: string;
}

export async function startWorksheetAttempt(input: StartWorksheetAttemptInput) {
  const { enrollmentId, worksheetId } = input;

  const enrollment = await prisma.abacusEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND');

  const now = new Date();

  const attempt = await prisma.worksheetAttempt.upsert({
    where: {
      enrollmentId_worksheetId: {
        enrollmentId,
        worksheetId,
      },
    },
    update: {
      status: WorksheetAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
    create: {
      enrollmentId,
      worksheetId,
      status: WorksheetAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
  });

  return attempt;
}

export async function completeWorksheetAttempt(input: CompleteWorksheetAttemptInput) {
  const { enrollmentId, worksheetId, score, maxScore } = input;

  const attempt = await prisma.worksheetAttempt.findUnique({
    where: {
      enrollmentId_worksheetId: {
        enrollmentId,
        worksheetId,
      },
    },
  });
  if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

  const now = new Date();

  const updated = await prisma.worksheetAttempt.update({
    where: {
      enrollmentId_worksheetId: {
        enrollmentId,
        worksheetId,
      },
    },
    data: {
      status: WorksheetAttemptStatus.COMPLETED,
      completedAt: now,
      score: score ?? attempt.score,
      maxScore: maxScore ?? attempt.maxScore,
    },
  });

  return updated;
}

export async function getWorksheetAttemptsForEnrollment(enrollmentId: number) {
  return prisma.worksheetAttempt.findMany({
    where: { enrollmentId },
    orderBy: [{ worksheetId: 'asc' }],
    include: { worksheet: { select: { title: true } } },
  });
}

export async function getWorksheetAttemptsForTeacher(enrollmentId: number) {
  return prisma.worksheetAttempt.findMany({
    where: { enrollmentId },
    orderBy: [{ worksheetId: 'asc' }],
    include: { worksheet: { select: { title: true } } },
  });
}

export async function gradeWorksheetAttempt(input: GradeWorksheetAttemptInput) {
  const { enrollmentId, worksheetId, score, maxScore, feedback } = input;
  const attempt = await prisma.worksheetAttempt.findUnique({
    where: {
      enrollmentId_worksheetId: { enrollmentId, worksheetId },
    },
  });
  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const now = new Date();

  return prisma.worksheetAttempt.update({
    where: {
      enrollmentId_worksheetId: { enrollmentId, worksheetId },
    },
    data: {
      status: WorksheetAttemptStatus.COMPLETED,
      completedAt: attempt.completedAt ?? now,
      score: score ?? attempt.score,
      maxScore: maxScore ?? attempt.maxScore,
      feedback: feedback ?? attempt.feedback,
      gradedAt: now,
    },
  });
}
