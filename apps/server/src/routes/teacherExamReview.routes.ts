import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

async function getTeacherScope(teacherUserId: number) {
  const assignments = await prisma.teacherStudentAssignment.findMany({
    where: { teacherUserId },
    select: { studentId: true, enrollmentId: true },
  });
  const studentIds = Array.from(new Set(assignments.map((a) => a.studentId).filter(Boolean)));
  const enrollmentIds = Array.from(new Set(assignments.map((a) => a.enrollmentId).filter((v): v is number => !!v)));
  return { studentIds, enrollmentIds };
}

async function teacherCanAccessAttempt(user: any, attempt: any) {
  if (!user) return false;
  const { role, orgUnitId, id: userId } = user;
  const allowedOrgUnits = await getAllowedOrgUnitsForUser(role, orgUnitId || null, user?.id ?? null);
  const scope = await getTeacherScope(userId);

  if (scope.enrollmentIds.includes(attempt.enrollmentId)) return true;
  if (scope.studentIds.includes(attempt.studentId)) return true;
  if (attempt.enrollment?.orgUnitId && allowedOrgUnits.includes(attempt.enrollment.orgUnitId)) return true;
  return false;
}

// GET /teacher/exams/attempts
router.get('/teacher/exams/attempts', requireAuth, requireRole(['TEACHER']), async (req, res, next) => {
  try {
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null, req.user!.id);
    const scope = await getTeacherScope(req.user!.id);

    const attempts = await prisma.examAttempt.findMany({
      where: {
        OR: [
          { enrollmentId: { in: scope.enrollmentIds } },
          { studentId: { in: scope.studentIds } },
          { enrollment: { orgUnitId: { in: allowedOrgUnits } } },
        ],
      },
      orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
      include: {
        exam: { select: { id: true, title: true, courseCode: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        enrollment: { select: { id: true, orgUnitId: true } },
      },
      take: 200,
    });

    ok(res, attempts);
  } catch (err) {
    next(err);
  }
});

// GET /teacher/exams/attempts/:id
router.get('/teacher/exams/attempts/:id', requireAuth, requireRole(['TEACHER']), async (req, res, next) => {
  try {
    const attemptId = Number(req.params.id);
    if (!attemptId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt ID');
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { select: { id: true, title: true, courseCode: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        enrollment: { select: { id: true, orgUnitId: true, courseId: true } },
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
    }

    const allowed = await teacherCanAccessAttempt(req.user, attempt);
    if (!allowed) {
      return fail(res, 403, 'ACCESS_DENIED', 'Not allowed to view this attempt');
    }

    ok(res, attempt);
  } catch (err) {
    next(err);
  }
});

// POST /teacher/exams/attempts/:id/override-score
router.post(
  '/teacher/exams/attempts/:id/override-score',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const attemptId = Number(req.params.id);
      if (!attemptId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt ID');
      }

      const body = z.object({ score: z.number() }).parse(req.body || {});

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { enrollment: { select: { orgUnitId: true } } },
      });
      if (!attempt) {
        return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
      }

      const allowed = await teacherCanAccessAttempt(req.user, attempt);
      if (!allowed) {
        return fail(res, 403, 'ACCESS_DENIED', 'Not allowed to update this attempt');
      }

      const updated = await prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          score: body.score,
        },
      });

      await logAudit(req, {
        action: 'EXAM_SCORE_OVERRIDDEN',
        entityType: 'ExamAttempt',
        entityId: attemptId.toString(),
        meta: { score: body.score },
      });

      ok(res, updated);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid score payload', err.errors);
      }
      next(err);
    }
  }
);

export default router;
