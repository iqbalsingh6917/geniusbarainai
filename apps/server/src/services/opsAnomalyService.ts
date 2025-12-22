import prisma from '../prismaClient';

export type AnomalySeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type OpsAnomaly = {
  code: string;
  severity: AnomalySeverity;
  title: string;
  description: string;
  evidence: Record<string, number | string>;
  suggestedAction: string;
};

export type OpsAnomalySummary = {
  anomalies: OpsAnomaly[];
  totals: {
    collectionsCurrent: number;
    outstanding: number;
    overdueCount: number;
  };
  windowDays: number;
};

type AnomalyMetrics = {
  collectionsCurrent: number;
  collectionsPrevious: number;
  outstandingNow: number;
  outstandingPrevious: number;
  overdueCountNow: number;
  overdueCountPrevious: number;
  transactionsCount: number;
  enrollmentsCount: number;
};

export const OPS_ANOMALY_RULES = {
  windowDaysDefault: 30,
  collectionDropWarn: 0.3,
  collectionDropCritical: 0.5,
  dueSpikeIncrease: 0.3,
  overdueClusterCount: 10,
  overdueClusterJump: 0.5,
  overdueAgeDays: 30,
  dueSpikeWindowDays: 14,
  activityWindowDays: 14,
} as const;

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

const daysAgo = (now: Date, days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
};

const buildAnomalies = (metrics: AnomalyMetrics, windowDays: number): OpsAnomaly[] => {
  const anomalies: OpsAnomaly[] = [];

  if (metrics.collectionsPrevious > 0) {
    const dropRatio = (metrics.collectionsPrevious - metrics.collectionsCurrent) / metrics.collectionsPrevious;
    if (dropRatio >= OPS_ANOMALY_RULES.collectionDropWarn) {
      const severity: AnomalySeverity =
        dropRatio >= OPS_ANOMALY_RULES.collectionDropCritical ? 'CRITICAL' : 'WARN';
      const dropPercent = Math.round(dropRatio * 100);
      anomalies.push({
        code: 'COLLECTION_DROP',
        severity,
        title: 'Collections dropped',
        description: `Collections dropped ${dropPercent}% vs previous ${windowDays} days.`,
        evidence: {
          current: metrics.collectionsCurrent,
          previous: metrics.collectionsPrevious,
          dropPercent,
        },
        suggestedAction: 'Review payment follow-ups and verify transactions are being recorded.',
      });
    }
  }

  if (metrics.outstandingPrevious > 0 && metrics.outstandingNow > metrics.outstandingPrevious) {
    const increaseRatio = (metrics.outstandingNow - metrics.outstandingPrevious) / metrics.outstandingPrevious;
    if (increaseRatio >= OPS_ANOMALY_RULES.dueSpikeIncrease) {
      const increasePercent = Math.round(increaseRatio * 100);
      anomalies.push({
        code: 'DUE_SPIKE',
        severity: 'WARN',
        title: 'Outstanding dues spiked',
        description: `Outstanding dues increased ${increasePercent}% in the last ${OPS_ANOMALY_RULES.dueSpikeWindowDays} days.`,
        evidence: {
          current: metrics.outstandingNow,
          previous: metrics.outstandingPrevious,
          increasePercent,
        },
        suggestedAction: 'Prioritize collections on pending and partial dues.',
      });
    }
  }

  const overdueJumpRatio =
    metrics.overdueCountPrevious > 0
      ? (metrics.overdueCountNow - metrics.overdueCountPrevious) / metrics.overdueCountPrevious
      : null;

  if (
    metrics.overdueCountNow >= OPS_ANOMALY_RULES.overdueClusterCount ||
    (overdueJumpRatio !== null && overdueJumpRatio >= OPS_ANOMALY_RULES.overdueClusterJump)
  ) {
    const jumpPercent = overdueJumpRatio !== null ? Math.round(overdueJumpRatio * 100) : null;
    anomalies.push({
      code: 'PAYMENT_OVERDUE_CLUSTER',
      severity: 'WARN',
      title: 'Overdue dues cluster',
      description: 'Overdue dues count is elevated versus the prior window.',
      evidence: {
        current: metrics.overdueCountNow,
        previous: metrics.overdueCountPrevious,
        ...(jumpPercent !== null ? { jumpPercent } : {}),
      },
      suggestedAction: 'Review overdue accounts and schedule collections.',
    });
  }

  if (metrics.transactionsCount === 0 && metrics.enrollmentsCount === 0) {
    anomalies.push({
      code: 'ZERO_ACTIVITY',
      severity: 'INFO',
      title: 'No recent activity',
      description: `No enrollments or collections in the last ${OPS_ANOMALY_RULES.activityWindowDays} days.`,
      evidence: {
        transactions: metrics.transactionsCount,
        enrollments: metrics.enrollmentsCount,
      },
      suggestedAction: 'Confirm center operations and data entry are active.',
    });
  }

  return anomalies;
};

