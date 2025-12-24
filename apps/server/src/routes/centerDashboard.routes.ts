import { Router } from 'express';
import { prisma } from '@lms/db';
import { ModuleAttemptStatus, WorksheetAttemptStatus, ExamAttemptStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// GET /api/dashboard/center/overview
router.get(
  '/dashboard/center/overview',
  requireAuth,
  requireRole(['CENTER_MANAGER', 'COORDINATOR', 'HEAD_COORDINATOR']),
  async (req, res, next) => {
    try {
      const currentUser = (req as any).user;
      const centerOrgUnitId = currentUser?.orgUnitId;

      if (!centerOrgUnitId) {
        return res.status(400).json({ error: 'CENTER_ORG_UNIT_MISSING' });
      }

      const enrollments = await prisma.abacusEnrollment.findMany({
        where: { orgUnitId: centerOrgUnitId },
        include: {
          student: { select: { firstName: true, lastName: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      });

      const enrollmentIds = enrollments.map((e) => e.id);
      if (!enrollmentIds.length) {
        return res.json({ students: [] });
      }

      const courseIds = enrollments.map((e) => e.courseId);

      const [moduleTotals, moduleCompleted, worksheetCompleted, examCompleted] = await Promise.all([
        prisma.abacusModule.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIds } },
          _count: { courseId: true },
        }),
        prisma.moduleAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: enrollmentIds },
            status: ModuleAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
        prisma.worksheetAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: enrollmentIds },
            status: WorksheetAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
        prisma.examAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: enrollmentIds },
            status: ExamAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
      ]);

      const moduleTotalsMap = new Map<number, number>(
        moduleTotals.map((m) => [m.courseId, m._count.courseId || 0])
      );
      const moduleCompletedMap = new Map<number, number>(
        moduleCompleted.map((m) => [m.enrollmentId, m._count.enrollmentId || 0])
      );
      const worksheetCompletedMap = new Map<number, number>(
        worksheetCompleted.map((w) => [w.enrollmentId, w._count.enrollmentId || 0])
      );
      const examCompletedMap = new Map<number, number>(
        examCompleted.map((e) => [e.enrollmentId, e._count.enrollmentId || 0])
      );

      const students = enrollments.map((enrollment) => {
        const completedModules = moduleCompletedMap.get(enrollment.id) || 0;
        const totalModules = moduleTotalsMap.get(enrollment.courseId) || 0;
        const progressPercent =
          totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

        const studentName = [enrollment.student?.firstName, enrollment.student?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();

        return {
          enrollmentId: enrollment.id,
          studentName: studentName || 'Unknown',
          courseTitle: enrollment.course?.name || enrollment.course?.code || 'Unknown course',
          courseCode: enrollment.course?.code || '',
          progressPercent,
          completedModules,
          completedWorksheets: worksheetCompletedMap.get(enrollment.id) || 0,
          completedExams: examCompletedMap.get(enrollment.id) || 0,
        };
      });

      res.json({ students });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
