import { Router } from 'express';
import { z } from 'zod';
import { authRequired, superadminOnly } from '../middleware/auth';
import { listLevels, createLevel, updateLevel } from '../services/abacusLevelService';

const router = Router();

const difficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);
const ageGroupEnum = z.enum(['JUNIOR', 'REGULAR', 'SENIOR']);

const baseLevelSchema = z.object({
  courseId: z.number().int().positive(),
  moduleId: z.number().int().positive().optional().nullable(),
  name: z.string().min(1),
  code: z.string().min(1),
  difficulty: difficultyEnum,
  ageGroup: ageGroupEnum.optional(),
  operations: z.array(z.string()).min(1),
  formulas: z.array(z.string()).optional().default([]),
  examDurationMin: z.number().int().positive(),
  maxMarks: z.number().int().positive().optional(),
  passingPercent: z.number().int().min(0).max(100),
  isActive: z.boolean(),
});

const createLevelSchema = baseLevelSchema;
const updateLevelSchema = baseLevelSchema.partial();

router.use(authRequired, superadminOnly);

router.get('/', async (req, res, next) => {
  try {
    const courseId = Number(req.query.courseId);
    const moduleId = req.query.moduleId ? Number(req.query.moduleId) : undefined;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required.' });
    }

    const levels = await listLevels({ courseId, moduleId });
    res.json(levels);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createLevelSchema.parse(req.body);
    const level = await createLevel(payload);
    res.status(201).json(level);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid level payload.', errors: err.errors });
    }
    return res.status(400).json({ message: err?.message || 'Unable to create level.' });
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updateLevelSchema.parse(req.body);
    const level = await updateLevel(id, payload);
    res.json(level);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid level payload.', errors: err.errors });
    }
    return res.status(400).json({ message: err?.message || 'Unable to update level.' });
  }
});

export default router;
