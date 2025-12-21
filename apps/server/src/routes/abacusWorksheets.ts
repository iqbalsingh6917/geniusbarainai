import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, superadminOnly } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

// Apply middleware to all routes in this router
router.use(authRequired);
router.use(superadminOnly);

// Zod schema for AbacusWorksheet
const AbacusWorksheetSchema = z.object({
  levelId: z.number(),
  title: z.string(),
  kind: z.enum(['PRACTICE', 'SPEED', 'EXAM', 'HOMEWORK', 'AURALS']),
  difficultyBand: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  questionCount: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateAbacusWorksheetSchema = AbacusWorksheetSchema.partial();

// GET /superadmin/abacus-worksheets/abacus-levels/:levelId/worksheets
// Get all worksheets for a specific level
router.get('/abacus-levels/:levelId/worksheets', async (req: Request, res: Response) => {
  try {
    const levelId = parseInt(req.params.levelId);
    
    if (isNaN(levelId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid level ID');
    }
    
    // Check if level exists
    const level = await prisma.abacusLevel.findUnique({
      where: { id: levelId }
    });
    
    if (!level) {
      return fail(res, 404, 'NOT_FOUND', 'Level not found');
    }
    
    const worksheets = await prisma.abacusWorksheet.findMany({
      where: { levelId },
      orderBy: [{ createdAt: 'desc' }]
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_WORKSHEETS_VIEWED',
      entityType: 'AbacusWorksheet',
      meta: { levelId, worksheetsCount: worksheets.length }
    });

    ok(res, worksheets);
  } catch (err) {
    console.error('Error fetching worksheets:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/worksheets
// Create a new worksheet
router.post('/worksheets', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = AbacusWorksheetSchema.parse(req.body);
    
    // Check if level exists
    const level = await prisma.abacusLevel.findUnique({
      where: { id: parsed.levelId }
    });
    
    if (!level) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid levelId: level not found');
    }
    
    // Create new worksheet
    const newWorksheet = await prisma.abacusWorksheet.create({
      data: parsed
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_WORKSHEET_CREATED',
      entityType: 'AbacusWorksheet',
      entityId: newWorksheet.id,
      meta: { 
        levelId: newWorksheet.levelId,
        title: newWorksheet.title,
        kind: newWorksheet.kind
      }
    });

    ok(res, newWorksheet, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', (err as z.ZodError).errors);
    }
    
    console.error('Error creating worksheet:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /superadmin/worksheets/:id
// Update an existing worksheet
router.put('/worksheets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid ID');
    }
    
    // Validate request body
    const parsed = UpdateAbacusWorksheetSchema.parse(req.body);
    
    // Update worksheet
    const updatedWorksheet = await prisma.abacusWorksheet.update({
      where: { id },
      data: parsed
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_WORKSHEET_UPDATED',
      entityType: 'AbacusWorksheet',
      entityId: updatedWorksheet.id,
      meta: { 
        levelId: updatedWorksheet.levelId,
        title: updatedWorksheet.title,
        kind: updatedWorksheet.kind
      }
    });

    ok(res, updatedWorksheet);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', (err as z.ZodError).errors);
    }
    
    if (err instanceof Error && err.message.includes('RecordNotFound')) {
      return fail(res, 404, 'NOT_FOUND', 'Worksheet not found');
    }
    
    console.error('Error updating worksheet:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /superadmin/worksheets/:id
// Delete a worksheet
router.delete('/worksheets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid ID');
    }
    
    // Delete worksheet
    await prisma.abacusWorksheet.delete({
      where: { id }
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_WORKSHEET_DELETED',
      entityType: 'AbacusWorksheet',
      entityId: id,
      meta: { worksheetId: id }
    });

    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message.includes('RecordNotFound')) {
      return fail(res, 404, 'NOT_FOUND', 'Worksheet not found');
    }
    
    console.error('Error deleting worksheet:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;