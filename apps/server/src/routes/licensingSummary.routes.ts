import { Router, Response } from 'express';
import { prisma } from '@lms/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get(
  '/summary',
  requireAuth,
  requireRole(['SUPERADMIN']),
  async (_req: AuthRequest, res: Response, next) => {
    try {
      const now = new Date();

      const [licenses, allocationAgg] = await Promise.all([
        prisma.courseLicense.findMany({
          include: {
            orgUnit: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        }),
        prisma.licenseAllocation.groupBy({
          by: ['parentOrgUnitId', 'courseCode'],
          _sum: { allocatedSeats: true },
        }),
      ]);

      const allocationMap = new Map<string, number>();
      allocationAgg.forEach((row) => {
        const key = `${row.parentOrgUnitId}-${row.courseCode}`;
        allocationMap.set(key, row._sum.allocatedSeats ?? 0);
      });

      const payload = licenses.map((license: (typeof licenses)[number]) => {
        const key = `${license.orgUnitId}-${license.courseCode}`;
        const allocatedSeats = allocationMap.get(key) ?? 0;
        const remainingSeats = Math.max(license.totalSeats - allocatedSeats, 0);
        const isActive =
          (!license.validFrom || license.validFrom <= now) &&
          (!license.validTo || license.validTo >= now);

        return {
          licenseId: license.id,
          parentOrgUnitId: license.orgUnitId,
          parentOrgUnitName: license.orgUnit?.name ?? '',
          parentOrgUnitType: license.orgUnit?.type ?? '',
          courseCode: license.courseCode,
          totalSeats: license.totalSeats,
          allocatedSeats,
          remainingSeats,
          isActive,
          validFrom: license.validFrom,
          validTo: license.validTo,
        };
      });

      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
