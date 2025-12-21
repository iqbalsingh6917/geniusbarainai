import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z
    .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().max(200).optional())
    .default(50),
  page: z
    .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional())
    .default(1),
});

router.get('/audit/recent-activity', authRequired, superadminOnly, async (req: AuthRequest, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);

    const where: any = {};
    if (parsed.from || parsed.to) {
      where.createdAt = {};
      if (parsed.from) where.createdAt.gte = new Date(parsed.from);
      if (parsed.to) where.createdAt.lte = new Date(parsed.to);
    }

    const take = Math.min(parsed.limit, 200);
    const skip = (parsed.page - 1) * take;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items,
      total,
      page: parsed.page,
      limit: take,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query', details: err.errors });
    }
    next(err);
  }
});

export default router;
