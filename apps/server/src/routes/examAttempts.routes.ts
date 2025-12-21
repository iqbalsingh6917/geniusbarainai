import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import {
  startExamAttempt,
  completeExamAttempt,
  getExamAttemptsForEnrollment,
  gradeExamAttempt,
} from '../modules/learning/examAttempt.service';

const router = Router();

const startSchema = z.object({
  enrollmentId: z.number().int().positive(),
  examId: z.number().int().positive(),
});

const completeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  examId: z.number().int().positive(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
});

const teacherExamGradeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  examId: z.number().int().positive(),
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

// POST /api/learning/exam-attempts/start
router.post(
  '/learning/exam-attempts/start',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = startSchema.parse(req.body);
      await assertStudentOwnsEnrollment(req, body.enrollmentId);
      const attempt = await startExamAttempt(body);
      res.status(201).json(attempt);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.message === 'EXAM_NOT_FOUND') {
        return res.status(404).json({ error: 'EXAM_NOT_FOUND' });
      }
      if (err.message === 'FORBIDDEN' || err.statusCode === 403) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      next(err);
    }
  }
);

// POST /api/learning/exam-attempts/complete
router.post(
  '/learning/exam-attempts/complete',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = completeSchema.parse(req.body);
      await assertStudentOwnsEnrollment(req, body.enrollmentId);
      const attempt = await completeExamAttempt(body);
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

// GET /api/learning/exam-attempts/by-enrollment/:enrollmentId
router.get(
  '/learning/exam-attempts/by-enrollment/:enrollmentId',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }

      await assertStudentOwnsEnrollment(req, enrollmentId);
      const items = await getExamAttemptsForEnrollment(enrollmentId);
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

// POST /api/learning/exam-attempts/grade
router.post(
  '/learning/exam-attempts/grade',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const body = teacherExamGradeSchema.parse(req.body);
      await assertTeacherCanViewEnrollment(req, body.enrollmentId);
      const attempt = await gradeExamAttempt(body);
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
      if (err.message === 'EXAM_NOT_FOUND') {
        return res.status(404).json({ error: 'EXAM_NOT_FOUND' });
      }
      next(err);
    }
  }
);

// GET /api/learning/exam-attempts/for-teacher/:enrollmentId
router.get(
  '/learning/exam-attempts/for-teacher/:enrollmentId',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }
      await assertTeacherCanViewEnrollment(req, enrollmentId);
      const items = await getExamAttemptsForEnrollment(enrollmentId);
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
