// @ts-nocheck
import { Router, Response } from 'express';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import {
  buildStudentDashboardData,
  DashboardAccessError,
} from '../services/studentDashboardService';

const router = Router();

// Validate params
const paramsSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

// GET /api/student-dashboard/:studentId (staff access)
router.get('/:studentId', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student id', parsed.error.errors);
    }

    const studentId = parsed.data.studentId;

    const dashboard = await buildStudentDashboardData({
      studentId,
      role: req.user!.role,
      userId: req.user!.id,
      orgUnitId: req.user!.orgUnitId,
    });

    await logAudit(req, {
      action: 'STUDENT_DASHBOARD_VIEWED',
      entityType: 'Student',
      entityId: studentId,
      meta: {
        role: req.user!.role,
        via: 'staff',
      },
    });

    ok(res, dashboard);
  } catch (error: any) {
    if (error instanceof DashboardAccessError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error fetching student dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
// @ts-nocheck
