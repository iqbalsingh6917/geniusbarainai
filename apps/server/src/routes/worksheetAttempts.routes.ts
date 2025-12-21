import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import {
  createOrGetAttemptForStudent,
  saveAnswers,
  submitAttempt,
} from '../services/worksheetEngineService';
import {
  startWorksheetAttempt,
  completeWorksheetAttempt,
  getWorksheetAttemptsForEnrollment,
  gradeWorksheetAttempt,
} from '../modules/learning/worksheetAttempt.service';

const router = Router();

// --------------------------
// Worksheet 2.0 student flow
// --------------------------

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        numericAns: z.number().optional(),
        textAns: z.string().optional(),
        optionIds: z.array(z.number().int().positive()).optional(),
        answerGiven: z.string().optional(),
      })
    )
    .min(1),
});

async function loadWorksheetWithCourse(worksheetId: number) {
  return prisma.abacusWorksheet.findUnique({
    where: { id: worksheetId },
    include: {
      level: {
        include: {
          module: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  });
}

function sanitizeQuestion(q: any) {
  return {
    id: q.id,
    orderIndex: q.orderIndex,
    questionType: q.questionType,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    maxMarks: q.maxMarks,
    options: (q.options || []).map((o: any) => ({
      id: o.id,
      text: o.text,
    })),
  };
}

// POST /student/worksheets/:worksheetId/start-attempt
router.post(
  '/student/worksheets/:worksheetId/start-attempt',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const worksheetId = Number(req.params.worksheetId);
      if (!worksheetId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid worksheet ID');
      }
      if (!req.user?.studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User is not linked to a student');
      }

      if (process.env.NODE_ENV === 'test') {
        console.log('worksheet start attempt user', req.user);
      }

      const worksheet = await loadWorksheetWithCourse(worksheetId);
      if (!worksheet || !worksheet.level?.module?.course) {
        return fail(res, 404, 'NOT_FOUND', 'Worksheet or course not found');
      }

      const enrollment = await prisma.abacusEnrollment.findFirst({
        where: { studentId: req.user.studentId, courseId: worksheet.level.module.course.id },
        orderBy: { startDate: 'desc' },
      });
      if (!enrollment) {
        if (process.env.NODE_ENV === 'test') {
          console.log('worksheet start enrollment not found', {
            studentId: req.user.studentId,
            courseId: worksheet.level.module.course.id,
          });
        }
        return fail(res, 403, 'ACCESS_DENIED', 'No enrollment for this course');
      }

      const { attempt, questions } = await createOrGetAttemptForStudent(
        req.user.studentId,
        worksheetId,
        null,
        enrollment.id
      );

      await logAudit(req, {
        action: 'WORKSHEET_ATTEMPT_STARTED',
        entityType: 'StudentWorksheetAttempt',
        entityId: attempt.id,
        meta: { worksheetId },
      });

      ok(
        res,
        {
          attempt,
          worksheet: {
            id: worksheet.id,
            title: worksheet.title,
            courseCode: worksheet.level.module.course.code,
            courseName: worksheet.level.module.course.name,
          },
          questions: questions.map(sanitizeQuestion),
        },
        201
      );
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', err.errors);
      }
      next(err);
    }
  }
);

