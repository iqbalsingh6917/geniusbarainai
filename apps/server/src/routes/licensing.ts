import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';

const router = Router();

// GET /superadmin/licensing/summary
// Role: SUPERADMIN only
router.get('/superadmin/licensing/summary', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const licenses = await prisma.courseLicense.findMany({
      include: {
        orgUnit: true,
      },
    });

    const courseCodes = Array.from(new Set(licenses.map((l) => l.courseCode)));
    const courses = courseCodes.length
      ? await prisma.abacusCourse.findMany({
          where: { code: { in: courseCodes } },
        })
      : [];

    const courseByCode = new Map(courses.map((c) => [c.code, c]));

    const result = licenses.map((row) => {
      const course = courseByCode.get(row.courseCode);
      return {
        id: row.id,
        orgUnitId: row.orgUnitId,
        orgUnitName: row.orgUnit?.name ?? null,
        orgUnitType: row.orgUnit?.type ?? null,
        courseCode: row.courseCode,
        courseName: course?.name ?? null,
        courseVariant: course?.variant ?? null,
        totalSeats: row.totalSeats,
        usedSeats: row.usedSeats,
        validFrom: row.validFrom,
        validTo: row.validTo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    ok(res, result);
  } catch (error) {
    console.error('Error fetching licensing summary:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
