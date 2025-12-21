import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@lms/db';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

const baseQuestionSchema = z.object({
  order: z.number().int().nonnegative(),
  type: z.enum(['MCQ', 'NUMERIC']),
  text: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  correctNum: z.number().optional(),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        isCorrect: z.boolean(),
      })
    )
    .optional(),
});

const createQuestionSchema = baseQuestionSchema;
const updateQuestionSchema = baseQuestionSchema.partial();

router.use(authRequired, superadminOnly);

// GET /superadmin/abacus/exams/:examId/questions
router.get('/:examId/questions', async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);
    if (!examId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid exam ID');
    }

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
      include: { options: true },
    });

    ok(res, questions);
  } catch (err) {
    next(err);
  }
});

// POST /superadmin/abacus/exams/:examId/questions
router.post('/:examId/questions', async (req: AuthRequest, res, next) => {
  try {
    const examId = Number(req.params.examId);
    if (!examId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid exam ID');
    }

    const payload = createQuestionSchema.parse(req.body);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return fail(res, 404, 'NOT_FOUND', 'Exam not found');
    }

    const question = await prisma.examQuestion.create({
      data: {
        examId,
        order: payload.order,
        type: payload.type,
        text: payload.text,
        imageUrl: payload.imageUrl ?? null,
        correctNum: payload.type === 'NUMERIC' ? payload.correctNum ?? null : null,
        options:
          payload.type === 'MCQ' && payload.options
            ? {
                create: payload.options.map((opt) => ({
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                })),
              }
            : undefined,
      },
      include: { options: true },
    });

    await logAudit(req, {
      action: 'EXAM_QUESTION_CREATED',
      entityType: 'ExamQuestion',
      entityId: question.id.toString(),
      meta: { examId },
    });

    ok(res, question, 201);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid question payload', err.errors);
    }
    next(err);
  }
});

// PATCH /superadmin/abacus/questions/:id
router.patch('/questions/:id', async (req: AuthRequest, res, next) => {
  try {
    const questionId = Number(req.params.id);
    if (!questionId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid question ID');
    }

    const payload = updateQuestionSchema.parse(req.body);

    const existing = await prisma.examQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'Question not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const question = await tx.examQuestion.update({
        where: { id: questionId },
        data: {
          order: typeof payload.order === 'number' ? payload.order : existing.order,
          type: payload.type ?? existing.type,
          text: payload.text ?? existing.text,
          imageUrl: typeof payload.imageUrl === 'undefined' ? existing.imageUrl : payload.imageUrl ?? null,
          correctNum:
            (payload.type ?? existing.type) === 'NUMERIC'
              ? typeof payload.correctNum === 'number'
                ? payload.correctNum
                : existing.correctNum
              : null,
        },
      });

      if (payload.options && (payload.type ?? existing.type) === 'MCQ') {
        await tx.examOption.deleteMany({ where: { questionId } });
        await tx.examOption.createMany({
          data: payload.options.map((opt) => ({
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        });
      }

      return tx.examQuestion.findUnique({
        where: { id: questionId },
        include: { options: true },
      });
    });

    await logAudit(req, {
      action: 'EXAM_QUESTION_UPDATED',
      entityType: 'ExamQuestion',
      entityId: questionId.toString(),
      meta: { examId: existing.examId },
    });

    ok(res, updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid question payload', err.errors);
    }
    next(err);
  }
});

export default router;
