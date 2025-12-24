import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { requireAuth, requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import {
  RETENTION_RULES,
  getTeacherAssistSignals,
  getCenterAssistSignals,
  getStudentInsights,
} from '../services/retentionAssistService';

const router = Router();

const listSchema = z.object({
  window: z.coerce.number().int().min(7).max(90).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const summarySchema = z.object({
  window: z.coerce.number().int().min(7).max(90).optional(),
});

router.get(
  '/teacher/assist/signals',
  requireAuth,
  requireRole(['TEACHER']),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors);
      }

      const windowDays = parsed.data.window ?? RETENTION_RULES.inactivityCriticalDays;
      const limit = parsed.data.limit ?? 20;
      const offset = parsed.data.offset ?? 0;

      const teacherId = req.user?.id;
      if (!teacherId) {
        return fail(res, 401, 'AUTH_REQUIRED', 'Teacher not authenticated');
      }

      const result = await getTeacherAssistSignals({ teacherId, windowDays, limit, offset });

      await logAudit(req, {
        action: 'TEACHER_ASSIST_SIGNALS_VIEWED',
        entityType: 'RetentionSignals',
        meta: { windowDays, limit, offset },
      });

      return ok(res, result);
    } catch (error) {
      console.error('Error fetching teacher assist signals:', error);
      return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load teacher assist signals');
    }
  },
);

router.get(
  '/center/assist/signals',
  requireAuth,
  requireRole([
    'CENTER_MANAGER',
    'HEAD_COORDINATOR',
    'COORDINATOR',
    'FRANCHISE',
    'BUSINESS_PARTNER',
    'SUPERADMIN',
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors);
      }

      const windowDays = parsed.data.window ?? RETENTION_RULES.inactivityCriticalDays;
      const limit = parsed.data.limit ?? 20;
      const offset = parsed.data.offset ?? 0;

      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user!.role,
        req.user!.orgUnitId ?? null,
        req.user!.id,
      );
      if (!allowedOrgUnits.length) {
        return ok(res, { items: [], total: 0, limit, offset, summary: { totalSignals: 0, bySeverity: { INFO: 0, WARN: 0, CRITICAL: 0 }, byCode: {} } });
      }

      const result = await getCenterAssistSignals({ orgUnitIds: allowedOrgUnits, windowDays, limit, offset });

      await logAudit(req, {
        action: 'CENTER_ASSIST_SIGNALS_VIEWED',
        entityType: 'RetentionSignals',
        meta: { windowDays, limit, offset, orgUnitCount: allowedOrgUnits.length },
      });

      return ok(res, result);
    } catch (error) {
      console.error('Error fetching center assist signals:', error);
      return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load center assist signals');
    }
  },
);

router.get(
  '/student/assist/summary',
  requireAuth,
  requireRole(['STUDENT']),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = summarySchema.safeParse(req.query);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors);
      }

      const windowDays = parsed.data.window ?? RETENTION_RULES.inactivityCriticalDays;
      const studentId = req.user?.studentId;
      if (!studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Student account not linked');
      }

      const result = await getStudentInsights({ studentId, windowDays });

      await logAudit(req, {
        action: 'STUDENT_ASSIST_SUMMARY_VIEWED',
        entityType: 'RetentionSignals',
        meta: { windowDays },
      });

      return ok(res, result);
    } catch (error) {
      console.error('Error fetching student assist summary:', error);
      return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load student insights');
    }
  },
);

export default router;
