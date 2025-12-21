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
import { isStudent } from '../constants/roles';
import prisma from '../prismaClient';
import {
  createOrGetAttemptForStudent,
  getAttemptWithDetails,
  saveAnswers,
  submitAttempt,
  WorksheetEngineError,
} from '../services/worksheetEngineService';

const router = Router();

async function fetchWorksheetContext(worksheetId: number) {
  const worksheet = await prisma.abacusWorksheet.findUnique({
    where: { id: worksheetId },
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
  });
  if (!worksheet) {
    return null;
  }
  return {
    id: worksheet.id,
    title: worksheet.title,
    kind: worksheet.kind,
    level: worksheet.level
      ? {
          id: worksheet.level.id,
          name: worksheet.level.name,
          order: worksheet.level.order,
        }
      : null,
    module: worksheet.level?.module
      ? {
          id: worksheet.level.module.id,
          name: worksheet.level.module.title,
          index: worksheet.level.module.index,
        }
      : null,
    course: worksheet.level?.module?.course
      ? {
          id: worksheet.level.module.course.id,
          code: worksheet.level.module.course.code,
          name: worksheet.level.module.course.name,
        }
      : null,
  };
}

async function requireStudentAssignment(
  studentId: number,
  worksheetId: number,
  assignmentId?: number | null
) {
  if (assignmentId) {
    const assignment = await prisma.studentWorksheetAssignment.findFirst({
      where: { id: assignmentId, studentId, worksheetId },
    });
    if (!assignment) {
      throw new WorksheetEngineError('ASSIGNMENT_NOT_FOUND', 'Assignment not found for this worksheet', 404);
    }
    return assignment;
  }
  const assignment = await prisma.studentWorksheetAssignment.findFirst({
    where: { studentId, worksheetId },
    orderBy: { createdAt: 'desc' },
  });
  if (!assignment) {
    throw new WorksheetEngineError('ASSIGNMENT_NOT_FOUND', 'Worksheet not assigned to student', 404);
  }
  return assignment;
}

function mapAttemptForStudent(details: Awaited<ReturnType<typeof getAttemptWithDetails>>) {
  const answerMap = new Map(details.answers.map((a) => [a.questionId, a]));
  const questions = details.questions.map((q) => {
    const ans = answerMap.get(q.id);
    return {
      id: q.id,
      orderIndex: q.orderIndex,
      prompt: q.prompt,
      maxMarks: q.maxMarks,
      correctAnswer: details.attempt.status !== 'IN_PROGRESS' ? q.correctAnswer : null,
      answerGiven: ans?.answerGiven ?? '',
      isCorrect: ans?.isCorrect ?? null,
      marksAwarded: ans?.marksAwarded ?? null,
    };
  });
  return { questions };
}

const createAttemptSchema = z.object({
  assignmentId: z.number().optional(),
});

const saveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number(),
        answerGiven: z.string(),
      })
    )
    .min(1),
});

