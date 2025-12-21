import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/superadmin/commercial/history', authRequired, superadminOnly, async (_req: AuthRequest, res: Response, next) => {
  try {
    // Fetch orders
    const ordersRaw = await prisma.licenseOrder.findMany({
      include: { buyerOrgUnit: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const orders = ordersRaw.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      buyerOrgUnitId: o.buyerOrgUnitId,
      buyerOrgName: (o as any).buyerOrgUnit?.name ?? null,
      buyerOrgType: (o as any).buyerOrgUnit?.type ?? null,
      courseCode: o.courseCode,
      seatQuantity: o.seatQuantity,
      unitPrice: o.unitPrice,
      totalPrice: o.totalPrice,
      currency: o.currency,
      status: o.status,
    }));

    // Fetch allocations
    const allocationsRaw = await prisma.licenseAllocation.findMany({
      include: {
        parentOrgUnit: true,
        childOrgUnit: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const allocations = allocationsRaw.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      parentOrgUnitId: a.parentOrgUnitId,
      parentOrgName: (a as any).parentOrgUnit?.name ?? null,
      parentOrgType: (a as any).parentOrgUnit?.type ?? null,
      childOrgUnitId: a.childOrgUnitId,
      childOrgName: (a as any).childOrgUnit?.name ?? null,
      childOrgType: (a as any).childOrgUnit?.type ?? null,
      courseCode: a.courseCode,
      allocatedSeats: a.allocatedSeats,
    }));

    // Fetch licenses with org info and course lookup
    const [licensesRaw, courses] = await Promise.all([
      prisma.courseLicense.findMany({
        include: { orgUnit: true },
        orderBy: [{ orgUnitId: 'asc' }, { courseCode: 'asc' }],
      }),
      prisma.abacusCourse.findMany(),
    ]);

    const courseMap = new Map<string, { name: string | null; variant: string | null }>();
    courses.forEach((c) => {
      courseMap.set(c.code, { name: c.name, variant: c.variant ?? null });
    });

    const licenses = licensesRaw.map((l) => {
      const courseMeta = courseMap.get(l.courseCode);
      const remaining = (l.totalSeats || 0) - (l.usedSeats || 0);
      return {
        id: l.id,
        orgUnitId: l.orgUnitId,
        orgUnitName: (l as any).orgUnit?.name ?? null,
        orgUnitType: (l as any).orgUnit?.type ?? null,
        courseCode: l.courseCode,
        courseName: courseMeta?.name ?? null,
        variant: courseMeta?.variant ?? null,
        totalSeats: l.totalSeats,
        usedSeats: l.usedSeats,
        remaining,
      };
    });

    res.json({
      success: true,
      data: {
        orders,
        allocations,
        licenses,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
