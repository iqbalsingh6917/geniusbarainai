import { Router } from 'express';
import { z } from 'zod';
import { allocateSeats } from '../modules/licensing/seatAllocation.service';
import { SeatAllocationError } from '../modules/licensing/seatAllocationErrors';
import { authRequired } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

const allocationSchema = z.object({
  parentOrgUnitId: z.number().int(),
  childOrgUnitId: z.number().int(),
  courseCode: z.string(),
  seats: z.number().int().positive(),
});

router.post(
  '/seat-allocations',
  authRequired,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER']),
  async (req, res, next) => {
    try {
      const payload = allocationSchema.parse(req.body);

      const allocation = await allocateSeats({
        ...payload,
        actorUserId: req.user?.id ?? null,
      });

      res.status(201).json(allocation);
    } catch (err: any) {
      if (err instanceof SeatAllocationError) {
        return res.status(400).json({
          error: err.code,
          meta: err.meta ?? null,
        });
      }
      next(err);
    }
  }
);

export default router;
