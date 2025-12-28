import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
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

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
        return fail(res, 400, 'INVALID_STATE', 'Exam attempt is not in progress');
      }

      const questions = await prisma.examQuestion.findMany({
        where: { examId: attempt.examId },
        orderBy: { order: 'asc' },
        include: { options: true },
      });

      if (!questions.length) {
        return fail(res, 400, 'NO_QUESTIONS', 'Exam has no questions');
      }

      // Get answers from request body or from saved answers in DB
      const payloadAnswers = Array.isArray(req.body?.answers) ? req.body.answers : undefined;
      let answers;
      if (payloadAnswers && payloadAnswers.length > 0) {
        const payload = submitSchema.parse({ answers: payloadAnswers });
        answers = payload.answers;
      } else {
        // Load existing answers from DB
        const savedAnswers = await prisma.examAnswer.findMany({
          where: { attemptId },
        });

        if (!savedAnswers || savedAnswers.length === 0) {
          return fail(res, 400, 'NO_ANSWERS', 'No answers provided or found for this attempt');
        }
        
        answers = savedAnswers.map(a => ({
          questionId: a.questionId,
          numericAns: a.numericAns,
          optionIds: a.optionIds,
        }));
      }

      const byId = new Map(questions.map((q) => [q.id, q]));
      const invalidAnswers = answers.filter((ans) => !byId.has(ans.questionId));

      if (invalidAnswers.length > 0) {
        return fail(res, 400, 'INVALID_QUESTION_IDS', 'Some question IDs are not valid for this exam');
      }

      const epsilon = 1e-6;
      let score = 0;
      const maxScore = questions.length;

      // Replace existing answers then insert submitted
      await prisma.examAnswer.deleteMany({ where: { attemptId } });

      for (const ans of answers) {
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

// POST /student/exams/attempts/:attemptId/questions
// This endpoint saves answers to individual questions without submitting the exam
router.post(
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

      // Validate the request body using submitSchema
      const payload = submitSchema.parse(req.body);

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
        return fail(res, 400, 'INVALID_STATE', 'Exam attempt is not in progress');
      }

      const questions = await prisma.examQuestion.findMany({
        where: { examId: attempt.examId },
        select: { id: true, type: true },
      });

      if (!questions.length) {
        return fail(res, 400, 'NO_QUESTIONS', 'Exam has no questions');
      }

      const validQuestionIds = new Set(questions.map(q => q.id));
      const questionMap = new Map(questions.map(q => [q.id, q]));
      
      // Debug logging
      if (process.env.NODE_ENV === 'test') {
        console.log('Valid question IDs:', Array.from(validQuestionIds));
        console.log('Request answers:', payload.answers);
      }
      
      const invalidAnswers = payload.answers.filter(ans => !validQuestionIds.has(ans.questionId));

      if (invalidAnswers.length > 0) {
        if (process.env.NODE_ENV === 'test') {
          console.log('Invalid answers:', invalidAnswers);
        }
        return fail(res, 400, 'INVALID_QUESTION_IDS', 'Some question IDs are not valid for this exam');
      }

      // Check that all question IDs in the request exist in the exam
      for (const ans of payload.answers) {
        if (!validQuestionIds.has(ans.questionId)) {
          return fail(res, 400, 'INVALID_QUESTION_ID', `Question ID ${ans.questionId} not valid for this exam`);
        }
      }

      // Process answers: validate format based on question type and save to DB
      const questionIds = payload.answers.map((ans) => ans.questionId);
      await prisma.examAnswer.deleteMany({
        where: {
          attemptId,
          questionId: {
            in: questionIds,
          },
        },
      });

      for (const ans of payload.answers) {
        const question = questionMap.get(ans.questionId);
        
        // Validate answer format based on question type
        if (question?.type === 'NUMERIC') {
          // Numeric questions: must have numericAns, must not have optionIds
          if (ans.numericAns === undefined) {
            return fail(res, 400, 'INVALID_ANSWER_FORMAT', 'Numeric questions must have numericAns');
          }
          if (ans.optionIds !== undefined) {
            return fail(res, 400, 'INVALID_ANSWER_FORMAT', 'Numeric questions must not have optionIds');
          }
        } else if (question?.type === 'MCQ') {
          // MCQ questions: must have optionIds (non-empty), must not have numericAns
          if (!ans.optionIds || ans.optionIds.length === 0) {
            return fail(res, 400, 'INVALID_ANSWER_FORMAT', 'MCQ questions must have non-empty optionIds');
          }
          if (ans.numericAns !== undefined) {
            return fail(res, 400, 'INVALID_ANSWER_FORMAT', 'MCQ questions must not have numericAns');
          }
        }

        // Delete any existing answer for this question (using a more efficient upsert operation)
        //await prisma.examAnswer.deleteMany({
        //  where: { attemptId, questionId: ans.questionId },
        //});

        // Create new answer (simplified to single upsert operation)
        await prisma.examAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId: ans.questionId,
            },
          },
          create: {
            attemptId,
            questionId: ans.questionId,
            numericAns: ans.numericAns ?? null,
            optionIds: ans.optionIds ?? [],
          },
          update: {
            numericAns: ans.numericAns ?? null,
            optionIds: ans.optionIds ?? [],
          },
        });
      }

      ok(res, { attemptId, answeredCount: payload.answers.length });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'ZOD_VALIDATION_ERROR', 'Invalid answers payload', err.errors);
      }
      next(err);
    }
  }
);

export default router;
