import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { requireAuth, requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { OPS_ANOMALY_RULES, getOpsAnomalySummary, getOpsAnomaliesByUnit } from '../services/opsAnomalyService';

const router = Router();

const summarySchema = z.object({
  window: z.coerce.number().int().min(7).max(180).optional(),
});

const byUnitSchema = z.object({
  window: z.coerce.number().int().min(7).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get(
  '/ops/anomalies/summary',
  requireAuth,
  requireRole([
    'SUPERADMIN',
    'BUSINESS_PARTNER',
    'FRANCHISE',
    'CENTER_MANAGER',
    'HEAD_COORDINATOR',
    'COORDINATOR',
    'ADMISSIONS',
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = summarySchema.safeParse(req.query);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors);
      }

      const windowDays = parsed.data.window ?? OPS_ANOMALY_RULES.windowDaysDefault;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user!.role,
        req.user!.orgUnitId ?? null,
        req.user!.id,
      );

      const summary = await getOpsAnomalySummary({
        orgUnitIds: allowedOrgUnits,
        windowDays,
      });

      await logAudit(req, {
        action: 'OPS_ANOMALY_SUMMARY_VIEWED',
        entityType: 'OpsAnomalies',
        meta: { windowDays, orgUnitCount: allowedOrgUnits.length },
      });

      return ok(res, summary);
    } catch (error) {
      console.error('Error fetching ops anomalies summary:', error);
      return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load anomalies summary');
    }
  },
);

router.get(
  '/ops/anomalies/by-unit',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER']),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = byUnitSchema.safeParse(req.query);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors);
      }

      const windowDays = parsed.data.window ?? OPS_ANOMALY_RULES.windowDaysDefault;
      const limit = parsed.data.limit ?? 20;
      const offset = parsed.data.offset ?? 0;

      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user!.role,
        req.user!.orgUnitId ?? null,
        req.user!.id,
      );

      const result = await getOpsAnomaliesByUnit({
        orgUnitIds: allowedOrgUnits,
        windowDays,
        limit,
        offset,
      });

      await logAudit(req, {
        action: 'OPS_ANOMALY_BY_UNIT_VIEWED',
        entityType: 'OpsAnomalies',
        meta: { windowDays, limit, offset, orgUnitCount: allowedOrgUnits.length },
      });

      return ok(res, result);
    } catch (error) {
      console.error('Error fetching ops anomalies by unit:', error);
      return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load anomalies by unit');
    }
  },
);

export default router;
