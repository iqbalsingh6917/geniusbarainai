import { prisma } from '@lms/db';
import { ExamAttemptStatus } from '@prisma/client';

export interface StartExamAttemptInput {
  enrollmentId: number;
  examId: number;
}

export interface CompleteExamAttemptInput {
  enrollmentId: number;
  examId: number;
  score?: number;
  maxScore?: number;
}

export interface GradeExamAttemptInput {
  enrollmentId: number;
  examId: number;
  score?: number;
  maxScore?: number;
  feedback?: string;
}

export async function startExamAttempt(input: StartExamAttemptInput) {
  const { enrollmentId, examId } = input;

  const enrollment = await prisma.abacusEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, studentId: true },
  });
  if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND');
  if (!enrollment.studentId) throw new Error('STUDENT_NOT_LINKED');

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
  });
  if (!exam) throw new Error('EXAM_NOT_FOUND');

  const now = new Date();

  const attempt = await prisma.examAttempt.upsert({
    where: {
      enrollmentId_examId: {
        enrollmentId,
        examId,
      },
    },
    update: {
      studentId: enrollment.studentId,
      status: ExamAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
    create: {
      enrollmentId,
      examId,
      studentId: enrollment.studentId,
      status: ExamAttemptStatus.IN_PROGRESS,
      startedAt: now,
    },
  });

  return attempt;
}

export async function completeExamAttempt(input: CompleteExamAttemptInput) {
  const { enrollmentId, examId, score, maxScore } = input;

  const attempt = await prisma.examAttempt.findUnique({
    where: {
      enrollmentId_examId: {
        enrollmentId,
        examId,
      },
    },
  });
  if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

  const now = new Date();

  const updated = await prisma.examAttempt.update({
    where: {
      enrollmentId_examId: {
        enrollmentId,
        examId,
      },
    },
    data: {
      status: ExamAttemptStatus.COMPLETED,
      submittedAt: now,
      score: score ?? attempt.score,
      maxScore: maxScore ?? attempt.maxScore,
    },
  });

  return updated;
}

export async function getExamAttemptsForEnrollment(enrollmentId: number) {
  return prisma.examAttempt.findMany({
    where: { enrollmentId },
    orderBy: [{ examId: 'asc' }],
    include: { exam: { select: { title: true } } },
  });
}

export async function getExamAttemptsForTeacher(enrollmentId: number) {
  return prisma.examAttempt.findMany({
    where: { enrollmentId },
    orderBy: [{ examId: 'asc' }],
    include: { exam: { select: { title: true } } },
  });
}

export async function gradeExamAttempt(input: GradeExamAttemptInput) {
  const { enrollmentId, examId, score, maxScore, feedback } = input;
  const attempt = await prisma.examAttempt.findUnique({
    where: {
      enrollmentId_examId: {
        enrollmentId,
        examId,
      },
    },
  });
  if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

  const now = new Date();

  return prisma.examAttempt.update({
    where: {
      enrollmentId_examId: {
        enrollmentId,
        examId,
      },
    },
    data: {
      status: ExamAttemptStatus.COMPLETED,
      submittedAt: attempt.submittedAt ?? now,
      score: score ?? attempt.score,
      maxScore: maxScore ?? attempt.maxScore,
      feedback: feedback ?? attempt.feedback,
      gradedAt: now,
    },
  });
}
