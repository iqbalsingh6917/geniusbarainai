import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { startModuleAttempt, completeModuleAttempt, getModuleAttemptsForEnrollment, gradeModuleAttempt } from '../modules/learning/moduleAttempt.service';
import { prisma } from '@lms/db';

const router = Router();

const startSchema = z.object({
  enrollmentId: z.number().int().positive(),
  courseCode: z.string().min(1),
  moduleIndex: z.number().int().nonnegative(),
});

const completeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  courseCode: z.string().min(1),
  moduleIndex: z.number().int().nonnegative(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
});

const gradeSchema = z.object({
  enrollmentId: z.number().int().positive(),
  courseCode: z.string().min(1),
  moduleIndex: z.number().int().nonnegative(),
  score: z.number(),
  maxScore: z.number().optional(),
});

router.post(
  '/learning/module-attempts/start',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = startSchema.parse(req.body);
      const enrollment = await prisma.abacusEnrollment.findUnique({
        where: { id: body.enrollmentId },
      });
      if (!enrollment) {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (!req.user || req.user.role !== 'STUDENT' || enrollment.studentId !== req.user.studentId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      const attempt = await startModuleAttempt(body);
      res.status(201).json(attempt);
    } catch (err: any) {
      if (err.message === 'ENROLLMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      next(err);
    }
  }
);

router.post(
  '/learning/module-attempts/complete',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const body = completeSchema.parse(req.body);
      const enrollment = await prisma.abacusEnrollment.findUnique({
        where: { id: body.enrollmentId },
      });
      if (!enrollment) {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      if (!req.user || req.user.role !== 'STUDENT' || enrollment.studentId !== req.user.studentId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      const attempt = await completeModuleAttempt(body);
      res.status(200).json(attempt);
    } catch (err: any) {
      if (err.message === 'ATTEMPT_NOT_FOUND') {
        return res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      }
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      next(err);
    }
  }
);

// GET /api/learning/module-attempts/by-enrollment/:enrollmentId
router.get(
  '/learning/module-attempts/by-enrollment/:enrollmentId',
  requireAuth,
  requireRole(['STUDENT']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }

      const enrollment = await prisma.abacusEnrollment.findUnique({
        where: { id: enrollmentId },
      });
      if (!enrollment) {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }

      if (!req.user || req.user.role !== 'STUDENT' || enrollment.studentId !== req.user.studentId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const attempts = await getModuleAttemptsForEnrollment(enrollmentId);
      res.json({ items: attempts });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/learning/module-attempts/grade
router.post(
  '/learning/module-attempts/grade',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const body = gradeSchema.parse(req.body);

      const enrollment = await prisma.abacusEnrollment.findUnique({
        where: { id: body.enrollmentId },
      });
      if (!enrollment) {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }
      const currentUser = (req as any).user;
      if (
        !currentUser ||
        currentUser.role !== 'TEACHER' ||
        (currentUser.orgUnitId && enrollment.orgUnitId && currentUser.orgUnitId !== enrollment.orgUnitId)
      ) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const attempt = await gradeModuleAttempt(body);
      res.json(attempt);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'INVALID_INPUT', details: err.errors });
      }
      if (err.message === 'ATTEMPT_NOT_FOUND') {
        return res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      }
      next(err);
    }
  }
);

// GET /api/learning/module-attempts/for-teacher/:enrollmentId
router.get(
  '/learning/module-attempts/for-teacher/:enrollmentId',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'INVALID_ENROLLMENT_ID' });
      }

      const enrollment = await prisma.abacusEnrollment.findUnique({
        where: { id: enrollmentId },
      });
      if (!enrollment) {
        return res.status(404).json({ error: 'ENROLLMENT_NOT_FOUND' });
      }

      const currentUser = (req as any).user;
      if (
        !currentUser ||
        currentUser.role !== 'TEACHER' ||
        (currentUser.orgUnitId && enrollment.orgUnitId && currentUser.orgUnitId !== enrollment.orgUnitId)
      ) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const attempts = await getModuleAttemptsForEnrollment(enrollmentId);
      res.json({ items: attempts });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
