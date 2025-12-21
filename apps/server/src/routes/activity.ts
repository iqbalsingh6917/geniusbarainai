import { Router, Response, NextFunction } from 'express';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok } from '../utils/apiResponse';

const router = Router();

// GET /api/superadmin/activity/summary
// Role: SUPERADMIN only
router.get(
  '/superadmin/activity/summary',
  authRequired,
  superadminOnly,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const enrollments = await prisma.abacusEnrollment.findMany({
        where: {
          startDate: { gte: since },
        },
        include: {
          student: true,
          course: true,
          currentModule: true,
          currentLevel: true,
          orgUnit: true,
        },
        orderBy: { startDate: 'desc' },
        take: 50,
      });

      const assessments = await prisma.abacusAssessment.findMany({
        where: {
          attemptDate: { gte: since },
        },
        include: {
          enrollment: {
            include: {
              student: true,
              course: true,
              orgUnit: true,
            },
          },
          level: true,
        },
        orderBy: { attemptDate: 'desc' },
        take: 50,
      });

      const attempts = await prisma.studentWorksheetAttempt.findMany({
        where: {
          submittedAt: { not: null, gte: since },
        },
        include: {
          student: {
            include: {
              orgUnit: true,
            },
          },
          worksheet: {
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
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 50,
      });

      const activity = [
        ...enrollments.map((e) => ({
          type: 'ENROLLMENT' as const,
          createdAt: e.startDate,
          orgUnitName: e.orgUnit?.name ?? null,
          orgUnitType: e.orgUnit?.type ?? null,
          courseCode: e.course?.code ?? null,
          courseName: e.course?.name ?? null,
          courseVariant: e.course?.variant ?? null,
          studentCode: e.student?.code ?? null,
          studentName: [e.student?.firstName, e.student?.lastName].filter(Boolean).join(' ').trim() || null,
          details: `New enrollment into ${e.course?.name ?? e.courseId}`,
        })),
        ...assessments.map((a) => ({
          type: 'ASSESSMENT' as const,
          createdAt: a.attemptDate,
          orgUnitName: a.enrollment?.orgUnit?.name ?? null,
          orgUnitType: a.enrollment?.orgUnit?.type ?? null,
          courseCode: a.enrollment?.course?.code ?? null,
          courseName: a.enrollment?.course?.name ?? null,
          courseVariant: a.enrollment?.course?.variant ?? null,
          studentCode: a.enrollment?.student?.code ?? null,
          studentName: [a.enrollment?.student?.firstName, a.enrollment?.student?.lastName].filter(Boolean).join(' ').trim() || null,
          details: `Assessment for ${a.level?.name ?? 'Level'}: ${a.scorePercent}% (${a.passed ? 'Passed' : 'Failed'})`,
        })),
        ...attempts.map((at) => ({
          type: 'WORKSHEET_ATTEMPT' as const,
          createdAt: at.submittedAt,
          orgUnitName: at.student?.orgUnit?.name ?? null,
          orgUnitType: at.student?.orgUnit?.type ?? null,
          courseCode: at.worksheet?.level?.module?.course?.code ?? null,
          courseName: at.worksheet?.level?.module?.course?.name ?? null,
          courseVariant: at.worksheet?.level?.module?.course?.variant ?? null,
          studentCode: at.student?.code ?? null,
          studentName: [at.student?.firstName, at.student?.lastName].filter(Boolean).join(' ').trim() || null,
          details: `Worksheet "${at.worksheet?.title ?? ''}" submitted`,
        })),
      ];

      activity.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));

      ok(res, activity);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
