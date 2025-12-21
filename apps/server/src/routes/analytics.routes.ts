import { Router } from 'express';
import { z } from 'zod';
import { getLeadFunnelForBusinessPartner } from '../modules/analytics/leadAnalytics.service';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

const leadAnalyticsQuerySchema = z.object({
  bpOrgUnitId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .refine((v) => !Number.isNaN(v), 'bpOrgUnitId must be a number')
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get(
  '/sales/bp-funnel',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = leadAnalyticsQuerySchema.parse(req.query);

      const bpOrgUnitId = parsed.bpOrgUnitId ?? req.user?.orgUnitId ?? null;
      if (!bpOrgUnitId) {
        return res.status(400).json({ error: 'Business Partner orgUnitId is required' });
      }

      const from = parsed.from ? new Date(parsed.from) : undefined;
      const to = parsed.to ? new Date(parsed.to) : undefined;

      const result = await getLeadFunnelForBusinessPartner({
        bpOrgUnitId,
        from,
        to,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid query', details: err.errors });
      }
      next(err);
    }
  }
);

export default router;