export const computeOpsAnomalies = buildAnomalies;

export async function getOpsAnomalySummary(params: {
  orgUnitIds: number[];
  windowDays: number;
  now?: Date;
}): Promise<OpsAnomalySummary> {
  const now = params.now ?? new Date();
  const windowDays = params.windowDays;
  const currentStart = daysAgo(now, windowDays);
  const previousStart = daysAgo(now, windowDays * 2);
  const previousEnd = currentStart;
  const activityStart = daysAgo(now, OPS_ANOMALY_RULES.activityWindowDays);
  const dueSpikeCutoff = daysAgo(now, OPS_ANOMALY_RULES.dueSpikeWindowDays);
  const overdueCutoff = daysAgo(now, OPS_ANOMALY_RULES.overdueAgeDays);
  const overduePrevCutoff = daysAgo(now, OPS_ANOMALY_RULES.overdueAgeDays + OPS_ANOMALY_RULES.dueSpikeWindowDays);

  const paymentScope = params.orgUnitIds.length ? { orgUnitId: { in: params.orgUnitIds } } : {};
  const feeScope = params.orgUnitIds.length ? { orgUnitId: { in: params.orgUnitIds } } : {};
  const enrollmentScope = params.orgUnitIds.length ? { orgUnitId: { in: params.orgUnitIds } } : {};

  const [
    collectionsCurrentAgg,
    collectionsPrevAgg,
    outstandingNowAgg,
    outstandingPrevAgg,
    overdueNow,
    overduePrev,
    transactionsCount,
    enrollmentsCount,
  ] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        ...paymentScope,
        type: 'CREDIT',
        createdAt: { gte: currentStart, lt: now },
      },
    }),
    prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        ...paymentScope,
        type: 'CREDIT',
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
    prisma.studentFeeRecord.aggregate({
      _sum: { amount: true },
      where: {
        ...feeScope,
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: now },
      },
    }),
    prisma.studentFeeRecord.aggregate({
      _sum: { amount: true },
      where: {
        ...feeScope,
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: dueSpikeCutoff },
      },
    }),
    prisma.studentFeeRecord.count({
      where: {
        ...feeScope,
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: overdueCutoff },
      },
    }),
    prisma.studentFeeRecord.count({
      where: {
        ...feeScope,
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: overduePrevCutoff },
      },
    }),
    prisma.paymentTransaction.count({
      where: {
        ...paymentScope,
        type: 'CREDIT',
        createdAt: { gte: activityStart, lt: now },
      },
    }),
    prisma.abacusEnrollment.count({
      where: {
        ...enrollmentScope,
        createdAt: { gte: activityStart, lt: now },
      },
    }),
  ]);

  const metrics: AnomalyMetrics = {
    collectionsCurrent: toNumber(collectionsCurrentAgg._sum.amount),
    collectionsPrevious: toNumber(collectionsPrevAgg._sum.amount),
    outstandingNow: toNumber(outstandingNowAgg._sum.amount),
    outstandingPrevious: toNumber(outstandingPrevAgg._sum.amount),
    overdueCountNow: overdueNow,
    overdueCountPrevious: overduePrev,
    transactionsCount,
    enrollmentsCount,
  };

  return {
    anomalies: buildAnomalies(metrics, windowDays),
    totals: {
      collectionsCurrent: metrics.collectionsCurrent,
      outstanding: metrics.outstandingNow,
      overdueCount: metrics.overdueCountNow,
    },
    windowDays,
  };
}

