import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/org/units
// Role: SUPERADMIN only
router.get('/units', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get all org units
    const orgUnits: any = await prisma.$queryRaw`
      SELECT "id", "code", "name", "type", "parentId"
      FROM "OrgUnit"
      ORDER BY "type", "code"
    `;

    // Log audit
    await logAudit(req, {
      action: 'ORG_UNITS_LIST_VIEWED',
      entityType: 'OrgUnit',
      meta: { unitsCount: orgUnits.length }
    });

    ok(res, orgUnits);
  } catch (error) {
    console.error('Error fetching org units:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/org/units/:id/assign-manager
// Role: SUPERADMIN only (placeholder to enforce permission)
router.post('/units/:id/assign-manager', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const orgUnitId = Number(req.params.id);
    const { managerUserId } = req.body ?? {};
    if (!orgUnitId || Number.isNaN(orgUnitId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid org unit id');
    }
    if (!managerUserId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'managerUserId is required');
    }

    // No schema field to persist; acknowledge with audit for demo hardening
    await logAudit(req, {
      action: 'ORG_UNIT_MANAGER_ASSIGNED',
      entityType: 'OrgUnit',
      entityId: orgUnitId,
      meta: { managerUserId },
    });

    return ok(res, { orgUnitId, managerUserId, status: 'ACKNOWLEDGED' });
  } catch (error) {
    console.error('Error assigning manager:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
