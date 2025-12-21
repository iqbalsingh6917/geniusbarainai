import { Router } from 'express';
import { z } from 'zod';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { listOrgUnitsForSuperadmin, createOrgUnitForSuperadmin, updateOrgUnitForSuperadmin } from '../services/orgUnitService';

const router = Router();

const orgUnitTypeEnum = z.enum(['SUPERADMIN_ROOT', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER']);
const orgUnitStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

const createOrgUnitSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: orgUnitTypeEnum,
  parentId: z.number().int().optional().nullable(),
  status: orgUnitStatusEnum,
});

const updateOrgUnitSchema = createOrgUnitSchema.partial();

router.get('/', authRequired, superadminOnly, async (req: AuthRequest, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : undefined;
    const parentId = req.query.parentId ? Number(req.query.parentId) : undefined;

    const result = await listOrgUnitsForSuperadmin({
      type: type as any,
      parentId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', authRequired, superadminOnly, async (req: AuthRequest, res, next) => {
  try {
    const payload = createOrgUnitSchema.parse(req.body);
    const orgUnit = await createOrgUnitForSuperadmin(payload);
    res.status(201).json(orgUnit);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid org unit payload.',
        errors: err.errors,
      });
    }
    return next(err);
  }
});

router.patch('/:id', authRequired, superadminOnly, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updateOrgUnitSchema.parse(req.body);

    const updated = await updateOrgUnitForSuperadmin(id, payload);
    res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid org unit payload.',
        errors: err.errors,
      });
    }
    return next(err);
  }
});

export default router;
