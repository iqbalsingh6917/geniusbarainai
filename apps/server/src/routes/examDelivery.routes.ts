import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { ok, fail } from '../utils/apiResponse';
import { ExamAttemptStatus } from '@prisma/client';
import { logAudit } from '../services/auditService';

const router = Router();

const startAttemptSchema = z.object({});

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        numericAns: z.number().optional(),
        optionIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .min(1),
});

// POST /student/exams/:examId/start-attempt
router.post(
  '/student/exams/:examId/start-attempt',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const examId = Number(req.params.examId);
      if (!examId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid exam ID');
      }
      if (!req.user?.studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User is not linked to a student');
      }

      if (process.env.NODE_ENV === 'test') {
        console.log('exam start attempt user', req.user);
      }

      startAttemptSchema.parse(req.body || {});

      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) {
        return fail(res, 404, 'NOT_FOUND', 'Exam not found');
      }

      const course = await prisma.abacusCourse.findUnique({
        where: { code: exam.courseCode },
      });
      if (!course) {
        return fail(res, 404, 'NOT_FOUND', 'Course not found for this exam');
      }

      const enrollment = await prisma.abacusEnrollment.findFirst({
        where: {
          studentId: req.user.studentId,
          courseId: course.id,
        },
        orderBy: { startDate: 'desc' },
      });
      if (!enrollment) {
        if (process.env.NODE_ENV === 'test') {
          console.log('exam start enrollment not found for', { studentId: req.user.studentId, courseId: course.id });
        }
        return fail(res, 403, 'ACCESS_DENIED', 'No enrollment for this course');
      }

      const now = new Date();

      const attempt = await prisma.examAttempt.upsert({
        where: {
          enrollmentId_examId: {
            enrollmentId: enrollment.id,
            examId,
          },
        },
        update: {
          studentId: req.user.studentId,
          status: ExamAttemptStatus.IN_PROGRESS,
          startedAt: now,
        },
        create: {
          examId,
          enrollmentId: enrollment.id,
          studentId: req.user.studentId,
          status: ExamAttemptStatus.IN_PROGRESS,
          startedAt: now,
        },
        select: { id: true },
      });

      await logAudit(req, {
        action: 'EXAM_ATTEMPT_STARTED',
        entityType: 'ExamAttempt',
        entityId: attempt.id.toString(),
        meta: { examId },
      });

      ok(res, attempt, 201);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', err.errors);
      }
      next(err);
    }
  }
);

// GET /student/exams/attempts/:attemptId/questions
router.get(
  '/student/exams/attempts/:attemptId/questions',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!attemptId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt ID');
      }
      if (!req.user?.studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User is not linked to a student');
      }

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { exam: true },
      });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      const questions = await prisma.examQuestion.findMany({
        where: { examId: attempt.examId },
        orderBy: { order: 'asc' },
        include: { options: true },
      });

      const sanitized = questions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
        })),
      }));

      ok(res, { attemptId: attempt.id, examId: attempt.examId, questions: sanitized });
    } catch (err) {
      next(err);
    }
  }
);

// POST /student/exams/attempts/:attemptId/submit
router.post(
  '/student/exams/attempts/:attemptId/submit',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!attemptId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt ID');
      }
      if (!req.user?.studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User is not linked to a student');
      }

      const payload = submitSchema.parse(req.body || {});

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      const questions = await prisma.examQuestion.findMany({
        where: { examId: attempt.examId },
        orderBy: { order: 'asc' },
        include: { options: true },
      });

      if (!questions.length) {
        return fail(res, 400, 'NO_QUESTIONS', 'Exam has no questions');
      }

      const byId = new Map(questions.map((q) => [q.id, q]));

      const epsilon = 1e-6;
      let score = 0;
      const maxScore = questions.length;

      // Replace existing answers then insert submitted
      await prisma.examAnswer.deleteMany({ where: { attemptId } });

      for (const ans of payload.answers) {
        const question = byId.get(ans.questionId);
        if (!question) continue;

        if (question.type === 'NUMERIC') {
          const isCorrect =
            typeof ans.numericAns === 'number' &&
            question.correctNum !== null &&
            question.correctNum !== undefined &&
            Math.abs(ans.numericAns - question.correctNum) < epsilon;
          if (isCorrect) score += 1;
          await prisma.examAnswer.create({
            data: {
              attemptId,
              questionId: question.id,
              numericAns: typeof ans.numericAns === 'number' ? ans.numericAns : null,
              optionIds: [],
            },
          });
        } else {
          const correctOptions = question.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
          const selected = (ans.optionIds ?? []).slice().sort();
          const isCorrect =
            correctOptions.length === selected.length &&
            correctOptions.every((val, idx) => val === selected[idx]);
          if (isCorrect) score += 1;
          await prisma.examAnswer.create({
            data: {
              attemptId,
              questionId: question.id,
              numericAns: null,
              optionIds: selected,
            },
          });
        }
      }

      const submittedAt = new Date();

      await prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: ExamAttemptStatus.COMPLETED,
          submittedAt,
          score,
          maxScore,
        },
      });

      await logAudit(req, {
        action: 'EXAM_ATTEMPT_SUBMITTED',
        entityType: 'ExamAttempt',
        entityId: attemptId.toString(),
        meta: { examId: attempt.examId, score, maxScore },
      });

      ok(res, {
        attemptId,
        examId: attempt.examId,
        score,
        maxScore,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : null,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid answers payload', err.errors);
      }
      next(err);
    }
  }
);

export default router;
