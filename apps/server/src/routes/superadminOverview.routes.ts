import { Router } from 'express';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get(
  '/superadmin/overview',
  requireAuth,
  requireRole(['SUPERADMIN']),
  async (_req, res, next) => {
    try {
      const now = new Date();

      const [totalStudents, totalEnrollments, totalOrgUnits, revenueAgg, duesAgg, activeLicenses] =
        await Promise.all([
          prisma.student.count(),
          prisma.abacusEnrollment.count(),
          prisma.orgUnit.count(),
          prisma.paymentTransaction.aggregate({
            _sum: { amount: true },
          }),
          prisma.studentFeeRecord.aggregate({
            where: { status: 'PENDING' },
            _sum: { amount: true },
          }),
          prisma.courseLicense.count({
            where: {
              AND: [
                { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                { OR: [{ validTo: null }, { validTo: { gte: now } }] },
              ],
            },
          }),
        ]);

      const totalRevenue = revenueAgg._sum.amount ? Number(revenueAgg._sum.amount) : 0;
      const outstandingDues = duesAgg._sum.amount ? Number(duesAgg._sum.amount) : 0;

      res.json({
        totalStudents,
        totalEnrollments,
        totalRevenue,
        activeLicenses,
        totalOrgUnits,
        outstandingDues,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
