import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';

type CommissionType = 'LEAD' | 'ENROLLMENT';

type CommissionRecordInput = {
  orgUnitId: number;
  type: CommissionType;
  entityType: CommissionType;
  entityId: number;
  courseId?: number | null;
  courseCode?: string | null;
  meta?: Prisma.InputJsonValue;
};

export async function createCommissionRecord(input: CommissionRecordInput) {
  const rule = await prisma.commissionRule.findFirst({
    where: { orgUnitId: input.orgUnitId, type: input.type, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!rule) return null;

  const ruleSnapshot = {
    id: rule.id,
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
  };
  const meta =
    input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
      ? { ...(input.meta as Record<string, unknown>), ruleSnapshot }
      : (input.meta ?? { ruleSnapshot });

  try {
    return await prisma.commissionRecord.create({
      data: {
        orgUnitId: input.orgUnitId,
        ruleId: rule.id,
        entityType: input.entityType,
        entityId: input.entityId,
        courseId: input.courseId ?? null,
        courseCode: input.courseCode ?? null,
        amount: rule.amount,
        currency: rule.currency,
        meta,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return null;
    }
    throw err;
  }
}