export async function getOpsAnomaliesByUnit(params: {
  orgUnitIds: number[];
  windowDays: number;
  limit: number;
  offset: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const windowDays = params.windowDays;
  const currentStart = daysAgo(now, windowDays);
  const previousStart = daysAgo(now, windowDays * 2);
  const previousEnd = currentStart;
  const activityStart = daysAgo(now, OPS_ANOMALY_RULES.activityWindowDays);
  const dueSpikeCutoff = daysAgo(now, OPS_ANOMALY_RULES.dueSpikeWindowDays);
  const overdueCutoff = daysAgo(now, OPS_ANOMALY_RULES.overdueAgeDays);
  const overduePrevCutoff = daysAgo(now, OPS_ANOMALY_RULES.overdueAgeDays + OPS_ANOMALY_RULES.dueSpikeWindowDays);

  const orgUnits = await prisma.orgUnit.findMany({
    where: {
      id: { in: params.orgUnitIds },
      type: 'CENTER',
    },
    select: { id: true, code: true, name: true },
  });

  if (!orgUnits.length) {
    return { items: [], total: 0, limit: params.limit, offset: params.offset };
  }

  const targetIds = orgUnits.map((unit) => unit.id);

  const [
    collectionsCurrent,
    collectionsPrevious,
    outstandingNow,
    outstandingPrevious,
    overdueNow,
    overduePrevious,
    activityTransactions,
    activityEnrollments,
  ] = await Promise.all([
    prisma.paymentTransaction.groupBy({
      by: ['orgUnitId'],
      _sum: { amount: true },
      where: {
        orgUnitId: { in: targetIds },
        type: 'CREDIT',
        createdAt: { gte: currentStart, lt: now },
      },
    }),
    prisma.paymentTransaction.groupBy({
      by: ['orgUnitId'],
      _sum: { amount: true },
      where: {
        orgUnitId: { in: targetIds },
        type: 'CREDIT',
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
    prisma.studentFeeRecord.groupBy({
      by: ['orgUnitId'],
      _sum: { amount: true },
      where: {
        orgUnitId: { in: targetIds },
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: now },
      },
    }),
    prisma.studentFeeRecord.groupBy({
      by: ['orgUnitId'],
      _sum: { amount: true },
      where: {
        orgUnitId: { in: targetIds },
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: dueSpikeCutoff },
      },
    }),
    prisma.studentFeeRecord.groupBy({
      by: ['orgUnitId'],
      _count: true,
      where: {
        orgUnitId: { in: targetIds },
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: overdueCutoff },
      },
    }),
    prisma.studentFeeRecord.groupBy({
      by: ['orgUnitId'],
      _count: true,
      where: {
        orgUnitId: { in: targetIds },
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: overduePrevCutoff },
      },
    }),
    prisma.paymentTransaction.groupBy({
      by: ['orgUnitId'],
      _count: true,
      where: {
        orgUnitId: { in: targetIds },
        type: 'CREDIT',
        createdAt: { gte: activityStart, lt: now },
      },
    }),
    prisma.abacusEnrollment.groupBy({
      by: ['orgUnitId'],
      _count: true,
      where: {
        orgUnitId: { in: targetIds },
        createdAt: { gte: activityStart, lt: now },
      },
    }),
  ]);

  const metricsByOrg = new Map<number, AnomalyMetrics>();
  targetIds.forEach((id) => {
    metricsByOrg.set(id, {
      collectionsCurrent: 0,
      collectionsPrevious: 0,
      outstandingNow: 0,
      outstandingPrevious: 0,
      overdueCountNow: 0,
      overdueCountPrevious: 0,
      transactionsCount: 0,
      enrollmentsCount: 0,
    });
  });

  const applySum = (
    rows: Array<{ orgUnitId: number | null; _sum: { amount: number | null } }>,
    key: keyof AnomalyMetrics,
  ) => {
    rows.forEach((row) => {
      if (row.orgUnitId == null) return;
      const metrics = metricsByOrg.get(row.orgUnitId);
      if (metrics) metrics[key] = toNumber(row._sum.amount);
    });
  };

  const applyCount = (rows: Array<{ orgUnitId: number | null; _count: number }>, key: keyof AnomalyMetrics) => {
    rows.forEach((row) => {
      if (row.orgUnitId == null) return;
      const metrics = metricsByOrg.get(row.orgUnitId);
      if (metrics) metrics[key] = row._count;
    });
  };

  applySum(collectionsCurrent, 'collectionsCurrent');
  applySum(collectionsPrevious, 'collectionsPrevious');
  applySum(outstandingNow, 'outstandingNow');
  applySum(outstandingPrevious, 'outstandingPrevious');
  applyCount(overdueNow, 'overdueCountNow');
  applyCount(overduePrevious, 'overdueCountPrevious');
  applyCount(activityTransactions, 'transactionsCount');
  applyCount(activityEnrollments, 'enrollmentsCount');

  const items = orgUnits.map((unit) => {
    const metrics = metricsByOrg.get(unit.id)!;
    const anomalies = buildAnomalies(metrics, windowDays);
    const criticalCount = anomalies.filter((a) => a.severity === 'CRITICAL').length;
    const warnCount = anomalies.filter((a) => a.severity === 'WARN').length;
    const infoCount = anomalies.filter((a) => a.severity === 'INFO').length;
    return {
      orgUnitId: unit.id,
      orgUnitCode: unit.code,
      orgUnitName: unit.name,
      anomalyCount: anomalies.length,
      criticalCount,
      warnCount,
      infoCount,
    };
  });

  items.sort((a, b) => {
    if (b.anomalyCount !== a.anomalyCount) return b.anomalyCount - a.anomalyCount;
    if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
    return a.orgUnitCode.localeCompare(b.orgUnitCode);
  });

  const start = Math.max(params.offset, 0);
  const end = start + params.limit;
  return {
    items: items.slice(start, end),
    total: items.length,
    limit: params.limit,
    offset: params.offset,
  };
}