// GET /student/worksheets/attempts/:attemptId/questions
router.get(
  '/student/worksheets/attempts/:attemptId/questions',
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

      const attempt = await prisma.studentWorksheetAttempt.findUnique({
        where: { id: attemptId },
        include: { worksheet: true },
      });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      const questions = await prisma.worksheetQuestion.findMany({
        where: { worksheetId: attempt.worksheetId },
        orderBy: { orderIndex: 'asc' },
        include: { options: true },
      });
      const answers = await prisma.studentWorksheetAnswer.findMany({
        where: { attemptId },
        select: { questionId: true, answerGiven: true, numericAns: true, textAns: true, optionIds: true },
      });

      ok(res, {
        attemptId,
        worksheetId: attempt.worksheetId,
        questions: questions.map(sanitizeQuestion),
        answers,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /student/worksheets/attempts/:attemptId/submit
router.post(
  '/student/worksheets/attempts/:attemptId/submit',
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

      const attempt = await prisma.studentWorksheetAttempt.findUnique({ where: { id: attemptId } });
      if (!attempt || attempt.studentId !== req.user.studentId) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      await saveAnswers(attemptId, payload.answers);
      const result = await submitAttempt(attemptId, req.user.studentId);

      await logAudit(req, {
        action: 'WORKSHEET_ATTEMPT_SUBMITTED',
        entityType: 'StudentWorksheetAttempt',
        entityId: attemptId,
        meta: {
          worksheetId: attempt.worksheetId,
          totalScore: result.totalScore,
          maxScore: result.maxScore,
        },
      });

      ok(res, {
        attempt: result.attempt,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        percentage: result.percentage,
        questions: result.questionSummaries,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid answers payload', err.errors);
      }
      next(err);
    }
  }
);

// --------------------------------------------------------------
// Legacy per-enrollment worksheet endpoints (kept for compatibility)
// --------------------------------------------------------------

const startSchema = z.object({
  enrollmentId: z.number().int().positive(),
  worksheetId: z.number().int().positive(),
});

const completeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  worksheetId: z.number().int().positive(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
});

const teacherGradeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  worksheetId: z.number().int().positive(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  feedback: z.string().optional(),
});

async function assertStudentOwnsEnrollment(req: any, enrollmentId: number) {
  const enrollment = await prisma.abacusEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) {
    const err: any = new Error('ENROLLMENT_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }

  const currentUser = req.user;
  if (!currentUser || currentUser.role !== 'STUDENT' || enrollment.studentId !== currentUser.studentId) {
    const err: any = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }
}

async function assertTeacherCanViewEnrollment(req: any, enrollmentId: number) {
  const enrollment = await prisma.abacusEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrollment) {
    const err: any = new Error('ENROLLMENT_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }

  const currentUser = req.user;
  if (
    !currentUser ||
    currentUser.role !== 'TEACHER' ||
    (currentUser.orgUnitId && enrollment.orgUnitId && currentUser.orgUnitId !== enrollment.orgUnitId)
  ) {
    const err: any = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }
}

// POST /api/learning/worksheet-attempts/start
router.post(
  '/learning/worksheet-attempts/start',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = startSchema.parse(req.body);
      await assertStudentOwnsEnrollment(req, body.enrollmentId);
      const attempt = await startWorksheetAttempt(body);
      res.status(201).json(attempt);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

// POST /api/learning/worksheet-attempts/complete
router.post(
  '/learning/worksheet-attempts/complete',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = completeSchema.parse(req.body);
      await assertStudentOwnsEnrollment(req, body.enrollmentId);
      const attempt = await completeWorksheetAttempt(body);
      res.status(200).json(attempt);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      if (err.message === 'ATTEMPT_NOT_FOUND') {
        return res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      }
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

// GET /api/learning/worksheet-attempts/by-enrollment/:enrollmentId
router.get(
  '/learning/worksheet-attempts/by-enrollment/:enrollmentId',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }

      await assertStudentOwnsEnrollment(req, enrollmentId);
      const items = await getWorksheetAttemptsForEnrollment(enrollmentId);
      res.json({ items });
    } catch (err: any) {
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

// POST /api/learning/worksheet-attempts/grade
router.post(
  '/learning/worksheet-attempts/grade',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const body = teacherGradeSchema.parse(req.body);
      await assertTeacherCanViewEnrollment(req, body.enrollmentId);
      const attempt = await gradeWorksheetAttempt(body);
      res.status(200).json(attempt);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      if (err.message === 'ATTEMPT_NOT_FOUND') {
        return res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      }
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

// GET /api/learning/worksheet-attempts/for-teacher/:enrollmentId
router.get(
  '/learning/worksheet-attempts/for-teacher/:enrollmentId',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }
      await assertTeacherCanViewEnrollment(req, enrollmentId);
      const items = await getWorksheetAttemptsForEnrollment(enrollmentId);
      res.json({ items });
    } catch (err: any) {
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

export default router;
