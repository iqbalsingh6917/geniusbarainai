import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

type RoleScope = 'BUSINESS_PARTNER' | 'FRANCHISE' | 'CENTER_MANAGER';

const buildEnrollmentScope = (orgUnitIds: number[]) => {
  if (!orgUnitIds.length) return undefined;
  return {
    OR: [{ orgUnitId: { in: orgUnitIds } }, { student: { orgUnitId: { in: orgUnitIds } } }],
  };
};

const buildAttemptScope = (orgUnitIds: number[]) => {
  if (!orgUnitIds.length) return undefined;
  return {
    OR: [{ student: { orgUnitId: { in: orgUnitIds } } }, { enrollment: { orgUnitId: { in: orgUnitIds } } }],
  };
};

const computeSummary = async (orgUnitIds: number[]) => {
  const enrollmentScope = buildEnrollmentScope(orgUnitIds);
  const attemptScope = buildAttemptScope(orgUnitIds);

  const [studentsCount, enrollOngoing, enrollCompleted] = await Promise.all([
    prisma.student.count({ where: orgUnitIds.length ? { orgUnitId: { in: orgUnitIds } } : undefined }),
    prisma.abacusEnrollment.count({
      where: {
        status: 'ONGOING',
        ...(enrollmentScope ? { OR: enrollmentScope.OR } : {}),
      },
    }),
    prisma.abacusEnrollment.count({
      where: {
        status: 'COMPLETED',
        ...(enrollmentScope ? { OR: enrollmentScope.OR } : {}),
      },
    }),
  ]);

  const paymentsAgg = await prisma.paymentTransaction.aggregate({
    _sum: { amount: true },
    where: orgUnitIds.length ? { orgUnitId: { in: orgUnitIds } } : undefined,
  });

  const duesAgg = await prisma.studentFeeRecord.aggregate({
    _sum: { amount: true },
    where: {
      status: 'PENDING',
      ...(orgUnitIds.length ? { orgUnitId: { in: orgUnitIds } } : {}),
    },
  });

  const examAgg = await prisma.examAttempt.aggregate({
    _count: true,
    _sum: { score: true, maxScore: true },
    where: {
      ...(attemptScope ? { OR: attemptScope.OR } : {}),
      score: { not: null },
      maxScore: { gt: 0 },
    },
  });

  const worksheetAgg = await prisma.studentWorksheetAttempt.aggregate({
    _count: true,
    _sum: { totalScore: true, maxScore: true },
    where: {
      ...(attemptScope ? { OR: attemptScope.OR } : {}),
      status: { in: ['SUBMITTED', 'GRADED'] },
      totalScore: { not: null },
      maxScore: { gt: 0 },
    },
  });

  const examPercent =
    examAgg._sum.score && examAgg._sum.maxScore && examAgg._sum.maxScore > 0
      ? Math.round((Number(examAgg._sum.score) / Number(examAgg._sum.maxScore)) * 100)
      : null;
  const worksheetPercent =
    worksheetAgg._sum.totalScore && worksheetAgg._sum.maxScore && worksheetAgg._sum.maxScore > 0
      ? Math.round((Number(worksheetAgg._sum.totalScore) / Number(worksheetAgg._sum.maxScore)) * 100)
      : null;

  return {
    totals: {
      students: studentsCount,
      enrollmentsOngoing: enrollOngoing,
      enrollmentsCompleted: enrollCompleted,
    },
    finance: {
      paymentsTotal: paymentsAgg._sum.amount ?? 0,
      duesPending: duesAgg._sum.amount ?? 0,
    },
    assessments: {
      examAttempts: examAgg._count,
      worksheetAttempts: worksheetAgg._count,
      avgExamScorePercent: examPercent,
      avgWorksheetScorePercent: worksheetPercent,
    },
  };
};

const handler = (role: RoleScope, auditAction: string) => async (req: any, res: any) => {
  try {
    const orgUnitId = req.user?.orgUnitId;
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      orgUnitId ?? null,
      req.user.id,
    );
    const summary = await computeSummary(allowedOrgUnits);

    await logAudit(req, {
      action: auditAction,
      entityType: 'OrgDashboard',
      meta: { role: req.user.role, orgUnitId, orgUnitCount: allowedOrgUnits.length },
    });

    ok(res, summary);
  } catch (err) {
    console.error(`Error fetching ${role} dashboard`, err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to load dashboard overview');
  }
};

router.get(
  '/bp/dashboard/overview',
  requireAuth,
  requireRole(['BUSINESS_PARTNER']),
  handler('BUSINESS_PARTNER', 'BP_DASHBOARD_VIEWED'),
);

router.get(
  '/franchise/dashboard/overview',
  requireAuth,
  requireRole(['FRANCHISE']),
  handler('FRANCHISE', 'FRANCHISE_DASHBOARD_VIEWED'),
);

router.get(
  '/center/dashboard/overview',
  requireAuth,
  requireRole(['CENTER_MANAGER']),
  handler('CENTER_MANAGER', 'CENTER_DASHBOARD_VIEWED'),
);

export default router;
