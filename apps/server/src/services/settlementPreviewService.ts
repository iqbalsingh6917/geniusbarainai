import prisma from '../prismaClient';

export type SettlementWarning = {
  code: string;
  message: string;
};

export type SettlementPreview = {
  orgUnitId: number;
  periodStart: Date;
  periodEnd: Date;
  grossCollected: number;
  refunds: number;
  adjustments: number;
  netCollected: number;
  revenueSharePercent: number;
  revenueShareAmount: number;
  netPayable: number;
  warnings: SettlementWarning[];
  breakdown: {
    collectionsCount: number;
    duesRaised: number;
    outstandingAmount: number;
  };
};

export const SETTLEMENT_DEFAULTS = {
  revenueSharePercent: 0,
} as const;

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

export async function computeSettlementPreview(params: {
  orgUnitId: number;
  periodStart: Date;
  periodEnd: Date;
  revenueSharePercent?: number;
}): Promise<SettlementPreview> {
  const { orgUnitId, periodStart, periodEnd } = params;

  const [collectionsAgg, collectionsCount, duesRaisedAgg, outstandingAgg] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        orgUnitId,
        type: 'CREDIT',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.paymentTransaction.count({
      where: {
        orgUnitId,
        type: 'CREDIT',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.studentFeeRecord.aggregate({
      _sum: { amount: true },
      where: {
        orgUnitId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.studentFeeRecord.aggregate({
      _sum: { amount: true },
      where: {
        orgUnitId,
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { lte: periodEnd },
      },
    }),
  ]);

  const grossCollected = toNumber(collectionsAgg._sum.amount);
  const duesRaised = toNumber(duesRaisedAgg._sum.amount);
  const outstandingAmount = toNumber(outstandingAgg._sum.amount);

  const refunds = 0;
  const adjustments = 0;
  const netCollected = Math.max(0, grossCollected - refunds - adjustments);

  const revenueSharePercent =
    typeof params.revenueSharePercent === 'number'
      ? params.revenueSharePercent
      : SETTLEMENT_DEFAULTS.revenueSharePercent;
  const revenueShareAmount = Math.round((netCollected * revenueSharePercent) / 100);
  const netPayable = revenueShareAmount;

  const warnings: SettlementWarning[] = [];
  if (revenueSharePercent === 0) {
    warnings.push({
      code: 'REVENUE_SHARE_UNCONFIGURED',
      message: 'Revenue share percent is not configured; defaulting to 0%.',
    });
  }
  if (duesRaised > 0 && grossCollected === 0) {
    warnings.push({
      code: 'NO_COLLECTIONS_RECORDED',
      message: 'Dues were raised in this period but no collections were recorded.',
    });
  }
  if (duesRaised > 0 && grossCollected > duesRaised) {
    warnings.push({
      code: 'COLLECTIONS_EXCEED_DUES',
      message: 'Collections exceed dues raised in this period; verify adjustments or timing.',
    });
  }
  if (outstandingAmount > 0 && grossCollected === 0) {
    warnings.push({
      code: 'OUTSTANDING_DUES_PRESENT',
      message: 'Outstanding dues exist with no collections in this period.',
    });
  }

  return {
    orgUnitId,
    periodStart,
    periodEnd,
    grossCollected,
    refunds,
    adjustments,
    netCollected,
    revenueSharePercent,
    revenueShareAmount,
    netPayable,
    warnings,
    breakdown: {
      collectionsCount,
      duesRaised,
      outstandingAmount,
    },
  };
}
