import { Router } from 'express';
import { z } from 'zod';
import { authRequired, superadminOnly } from '../middleware/auth';
import { getGlobalLeadSummary, getLeadBreakdownByOrg } from '../services/salesReportService';

const router = Router();

const salesFilterSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  courseCode: z.string().optional(),
  groupBy: z.enum(['BP', 'FRANCHISE', 'CENTER']).optional(),
});

router.use(authRequired, superadminOnly);

router.get('/sales/summary', async (req, res, next) => {
  try {
    const parsed = salesFilterSchema.parse(req.query);
    const filter = {
      from: new Date(parsed.from),
      to: new Date(parsed.to),
      courseCode: parsed.courseCode,
      groupBy: parsed.groupBy,
    };
    const summary = await getGlobalLeadSummary(filter);
    res.json(summary);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid filter', errors: err.errors });
    }
    next(err);
  }
});

router.get('/sales/breakdown', async (req, res, next) => {
  try {
    const parsed = salesFilterSchema.parse(req.query);
    const filter = {
      from: new Date(parsed.from),
      to: new Date(parsed.to),
      courseCode: parsed.courseCode,
      groupBy: parsed.groupBy,
    };
    const rows = await getLeadBreakdownByOrg(filter);
    res.json(rows);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid filter', errors: err.errors });
    }
    next(err);
  }
});

export default router;
