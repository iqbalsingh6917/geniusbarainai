import { Router } from 'express';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get(
  '/dashboard/superadmin/course-summary',
  requireAuth,
    requireRole(['SUPERADMIN']),
  async (_req, res, next) => {
    try {
      // Group enrollments by courseId
      const totals = await prisma.abacusEnrollment.groupBy({
        by: ['courseId'],
        _count: { courseId: true },
      });

      const active = await prisma.abacusEnrollment.groupBy({
        by: ['courseId'],
        where: { status: 'ONGOING' },
        _count: { courseId: true },
      });

      const completed = await prisma.abacusEnrollment.groupBy({
        by: ['courseId'],
        where: { status: 'COMPLETED' },
        _count: { courseId: true },
      });

      const byCourse: Record<
        number,
        {
          courseId: number;
          totalEnrollments: number;
          activeEnrollments: number;
          completedEnrollments: number;
        }
      > = {};

      for (const t of totals) {
        byCourse[t.courseId] = {
          courseId: t.courseId,
          totalEnrollments: t._count.courseId || 0,
          activeEnrollments: 0,
          completedEnrollments: 0,
        };
      }

      for (const a of active) {
        if (!byCourse[a.courseId]) {
          byCourse[a.courseId] = {
            courseId: a.courseId,
            totalEnrollments: 0,
            activeEnrollments: 0,
            completedEnrollments: 0,
          };
        }
        byCourse[a.courseId].activeEnrollments = a._count.courseId || 0;
      }

      for (const c of completed) {
        if (!byCourse[c.courseId]) {
          byCourse[c.courseId] = {
            courseId: c.courseId,
            totalEnrollments: 0,
            activeEnrollments: 0,
            completedEnrollments: 0,
          };
        }
        byCourse[c.courseId].completedEnrollments = c._count.courseId || 0;
      }

      // Attempt to enrich with course titles if available
      const courseIds = Object.keys(byCourse).map((id) => Number(id));
      let courseMeta: Record<number, { code: string; name: string }> = {};
      if (courseIds.length) {
        try {
          const courses = await prisma.abacusCourse.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, code: true, name: true },
          });
          courseMeta = courses.reduce((acc, c) => {
            acc[c.id] = { code: c.code, name: c.name };
            return acc;
          }, {} as Record<number, { code: string; name: string }>);
        } catch {
          // If abacusCourse is missing, skip names
        }
      }

      const result = Object.values(byCourse).map((row) => {
        const completionRate =
          row.totalEnrollments > 0
            ? Math.round((row.completedEnrollments / row.totalEnrollments) * 100)
            : 0;
        const courseInfo = courseMeta[row.courseId];
        return {
          courseId: row.courseId,
          courseCode: courseInfo?.code,
          courseTitle: courseInfo?.name,
          totalEnrollments: row.totalEnrollments,
          activeEnrollments: row.activeEnrollments,
          completionRate,
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
