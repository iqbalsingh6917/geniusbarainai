import { Router } from 'express';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';

const router = Router();

type AssessmentSummary = {
  totalAttempts: number;
  completedAttempts: number;
  avgScorePercent: number | null;
  passRatePercent: number | null;
};

const COMPLETED_WORKSHEET_STATUSES = ['SUBMITTED', 'GRADED', 'COMPLETED'];

async function buildExamSummary(where: any): Promise<AssessmentSummary> {
  const totalAttempts = await prisma.examAttempt.count({ where });
  const completedWhere = { ...where, status: 'COMPLETED' };

  const completedAttempts = await prisma.examAttempt.count({ where: completedWhere });

  const scoreAgg = await prisma.examAttempt.aggregate({
    where: {
      ...completedWhere,
      score: { not: null },
      maxScore: { not: null, gt: 0 },
    },
    _sum: { score: true, maxScore: true },
  });

  const scoreSum = scoreAgg._sum.score ?? 0;
  const maxScoreSum = scoreAgg._sum.maxScore ?? 0;
  const avgScorePercent =
    maxScoreSum > 0 ? Math.round((Number(scoreSum) / Number(maxScoreSum)) * 100) : null;

  const completedScores = await prisma.examAttempt.findMany({
    where: {
      ...completedWhere,
      score: { not: null },
      maxScore: { not: null, gt: 0 },
    },
    select: { score: true, maxScore: true },
  });
  const passCount = completedScores.filter(
    (a) => a.score !== null && a.maxScore && (Number(a.score) * 100) / Number(a.maxScore) >= 60
  ).length;
  const passRatePercent =
    completedScores.length > 0 ? Math.round((passCount / completedScores.length) * 100) : null;

  return { totalAttempts, completedAttempts, avgScorePercent, passRatePercent };
}

async function buildWorksheetSummary(where: any): Promise<AssessmentSummary> {
  const totalAttempts = await prisma.studentWorksheetAttempt.count({ where });
  const completedWhere = { ...where, status: { in: COMPLETED_WORKSHEET_STATUSES } };

  const completedAttempts = await prisma.studentWorksheetAttempt.count({ where: completedWhere });

  const scoreAgg = await prisma.studentWorksheetAttempt.aggregate({
    where: {
      ...completedWhere,
      totalScore: { not: null },
      maxScore: { not: null, gt: 0 },
    },
    _sum: { totalScore: true, maxScore: true },
  });

  const scoreSum = scoreAgg._sum.totalScore ?? 0;
  const maxScoreSum = scoreAgg._sum.maxScore ?? 0;
  const avgScorePercent =
    maxScoreSum > 0 ? Math.round((Number(scoreSum) / Number(maxScoreSum)) * 100) : null;

  const completedScores = await prisma.studentWorksheetAttempt.findMany({
    where: {
      ...completedWhere,
      totalScore: { not: null },
      maxScore: { not: null, gt: 0 },
    },
    select: { totalScore: true, maxScore: true },
  });
  const passCount = completedScores.filter(
    (a) =>
      a.totalScore !== null &&
      a.maxScore &&
      (Number(a.totalScore) * 100) / Number(a.maxScore) >= 60
  ).length;
  const passRatePercent =
    completedScores.length > 0 ? Math.round((passCount / completedScores.length) * 100) : null;

  return { totalAttempts, completedAttempts, avgScorePercent, passRatePercent };
}

async function getTeacherScope(teacherUserId: number) {
  const assignments = await prisma.teacherStudentAssignment.findMany({
    where: { teacherUserId },
    select: { studentId: true, enrollmentId: true },
  });
  const studentIds = Array.from(new Set(assignments.map((a) => a.studentId).filter(Boolean)));
  const enrollmentIds = Array.from(
    new Set(assignments.map((a) => a.enrollmentId).filter((v): v is number => !!v))
  );
  return { studentIds, enrollmentIds };
}

function buildScopedWhere(scope: { studentIds: number[]; enrollmentIds: number[] }, allowed: number[]) {
  const or: any[] = [];
  if (scope.enrollmentIds.length) {
    or.push({ enrollmentId: { in: scope.enrollmentIds } });
  }
  if (scope.studentIds.length) {
    or.push({ studentId: { in: scope.studentIds } });
  }
  if (allowed.length) {
    or.push({ enrollment: { orgUnitId: { in: allowed } } });
  }
  if (!or.length) {
    // no scope -> no data
    return { id: { in: [] as number[] } };
  }
  return { OR: or };
}

// SUPERADMIN summary
router.get(
  '/superadmin/analytics/assessments/summary',
  requireAuth,
  requireRole(['SUPERADMIN']),
  async (req, res) => {
    try {
      const exam = await buildExamSummary({});
      const worksheet = await buildWorksheetSummary({});
      ok(res, { exam, worksheet });
    } catch (err) {
      console.error('Error in superadmin assessment summary', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to load assessment summary');
    }
  }
);

// TEACHER summary
router.get(
  '/teacher/analytics/assessments/summary',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res) => {
    try {
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null, req.user!.id);
      const scope = await getTeacherScope(req.user!.id);
      const where = buildScopedWhere(scope, allowedOrgUnits);

      const exam = await buildExamSummary(where);
      const worksheet = await buildWorksheetSummary(where);
      ok(res, { exam, worksheet });
    } catch (err) {
      console.error('Error in teacher assessment summary', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to load assessment summary');
    }
  }
);

export default router;
