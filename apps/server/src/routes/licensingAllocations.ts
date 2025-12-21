import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { allocateSeatsToChild, getOrgCourseLicense, SeatAllocationError } from '../services/licensingService';

const router = Router();

// GET /superadmin/licensing/allocations
router.get('/superadmin/licensing/allocations', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { parentOrgUnitId, childOrgUnitId, courseCode } = req.query;
    const filters: any = {};

    if (parentOrgUnitId) {
      const parsed = Number(parentOrgUnitId);
      if (!Number.isNaN(parsed)) {
        filters.parentOrgUnitId = parsed;
      }
    }

    if (childOrgUnitId) {
      const parsed = Number(childOrgUnitId);
      if (!Number.isNaN(parsed)) {
        filters.childOrgUnitId = parsed;
      }
    }

    if (courseCode) {
      filters.courseCode = String(courseCode);
    }

    const allocations = await prisma.licenseAllocation.findMany({
      where: filters,
      include: {
        parentOrgUnit: true,
        childOrgUnit: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    ok(res, allocations);
  } catch (err) {
    console.error('Error fetching license allocations:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/licensing/allocations
router.post('/superadmin/licensing/allocations', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { parentOrgUnitId, childOrgUnitId, courseCode, allocatedSeats } = req.body || {};

    if (!parentOrgUnitId || !childOrgUnitId || !courseCode || allocatedSeats === undefined) {
      return fail(res, 400, 'VALIDATION_ERROR', 'parentOrgUnitId, childOrgUnitId, courseCode, allocatedSeats are required');
    }

    const parentIdNum = Number(parentOrgUnitId);
    const childIdNum = Number(childOrgUnitId);
    const allocatedSeatsNum = Number(allocatedSeats);

    if (Number.isNaN(parentIdNum) || Number.isNaN(childIdNum) || Number.isNaN(allocatedSeatsNum)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'parentOrgUnitId, childOrgUnitId, and allocatedSeats must be numbers');
    }

    if (allocatedSeatsNum <= 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'allocatedSeats must be greater than 0');
    }

    const result = await allocateSeatsToChild(parentIdNum, childIdNum, String(courseCode), allocatedSeatsNum);
    const childLicense = await getOrgCourseLicense(childIdNum, String(courseCode));

    ok(res, { allocation: result?.allocation ?? result, parentLicenseSummary: result?.parentLicenseSummary, childLicense }, 201);
  } catch (err: any) {
    if (err instanceof SeatAllocationError) {
      return fail(res, 400, err.code, err.message);
    }
    const code = err?.code;
    if (code === 'LICENSE_NOT_FOUND' || code === 'LICENSE_MISSING') {
      return fail(res, 400, 'LICENSE_MISSING', err.message || 'Parent has no license for this course');
    }
    if (code === 'INSUFFICIENT_SEATS') {
      return fail(res, 400, 'INSUFFICIENT_SEATS', err.message || 'Insufficient seats for allocation');
    }
    console.error('Error creating license allocation:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
