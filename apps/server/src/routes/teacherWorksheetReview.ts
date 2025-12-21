// @ts-nocheck
import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isTeacher } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { logAudit } from '../services/auditService';
import { WorksheetEngineError } from '../services/worksheetEngineService';

const router = Router();

async function getTeacherScope(teacherUserId: number) {
  const assignments = await prisma.teacherStudentAssignment.findMany({
    where: { teacherUserId },
    select: { studentId: true, enrollmentId: true },
  });
  const studentIds = Array.from(new Set(assignments.map((a) => a.studentId)));
  const enrollmentIds = Array.from(
    new Set(assignments.map((a) => a.enrollmentId).filter((v): v is number => !!v))
  );
  return { studentIds, enrollmentIds };
}

async function teacherCanAccessAttempt(user: any, attempt: any) {
  if (!user) return false;
  const { role, orgUnitId, id: userId } = user;
  if (role === 'SUPERADMIN') return true;

  const allowedOrgUnits = await getAllowedOrgUnitsForUser(role, orgUnitId || null);
  const scope = await getTeacherScope(userId);

  if (attempt.enrollmentId && scope.enrollmentIds.includes(attempt.enrollmentId)) return true;
  if (scope.studentIds.includes(attempt.studentId)) return true;
  if (attempt.enrollment?.orgUnitId && allowedOrgUnits.includes(attempt.enrollment.orgUnitId)) return true;
  if (attempt.student?.orgUnitId && allowedOrgUnits.includes(attempt.student.orgUnitId)) return true;
  return false;
}

router.use(authRequired);

// GET /attempts/:attemptId
router.get('/attempts/:attemptId', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }

    const attempt = await prisma.studentWorksheetAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: true,
        assignment: true,
        enrollment: { select: { id: true, orgUnitId: true } },
        worksheet: {
          include: {
            level: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
    }

    const access = await teacherCanAccessAttempt(req.user, attempt);
    if (!access) {
      return fail(res, 403, 'ACCESS_DENIED', 'Not allowed to view this attempt');
    }

    const questions = await prisma.worksheetQuestion.findMany({
      where: { worksheetId: attempt.worksheetId },
      orderBy: { orderIndex: 'asc' },
      include: { options: true },
    });
    const answers = await prisma.studentWorksheetAnswer.findMany({ where: { attemptId } });
    const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const questionPayload = questions.map((q) => {
      const ans = answersByQuestion.get(q.id);
      const selectedText =
        ans && ans.optionIds && ans.optionIds.length
          ? q.options
              .filter((opt) => (ans.optionIds || []).includes(opt.id))
              .map((opt) => opt.text)
              .join(', ')
          : null;
      const correctOptionText = q.options.filter((opt) => opt.isCorrect).map((opt) => opt.text).join(', ');
      return {
        id: q.id,
        orderIndex: q.orderIndex,
        prompt: q.prompt,
        correctAnswer:
          q.questionType === 'MCQ'
            ? correctOptionText || q.correctAnswer
            : q.questionType === 'NUMERIC' && q.correctNum !== null && q.correctNum !== undefined
              ? String(q.correctNum)
              : q.correctText ?? q.correctAnswer,
        answerGiven:
          selectedText ??
          (ans?.answerGiven ?? (ans?.numericAns !== null ? String(ans.numericAns) : ans?.textAns ?? '')),
        isCorrect: ans?.isCorrect ?? null,
        marksAwarded: ans?.marksAwarded ?? null,
        maxMarks: q.maxMarks,
      };
    });

    ok(res, {
      attempt,
      worksheet: attempt.worksheet,
      student: {
        id: attempt.student.id,
        code: attempt.student.code,
        name: `${attempt.student.firstName} ${attempt.student.lastName || ''}`.trim(),
      },
      assignment: attempt.assignment,
      questions: questionPayload,
    });
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error fetching attempt for review:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

const feedbackSchema = z.object({
  teacherComment: z.string().optional(),
  teacherAdjustedScore: z.number().min(0).optional(),
});

router.put('/attempts/:attemptId/feedback', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Only teachers can review attempts');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }
    const parsed = feedbackSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const attempt = await prisma.studentWorksheetAttempt.findUnique({
      where: { id: attemptId },
      include: { student: true, enrollment: { select: { orgUnitId: true } } },
    });
    if (!attempt) {
      return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
    }

    const access = await teacherCanAccessAttempt(req.user, attempt);
    if (!access) {
      return fail(res, 403, 'ACCESS_DENIED', 'Not allowed to review this attempt');
    }

    const data: any = {
      teacherComment: parsed.data.teacherComment ?? null,
      teacherAdjustedScore:
        parsed.data.teacherAdjustedScore !== undefined ? parsed.data.teacherAdjustedScore : attempt.teacherAdjustedScore,
      reviewedAt: new Date(),
      graderUserId: req.user.id,
      status: attempt.status === 'SUBMITTED' ? 'GRADED' : attempt.status,
      updatedAt: new Date(),
    };
    if (parsed.data.teacherAdjustedScore !== undefined) {
      data.totalScore = parsed.data.teacherAdjustedScore;
    }

    const updated = await prisma.studentWorksheetAttempt.update({
      where: { id: attemptId },
      data,
    });

    await logAudit(req, {
      action: 'TEACHER_WORKSHEET_FEEDBACK',
      entityType: 'StudentWorksheetAttempt',
      entityId: attemptId,
      meta: {
        teacherAdjustedScore: parsed.data.teacherAdjustedScore,
        teacherComment: parsed.data.teacherComment,
      },
    });

    ok(res, updated);
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error saving attempt feedback:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

const overrideSchema = z.object({
  score: z.number().min(0),
});

router.post('/attempts/:attemptId/override-score', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Only teachers can override scores');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }
    const parsed = overrideSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const attempt = await prisma.studentWorksheetAttempt.findUnique({
      where: { id: attemptId },
      include: { student: true, enrollment: { select: { orgUnitId: true } } },
    });
    if (!attempt) {
      return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
    }

    const access = await teacherCanAccessAttempt(req.user, attempt);
    if (!access) {
      return fail(res, 403, 'ACCESS_DENIED', 'Not allowed to override this attempt');
    }

    const updated = await prisma.studentWorksheetAttempt.update({
      where: { id: attemptId },
      data: {
        totalScore: parsed.data.score,
        teacherAdjustedScore: parsed.data.score,
        reviewedAt: new Date(),
        graderUserId: req.user.id,
        status: attempt.status === 'SUBMITTED' ? 'GRADED' : attempt.status,
      },
    });

    await logAudit(req, {
      action: 'WORKSHEET_SCORE_OVERRIDDEN',
      entityType: 'StudentWorksheetAttempt',
      entityId: attemptId,
      meta: { score: parsed.data.score },
    });

    ok(res, updated);
  } catch (error: any) {
    console.error('Error overriding worksheet score:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
// @ts-nocheck
