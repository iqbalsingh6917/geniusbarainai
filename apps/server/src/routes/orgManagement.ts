import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { isBusinessPartner, isCenterManager, isFranchise, isSuperadmin } from '../constants/roles';

const router = Router();
const prisma = new PrismaClient();

const canAccessScopedUnits = (role?: string) =>
  !!role && (isSuperadmin(role) || isBusinessPartner(role) || isFranchise(role) || isCenterManager(role));

// GET /api/org/units/scoped
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.get('/units/scoped', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessScopedUnits(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);
    if (allowedOrgUnits.length === 0) {
      await logAudit(req, {
        action: 'ORG_UNITS_SCOPED_VIEWED',
        entityType: 'OrgUnit',
        meta: { unitsCount: 0 },
      });
      return ok(res, []);
    }

    const orgUnits = await prisma.orgUnit.findMany({
      where: { id: { in: allowedOrgUnits } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    await logAudit(req, {
      action: 'ORG_UNITS_SCOPED_VIEWED',
      entityType: 'OrgUnit',
      meta: { unitsCount: orgUnits.length },
    });

    return ok(res, orgUnits);
  } catch (error) {
    console.error('Error fetching scoped org units:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

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