// GET /api/student/me/dashboard
router.get('/me/dashboard', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }

    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }

    const dashboard = await buildStudentDashboardData({
      studentId: req.user.studentId,
      role: req.user.role,
      userId: req.user.id,
      orgUnitId: req.user.orgUnitId,
    });

    await logAudit(req, {
      action: 'STUDENT_SELF_DASHBOARD_VIEWED',
      entityType: 'Student',
      entityId: req.user.studentId,
      meta: {
        role: req.user.role,
        via: 'self',
      },
    });

    ok(res, dashboard);
  } catch (error: any) {
    if (error instanceof DashboardAccessError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error fetching student self dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/student/me/courses
router.get('/me/courses', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }

    const studentId = req.user.studentId;

    const enrollments: any[] = await prisma.$queryRaw`
      SELECT 
        e."id"           as "enrollmentId",
        e."courseId"     as "courseId",
        e."status"       as "status",
        e."startDate"    as "startDate",
        c."code"         as "courseCode",
        c."name"         as "courseName",
        m."id"           as "currentModuleId",
        m."title"        as "currentModuleTitle",
        m."index"        as "currentModuleIndex",
        l."id"           as "currentLevelId",
        l."name"         as "currentLevelName",
        l."order"        as "currentLevelOrder"
      FROM "AbacusEnrollment" e
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."studentId" = ${studentId}
      ORDER BY e."startDate" DESC
    `;

    const courseIds = Array.from(new Set(enrollments.map((e: any) => e.courseId).filter(Boolean)));
    const enrollmentIds = enrollments.map((e: any) => e.enrollmentId);

    let totalLevelsByCourse = new Map<number, number>();
    if (courseIds.length > 0) {
      const totals: any[] = await prisma.$queryRaw`
        SELECT m."courseId" as "courseId", COUNT(*) as "count"
        FROM "AbacusLevel" l
        JOIN "AbacusModule" m ON l."moduleId" = m."id"
        WHERE m."courseId" = ANY(${courseIds}::int[])
        GROUP BY m."courseId"
      `;
      totalLevelsByCourse = new Map(
        totals.map((row: any) => [row.courseId, parseInt(row.count?.toString() || '0')])
      );
    }

    let completedByEnrollment = new Map<number, number>();
    if (enrollmentIds.length > 0) {
      const completed: any[] = await prisma.$queryRaw`
        SELECT "enrollmentId", COUNT(DISTINCT "levelId") as "completed"
        FROM "AbacusAssessment"
        WHERE "passed" = true AND "enrollmentId" = ANY(${enrollmentIds}::int[])
        GROUP BY "enrollmentId"
      `;
      completedByEnrollment = new Map(
        completed.map((row: any) => [row.enrollmentId, parseInt(row.completed?.toString() || '0')])
      );
    }

    const courses = enrollments.map((enrollment: any) => {
      const totalLevels = totalLevelsByCourse.get(enrollment.courseId) || 0;
      const completedLevels = completedByEnrollment.get(enrollment.enrollmentId) || 0;
      return {
        enrollmentId: enrollment.enrollmentId,
        courseCode: enrollment.courseCode,
        courseName: enrollment.courseName,
        status: enrollment.status,
        startedAt: enrollment.startDate,
        currentModule: enrollment.currentModuleId
          ? {
              id: enrollment.currentModuleId,
              name: enrollment.currentModuleTitle,
              index: enrollment.currentModuleIndex,
            }
          : null,
        currentLevel: enrollment.currentLevelId
          ? {
              id: enrollment.currentLevelId,
              name: enrollment.currentLevelName,
              order: enrollment.currentLevelOrder,
            }
          : null,
        levelsCompleted: completedLevels,
        totalLevels,
      };
    });

    await logAudit(req, {
      action: 'STUDENT_SELF_COURSES_VIEWED',
      entityType: 'Student',
      entityId: studentId,
      meta: { role: req.user.role, via: 'self', coursesCount: courses.length },
    });

    ok(res, { studentId, courses });
  } catch (error) {
    console.error('Error fetching student courses:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/student/me/worksheets
router.get('/me/worksheets', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }

    const studentId = req.user.studentId;

    const enrollments: any[] = await prisma.$queryRaw`
      SELECT 
        e."id" as "enrollmentId",
        e."courseId" as "courseId",
        c."code" as "courseCode",
        c."name" as "courseName",
        e."status" as "status"
      FROM "AbacusEnrollment" e
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      WHERE e."studentId" = ${studentId} AND e."status" IN ('ONGOING', 'COMPLETED')
    `;

    if (enrollments.length === 0) {
      await logAudit(req, {
        action: 'STUDENT_SELF_WORKSHEETS_VIEWED',
        entityType: 'Student',
        entityId: studentId,
        meta: { role: req.user.role, via: 'self', coursesCount: 0 },
      });
      return ok(res, { studentId, courses: [] });
    }

    const courseIds = Array.from(new Set(enrollments.map((e: any) => e.courseId)));
    const modules: any[] = await prisma.$queryRaw`
      SELECT "id", "courseId", "index", "title"
      FROM "AbacusModule"
      WHERE "courseId" = ANY(${courseIds}::int[])
      ORDER BY "index" ASC
    `;

    const moduleIds = modules.map((m: any) => m.id);
    const levels: any[] = moduleIds.length > 0
      ? await prisma.$queryRaw`
        SELECT "id", "moduleId", "name", "order"
        FROM "AbacusLevel"
        WHERE "moduleId" = ANY(${moduleIds}::int[])
        ORDER BY "order" ASC
      `
      : [];

    const levelIds = levels.map((l: any) => l.id);
    const worksheets: any[] = levelIds.length > 0
      ? await prisma.$queryRaw`
        SELECT "id", "levelId", "title", "kind", "difficultyBand", "questionCount", "notes"
        FROM "AbacusWorksheet"
        WHERE "levelId" = ANY(${levelIds}::int[])
        ORDER BY "id" ASC
      `
      : [];

    const levelsByModule = levels.reduce((acc: any, level: any) => {
      if (!acc[level.moduleId]) acc[level.moduleId] = [];
      acc[level.moduleId].push(level);
      return acc;
    }, {});

    const worksheetsByLevel = worksheets.reduce((acc: any, worksheet: any) => {
      if (!acc[worksheet.levelId]) acc[worksheet.levelId] = [];
      acc[worksheet.levelId].push(worksheet);
      return acc;
    }, {});

    const modulesByCourse = modules.reduce((acc: any, module: any) => {
      if (!acc[module.courseId]) acc[module.courseId] = [];
      acc[module.courseId].push(module);
      return acc;
    }, {});

    const courses = enrollments.map((enrollment: any) => {
      const courseModules = modulesByCourse[enrollment.courseId] || [];
      return {
        enrollmentId: enrollment.enrollmentId,
        courseCode: enrollment.courseCode,
        courseName: enrollment.courseName,
        modules: courseModules.map((module: any) => {
          const moduleLevels = levelsByModule[module.id] || [];
          return {
            moduleId: module.id,
            moduleName: module.title,
            moduleIndex: module.index,
            levels: moduleLevels.map((level: any) => ({
              levelId: level.id,
              levelName: level.name,
              levelOrder: level.order,
              worksheets: (worksheetsByLevel[level.id] || []).map((w: any) => ({
                id: w.id,
                title: w.title,
                kind: w.kind,
                difficultyBand: w.difficultyBand,
                questionCount: w.questionCount,
                notes: w.notes,
              })),
            })),
          };
        }),
      };
    });

    await logAudit(req, {
      action: 'STUDENT_SELF_WORKSHEETS_VIEWED',
      entityType: 'Student',
      entityId: studentId,
      meta: { role: req.user.role, via: 'self', coursesCount: courses.length },
    });

    ok(res, { studentId, courses });
  } catch (error) {
    console.error('Error fetching student worksheets:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/student/me/active-worksheets
router.get('/me/active-worksheets', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }

    const studentId = req.user.studentId;

    const rows: any[] = await prisma.$queryRaw`
      SELECT 
        swa."id" AS "assignmentId",
        swa."status",
        swa."dueDate",
        swa."submittedAt",
        swa."notes",
        w."id" AS "worksheetId",
        w."title" AS "worksheetTitle",
        w."kind" AS "worksheetKind",
        w."difficultyBand" AS "worksheetDifficultyBand",
        w."questionCount" AS "worksheetQuestionCount",
        l."id" AS "levelId",
        l."name" AS "levelName",
        l."order" AS "levelOrder",
        m."id" AS "moduleId",
        m."title" AS "moduleTitle",
        m."index" AS "moduleIndex",
        c."code" AS "courseCode",
        c."name" AS "courseName",
        att."attemptId",
        att."attemptStatus",
        att."attemptTotalScore",
        att."attemptMaxScore",
        att."attemptSubmittedAt",
        qcount."questionCountActual"
      FROM "StudentWorksheetAssignment" swa
      JOIN "AbacusWorksheet" w ON swa."worksheetId" = w."id"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      LEFT JOIN LATERAL (
        SELECT 
          a."id" as "attemptId",
          a."status" as "attemptStatus",
          a."totalScore" as "attemptTotalScore",
          a."maxScore" as "attemptMaxScore",
          a."submittedAt" as "attemptSubmittedAt"
        FROM "StudentWorksheetAttempt" a
        WHERE a."studentId" = ${studentId}
          AND a."worksheetId" = w."id"
          AND a."assignmentId" = swa."id"
        ORDER BY a."createdAt" DESC
        LIMIT 1
      ) att ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS "questionCountActual"
        FROM "WorksheetQuestion" q
        WHERE q."worksheetId" = w."id"
      ) qcount ON TRUE
      WHERE swa."studentId" = ${studentId} AND swa."status" IN ('NOT_STARTED', 'IN_PROGRESS')
      ORDER BY COALESCE(swa."dueDate", swa."createdAt") ASC
    `;

    const assignments = rows.map((row: any) => ({
      id: row.assignmentId,
      status: row.status,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      notes: row.notes,
      worksheet: {
        id: row.worksheetId,
        title: row.worksheetTitle,
        kind: row.worksheetKind,
        difficultyBand: row.worksheetDifficultyBand,
        questionCount:
          row.questionCountActual && row.questionCountActual > 0
            ? row.questionCountActual
            : row.worksheetQuestionCount,
      },
      level: {
        id: row.levelId,
        name: row.levelName,
        order: row.levelOrder,
      },
      module: {
        id: row.moduleId,
        name: row.moduleTitle,
        index: row.moduleIndex,
      },
      course: {
        code: row.courseCode,
        name: row.courseName,
      },
      attempt: row.attemptId
        ? {
            id: row.attemptId,
            status: row.attemptStatus,
            totalScore: row.attemptTotalScore,
            maxScore: row.attemptMaxScore,
            submittedAt: row.attemptSubmittedAt,
          }
        : null,
      hasQuestions:
        ((row.questionCountActual && row.questionCountActual > 0
          ? row.questionCountActual
          : row.worksheetQuestionCount) ?? 0) > 0,
    }));

    await logAudit(req, {
      action: 'STUDENT_ACTIVE_WORKSHEETS_VIEWED',
      entityType: 'StudentWorksheetAssignment',
      entityId: studentId,
      meta: { count: assignments.length },
    });

    ok(res, { studentId, assignments });
  } catch (error) {
    console.error('Error fetching active worksheets:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/student/me/worksheets/:worksheetId/attempt
router.post('/me/worksheets/:worksheetId/attempt', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }
    const worksheetId = parseInt(req.params.worksheetId, 10);
    if (Number.isNaN(worksheetId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid worksheet id');
    }

    const parsed = createAttemptSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const assignment = await requireStudentAssignment(
      req.user.studentId,
      worksheetId,
      parsed.data.assignmentId ?? null
    );

    const { attempt, questions } = await createOrGetAttemptForStudent(
      req.user.studentId,
      worksheetId,
      assignment?.id
    );

    if (assignment && assignment.status === 'NOT_STARTED') {
      await prisma.studentWorksheetAssignment.update({
        where: { id: assignment.id },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });
    }

    const answers = await prisma.studentWorksheetAnswer.findMany({
      where: { attemptId: attempt.id },
    });
    const worksheet = await fetchWorksheetContext(worksheetId);

    await logAudit(req, {
      action: 'STUDENT_WORKSHEET_ATTEMPT_CREATED',
      entityType: 'StudentWorksheetAttempt',
      entityId: attempt.id,
      meta: { worksheetId, assignmentId: assignment?.id },
    });

    ok(res, { attempt, worksheet, questions, answers });
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error creating or fetching attempt:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

async function handleGetAttempt(req: AuthRequest, res: Response) {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }

    const details = await getAttemptWithDetails(attemptId);
    if (details.attempt.studentId !== req.user.studentId) {
      return fail(res, 403, 'ACCESS_DENIED', 'Attempt does not belong to this student');
    }

    const { questions } = mapAttemptForStudent(details);
    const worksheet = await fetchWorksheetContext(details.attempt.worksheetId);

    ok(res, {
      attempt: details.attempt,
      teacherComment: details.attempt.teacherComment,
      teacherAdjustedScore: details.attempt.teacherAdjustedScore,
      reviewedAt: details.attempt.reviewedAt,
      worksheet,
      questions,
    });
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error fetching attempt details:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
}

// GET /api/student/me/worksheet-attempts/:attemptId
router.get('/me/worksheet-attempts/:attemptId', authRequired, handleGetAttempt);
// Alias with plural path
router.get('/me/worksheets/attempts/:attemptId', authRequired, handleGetAttempt);

// POST /api/student/me/worksheet-attempts/:attemptId/save
router.post('/me/worksheet-attempts/:attemptId/save', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }
    const parsed = saveAnswersSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const attempt = await prisma.studentWorksheetAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      return fail(res, 404, 'NOT_FOUND', 'Attempt not found');
    }
    if (attempt.studentId !== req.user.studentId) {
      return fail(res, 403, 'ACCESS_DENIED', 'Attempt does not belong to this student');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      return fail(res, 400, 'INVALID_STATUS', 'Attempt is not in progress');
    }

    await saveAnswers(attemptId, parsed.data.answers);
    const refreshed = await getAttemptWithDetails(attemptId);
    const answerMap = new Map(refreshed.answers.map((a) => [a.questionId, a]));
    const questions = refreshed.questions.map((q) => {
      const ans = answerMap.get(q.id);
      return {
        id: q.id,
        orderIndex: q.orderIndex,
        prompt: q.prompt,
        maxMarks: q.maxMarks,
        answerGiven: ans?.answerGiven ?? '',
        isCorrect: ans?.isCorrect ?? null,
        marksAwarded: ans?.marksAwarded ?? null,
      };
    });

    ok(res, { attempt: refreshed.attempt, questions });
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error saving attempt answers:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/student/me/worksheet-attempts/:attemptId/submit
router.post('/me/worksheet-attempts/:attemptId/submit', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }
    const attemptId = parseInt(req.params.attemptId, 10);
    if (Number.isNaN(attemptId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid attempt id');
    }

    const result = await submitAttempt(attemptId, req.user.studentId);

    if (result.attempt.assignmentId) {
      await prisma.studentWorksheetAssignment.update({
        where: { id: result.attempt.assignmentId },
        data: {
          status: 'COMPLETED',
          submittedAt: result.attempt.submittedAt,
          updatedAt: new Date(),
        },
      });
    }

    const worksheet = await fetchWorksheetContext(result.attempt.worksheetId);

    await logAudit(req, {
      action: 'STUDENT_WORKSHEET_ATTEMPT_SUBMITTED',
      entityType: 'StudentWorksheetAttempt',
      entityId: result.attempt.id,
      meta: {
        worksheetId: result.attempt.worksheetId,
        assignmentId: result.attempt.assignmentId,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
      },
    });

    ok(res, {
      attempt: result.attempt,
      worksheet,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      questions: result.questionSummaries,
    });
  } catch (error: any) {
    if (error instanceof WorksheetEngineError) {
      return fail(res, error.status, error.code, error.message);
    }
    console.error('Error submitting attempt:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/student/me/worksheets/attempts (history)
router.get('/me/worksheets/attempts', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role) || !req.user.studentId) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    const attempts: any[] = await prisma.$queryRaw`
      SELECT 
        swa."id" as "attemptId",
        swa."worksheetId",
        swa."status",
        swa."submittedAt",
        swa."totalScore",
        swa."maxScore",
        swa."teacherAdjustedScore",
        swa."teacherComment",
        swa."reviewedAt",
        w."title" as "worksheetTitle",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "StudentWorksheetAttempt" swa
      JOIN "AbacusWorksheet" w ON w."id" = swa."worksheetId"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      WHERE swa."studentId" = ${req.user.studentId}
      ORDER BY swa."submittedAt" DESC NULLS LAST, swa."createdAt" DESC
    `;

    const grouped: Record<number, any> = {};
    attempts.forEach((row) => {
      if (!grouped[row.worksheetId]) {
        grouped[row.worksheetId] = {
          worksheetId: row.worksheetId,
          worksheetTitle: row.worksheetTitle,
          course: { code: row.courseCode, name: row.courseName },
          module: { id: row.moduleId, name: row.moduleTitle, index: row.moduleIndex },
          level: { id: row.levelId, name: row.levelName, order: row.levelOrder },
          attempts: [],
        };
      }
      grouped[row.worksheetId].attempts.push({
        id: row.attemptId,
        status: row.status,
        submittedAt: row.submittedAt,
        totalScore: row.totalScore,
        maxScore: row.maxScore,
        teacherAdjustedScore: row.teacherAdjustedScore,
        teacherComment: row.teacherComment,
        reviewedAt: row.reviewedAt,
      });
    });

    ok(res, Object.values(grouped));
  } catch (error) {
    console.error('Error fetching student attempt history:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/student/me/exams
router.get('/me/exams', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isStudent(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Student role required');
    }
    if (!req.user.studentId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No student linked to this user');
    }

    const studentId = req.user.studentId;

    const enrollments: any[] = await prisma.$queryRaw`
      SELECT 
        e."id" as "enrollmentId",
        e."courseId" as "courseId",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "AbacusEnrollment" e
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      WHERE e."studentId" = ${studentId}
    `;

    if (enrollments.length === 0) {
      return ok(res, { studentId, exams: [] });
    }

    const exams: any[] = await prisma.$queryRaw`
      SELECT 
        ex."id" as "examId",
        ex."title" as "examTitle",
        ex."courseCode" as "courseCode",
        ex."createdAt" as "createdAt"
      FROM "Exam" ex
      WHERE ex."courseCode" = ANY(${enrollments.map((e) => e.courseCode)}::text[])
    `;

    const examsByCourse = exams.reduce((acc: Record<string, any[]>, ex: any) => {
      if (!acc[ex.courseCode]) acc[ex.courseCode] = [];
      acc[ex.courseCode].push(ex);
      return acc;
    }, {});

    const response = enrollments.flatMap((enrollment: any) => {
      const list = examsByCourse[enrollment.courseCode] || [];
      return list.map((ex: any) => ({
        enrollmentId: enrollment.enrollmentId,
        courseCode: enrollment.courseCode,
        courseName: enrollment.courseName,
        examId: ex.examId,
        title: ex.examTitle,
        createdAt: ex.createdAt,
      }));
    });

    ok(res, { studentId, exams: response });
  } catch (error) {
    console.error('Error fetching student exams:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
// @ts-nocheck
