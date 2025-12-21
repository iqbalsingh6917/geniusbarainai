import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isCenterManager, isSuperadmin, isTeacher } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import {
  getWorksheetQuestions,
  refreshWorksheetQuestionCount,
  WorksheetEngineError,
} from '../services/worksheetEngineService';

const router = Router({ mergeParams: true });

const createQuestionSchema = z.object({
  prompt: z.string().min(1),
  correctAnswer: z.string().min(1),
  maxMarks: z.number().int().min(0),
  orderIndex: z.number().int().min(1).optional(),
});

const updateQuestionSchema = z.object({
  prompt: z.string().min(1).optional(),
  correctAnswer: z.string().min(1).optional(),
  maxMarks: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(1).optional(),
});

function canViewQuestions(role: string) {
  return isSuperadmin(role) || isCenterManager(role) || isTeacher(role);
}

router.use(authRequired);

router.get('/:worksheetId/questions', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canViewQuestions(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Insufficient role to view questions');
    }
    const worksheetId = parseInt(req.params.worksheetId, 10);
    if (Number.isNaN(worksheetId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid worksheet id');
    }

    const worksheet = await prisma.abacusWorksheet.findUnique({ where: { id: worksheetId } });
    if (!worksheet) {
      return fail(res, 404, 'NOT_FOUND', 'Worksheet not found');
    }

    const questions = await getWorksheetQuestions(worksheetId);
    ok(res, questions);
  } catch (error) {
    console.error('Error fetching worksheet questions:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.post('/:worksheetId/questions', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isSuperadmin(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Only superadmins can create questions');
    }
    const worksheetId = parseInt(req.params.worksheetId, 10);
    if (Number.isNaN(worksheetId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid worksheet id');
    }
    const parsed = createQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const worksheet = await prisma.abacusWorksheet.findUnique({ where: { id: worksheetId } });
    if (!worksheet) {
      return fail(res, 404, 'NOT_FOUND', 'Worksheet not found');
    }

    const existingQuestions = await getWorksheetQuestions(worksheetId);
    const nextOrder =
      parsed.data.orderIndex ||
      (existingQuestions.length > 0
        ? Math.max(...existingQuestions.map((q) => q.orderIndex)) + 1
        : 1);

    const created = await prisma.worksheetQuestion.create({
      data: {
        worksheetId,
        prompt: parsed.data.prompt,
        correctAnswer: parsed.data.correctAnswer,
        maxMarks: parsed.data.maxMarks,
        orderIndex: nextOrder,
        questionType: 'NUMERIC',
      },
    });

    await refreshWorksheetQuestionCount(worksheetId);
    await logAudit(req, {
      action: 'WORKSHEET_QUESTION_CREATED',
      entityType: 'WorksheetQuestion',
      entityId: created.id,
      meta: { worksheetId, orderIndex: created.orderIndex },
    });

    ok(res, created, 201);
  } catch (error) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error creating worksheet question:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.put('/:worksheetId/questions/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isSuperadmin(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Only superadmins can update questions');
    }
    const worksheetId = parseInt(req.params.worksheetId, 10);
    const questionId = parseInt(req.params.id, 10);
    if (Number.isNaN(worksheetId) || Number.isNaN(questionId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid identifiers');
    }
    const parsed = updateQuestionSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No fields to update', parsed.success ? undefined : parsed.error.errors);
    }

    const existing = await prisma.worksheetQuestion.findFirst({
      where: { id: questionId, worksheetId },
    });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'Question not found for this worksheet');
    }

    const updated = await prisma.worksheetQuestion.update({
      where: { id: questionId },
      data: parsed.data,
    });

    await refreshWorksheetQuestionCount(worksheetId);
    await logAudit(req, {
      action: 'WORKSHEET_QUESTION_UPDATED',
      entityType: 'WorksheetQuestion',
      entityId: questionId,
      meta: { worksheetId },
    });

    ok(res, updated);
  } catch (error) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error updating worksheet question:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.delete('/:worksheetId/questions/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isSuperadmin(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Only superadmins can delete questions');
    }
    const worksheetId = parseInt(req.params.worksheetId, 10);
    const questionId = parseInt(req.params.id, 10);
    if (Number.isNaN(worksheetId) || Number.isNaN(questionId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid identifiers');
    }

    const existing = await prisma.worksheetQuestion.findFirst({
      where: { id: questionId, worksheetId },
    });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'Question not found for this worksheet');
    }

    await prisma.worksheetQuestion.delete({ where: { id: questionId } });
    await refreshWorksheetQuestionCount(worksheetId);
    await logAudit(req, {
      action: 'WORKSHEET_QUESTION_DELETED',
      entityType: 'WorksheetQuestion',
      entityId: questionId,
      meta: { worksheetId },
    });

    res.status(204).send();
  } catch (error) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error deleting worksheet question:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
