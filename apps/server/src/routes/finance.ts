import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { 
  isBusinessPartner, 
  isFranchise, 
  isCenterManager, 
  isAdmissions, 
  isTeacher 
} from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import {
  financeSettingsSchema,
  createTransactionSchema,
  createCenterTransactionSchema,
  settlementPreviewSchema,
  settlementCreateSchema,
  settlementListSchema,
  settlementMarkPaidSchema,
} from '../schemas/financeSchema';
import { computeSettlementPreview } from '../services/settlementPreviewService';
import { isSuperadmin } from '../constants/roles';

const router = Router();
const prisma = new PrismaClient();
const canAccessSettlements = (role?: string) =>
  !!role && (isSuperadmin(role) || isBusinessPartner(role) || isFranchise(role) || isCenterManager(role));

// GET /superadmin/finance/settings
// Role: SUPERADMIN only
router.get('/settings', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get the current fee setting
    const feeSettings: any = await prisma.$queryRaw`
      SELECT * FROM "FeeSetting" ORDER BY "updatedAt" DESC LIMIT 1
    `;
    
    const feeSetting = feeSettings.length > 0 ? feeSettings[0] : null;

    // If no fee setting exists, return default values
    if (!feeSetting) {
      // Log audit
      await logAudit(req, {
        action: 'FINANCE_SETTINGS_VIEWED',
        entityType: 'FeeSetting',
        meta: { settingsExist: false }
      });
      
      return ok(res, {
        amountPerStudent: 0,
        currency: 'INR'
      });
    }

    // Log audit
    await logAudit(req, {
      action: 'FINANCE_SETTINGS_VIEWED',
      entityType: 'FeeSetting',
      meta: { settingsExist: true, amountPerStudent: feeSetting.amountPerStudent, currency: feeSetting.currency }
    });

    ok(res, {
      amountPerStudent: feeSetting.amountPerStudent,
      currency: feeSetting.currency
    });
  } catch (error) {
    console.error('Error fetching fee settings:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /superadmin/finance/settings
// Role: SUPERADMIN only
router.put('/settings', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = financeSettingsSchema.parse(req.body);

    // Create or update fee setting
    const feeSetting: any = await prisma.$queryRaw`
      INSERT INTO "FeeSetting" (
        "amountPerStudent", "currency", "updatedAt"
      ) VALUES (
        ${validatedData.amountPerStudent}, ${validatedData.currency}, NOW()
      ) RETURNING *
    `;
    
    const feeSettingResult = feeSetting[0];

    // Log audit
    await logAudit(req, {
      action: 'FINANCE_SETTINGS_UPDATED',
      entityType: 'FeeSetting',
      meta: { amountPerStudent: feeSettingResult.amountPerStudent, currency: feeSettingResult.currency }
    });

    ok(res, feeSettingResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating fee settings:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/finance/dues
// Role: SUPERADMIN only
router.get('/dues', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get all centers and their outstanding dues
    const centersQuery = `
      SELECT 
        o."id",
        o."code",
        o."name",
        COUNT(sfr."id") as "totalStudents",
        SUM(CASE WHEN sfr."status" IN ('PENDING','PARTIAL') THEN sfr."amount" ELSE 0 END) as "outstandingAmount"
      FROM "OrgUnit" o
      LEFT JOIN "StudentFeeRecord" sfr ON o."id" = sfr."orgUnitId"
      WHERE o."type" = 'CENTER'
      GROUP BY o."id", o."code", o."name"
      ORDER BY o."code"
    `;

    const centers: any = await prisma.$queryRawUnsafe(centersQuery);

    // Convert BigInt to Number
    const formattedCenters = centers.map((center: any) => ({
      ...center,
      totalStudents: parseInt(center.totalStudents?.toString() || '0') || 0,
      outstandingAmount: parseInt(center.outstandingAmount?.toString() || '0') || 0
    }));

    // Log audit
    await logAudit(req, {
      action: 'FINANCE_DUES_VIEWED',
      entityType: 'StudentFeeRecord',
      meta: { centersCount: formattedCenters.length }
    });

    ok(res, formattedCenters);
  } catch (error) {
    console.error('Error fetching dues:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/finance/transactions
// Role: SUPERADMIN only
router.get('/transactions', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get all payment transactions
    const transactionsQuery = `
      SELECT 
        pt."id",
        pt."amount",
        pt."type",
        pt."method",
        pt."notes",
        pt."createdAt",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "PaymentTransaction" pt
      JOIN "OrgUnit" o ON pt."orgUnitId" = o."id"
      ORDER BY pt."createdAt" DESC
    `;

    const transactions: any = await prisma.$queryRawUnsafe(transactionsQuery);

    // Convert BigInt to Number
    const formattedTransactions = transactions.map((transaction: any) => ({
      ...transaction,
      amount: parseInt(transaction.amount?.toString() || '0') || 0
    }));

    // Log audit
    await logAudit(req, {
      action: 'FINANCE_TRANSACTIONS_VIEWED',
      entityType: 'PaymentTransaction',
      meta: { transactionsCount: formattedTransactions.length }
    });

    ok(res, formattedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/finance/transactions
// Role: SUPERADMIN only
router.post('/transactions', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = createTransactionSchema.parse(req.body);

    // Check if org unit exists and is a center
    const orgUnit: any = await prisma.$queryRaw`
      SELECT * FROM "OrgUnit" WHERE "id" = ${validatedData.orgUnitId} AND "type" = 'CENTER'
    `;

    if (orgUnit.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId - must be a center');
    }

    // Create payment transaction
    const transaction: any = await prisma.$queryRaw`
      INSERT INTO "PaymentTransaction" (
        "orgUnitId", "amount", "type", "method", "notes", "createdAt"
      ) VALUES (
        ${validatedData.orgUnitId}, ${validatedData.amount}, 'CREDIT', ${validatedData.method || null}, ${validatedData.notes || null}, NOW()
      ) RETURNING *
    `;

    // Log audit
    await logAudit(req, {
      action: 'FINANCE_TRANSACTION_CREATED',
      entityType: 'PaymentTransaction',
      entityId: transaction[0].id,
      meta: { 
        orgUnitId: validatedData.orgUnitId, 
        amount: transaction[0].amount, 
        type: transaction[0].type, 
        method: transaction[0].method 
      }
    });

    ok(res, transaction[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating transaction:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/finance/settlements/preview
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.post('/settlements/preview', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const parsed = settlementPreviewSchema.parse(req.body);
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    if (!allowedOrgUnits.includes(parsed.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    const preview = await computeSettlementPreview({
      orgUnitId: parsed.orgUnitId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      revenueSharePercent: parsed.revenueSharePercent,
    });

    await logAudit(req, {
      action: 'SETTLEMENT_PREVIEW_VIEWED',
      entityType: 'Settlement',
      meta: {
        orgUnitId: parsed.orgUnitId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
      },
    });

    ok(res, preview);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error computing settlement preview:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/finance/settlements
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.post('/settlements', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const parsed = settlementCreateSchema.parse(req.body);
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    if (!allowedOrgUnits.includes(parsed.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    const preview = await computeSettlementPreview({
      orgUnitId: parsed.orgUnitId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      revenueSharePercent: parsed.revenueSharePercent,
    });

    const settlement = await prisma.settlement.create({
      data: {
        orgUnitId: preview.orgUnitId,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        grossCollected: preview.grossCollected,
        refunds: preview.refunds,
        adjustments: preview.adjustments,
        netCollected: preview.netCollected,
        revenueSharePercent: preview.revenueSharePercent,
        revenueShareAmount: preview.revenueShareAmount,
        netPayable: preview.netPayable,
        breakdown: preview.breakdown,
        warnings: preview.warnings,
        status: 'DRAFT',
        computedAt: new Date(),
      },
    });

    await logAudit(req, {
      action: 'SETTLEMENT_DRAFT_CREATED',
      entityType: 'Settlement',
      entityId: settlement.id,
      meta: {
        orgUnitId: settlement.orgUnitId,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        grossCollected: settlement.grossCollected,
        netPayable: settlement.netPayable,
        status: settlement.status,
      },
    });

    ok(res, settlement, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(res, 409, 'ALREADY_EXISTS', 'Settlement already exists for this period');
    }
    console.error('Error creating settlement draft:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/finance/settlements
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.get('/settlements', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const parsed = settlementListSchema.parse(req.query);
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    if (parsed.orgUnitId && !allowedOrgUnits.includes(parsed.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    const limit = parsed.limit ?? 20;
    const offset = parsed.offset ?? 0;

    const where: any = { orgUnitId: { in: allowedOrgUnits } };
    if (parsed.orgUnitId) {
      where.orgUnitId = parsed.orgUnitId;
    }
    if (parsed.status) {
      where.status = parsed.status;
    }
    if (parsed.paymentStatus) {
      where.paymentStatus = parsed.paymentStatus;
    }

    const [items, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.settlement.count({ where }),
    ]);

    await logAudit(req, {
      action: 'SETTLEMENTS_LIST_VIEWED',
      entityType: 'Settlement',
      meta: {
        limit,
        offset,
        status: parsed.status ?? null,
        paymentStatus: parsed.paymentStatus ?? null,
        orgUnitId: parsed.orgUnitId ?? null,
        orgUnitCount: allowedOrgUnits.length,
      },
    });

    ok(res, { items, total, limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching settlements list:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/finance/settlements/:id
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.get('/settlements/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const settlementId = Number(req.params.id);
    if (!Number.isInteger(settlementId) || settlementId <= 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid settlement id');
    }

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) {
      return fail(res, 404, 'NOT_FOUND', 'Settlement not found');
    }

    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);
    if (!allowedOrgUnits.includes(settlement.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    await logAudit(req, {
      action: 'SETTLEMENT_VIEWED',
      entityType: 'Settlement',
      entityId: settlement.id,
      meta: { orgUnitId: settlement.orgUnitId, status: settlement.status },
    });

    ok(res, settlement);
  } catch (error) {
    console.error('Error fetching settlement:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/finance/settlements/:id/finalize
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.post('/settlements/:id/finalize', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const settlementId = Number(req.params.id);
    if (!Number.isInteger(settlementId) || settlementId <= 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid settlement id');
    }

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) {
      return fail(res, 404, 'NOT_FOUND', 'Settlement not found');
    }

    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);
    if (!allowedOrgUnits.includes(settlement.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    if (settlement.status !== 'DRAFT') {
      return fail(res, 409, 'INVALID_STATUS', `Settlement is already ${settlement.status}`);
    }

    const overlapping = await prisma.settlement.findFirst({
      where: {
        orgUnitId: settlement.orgUnitId,
        status: 'FINALIZED',
        NOT: { id: settlement.id },
        periodStart: { lt: settlement.periodEnd },
        periodEnd: { gt: settlement.periodStart },
      },
    });

    if (overlapping) {
      return fail(
        res,
        409,
        'OVERLAPPING_FINALIZED_SETTLEMENT',
        'A finalized settlement already covers part of this period',
      );
    }

    const preview = await computeSettlementPreview({
      orgUnitId: settlement.orgUnitId,
      periodStart: settlement.periodStart,
      periodEnd: settlement.periodEnd,
      revenueSharePercent: settlement.revenueSharePercent,
    });

    const updateResult = await prisma.settlement.updateMany({
      where: { id: settlement.id, status: 'DRAFT' },
      data: {
        grossCollected: preview.grossCollected,
        refunds: preview.refunds,
        adjustments: preview.adjustments,
        netCollected: preview.netCollected,
        revenueSharePercent: preview.revenueSharePercent,
        revenueShareAmount: preview.revenueShareAmount,
        netPayable: preview.netPayable,
        breakdown: preview.breakdown,
        warnings: preview.warnings,
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedByUserId: req.user.id ?? null,
        computedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return fail(res, 409, 'INVALID_STATUS', 'Settlement is no longer in DRAFT status');
    }

    const finalized = await prisma.settlement.findUnique({ where: { id: settlement.id } });

    await logAudit(req, {
      action: 'SETTLEMENT_FINALIZED',
      entityType: 'Settlement',
      entityId: settlement.id,
      meta: {
        orgUnitId: settlement.orgUnitId,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        grossCollected: preview.grossCollected,
        netPayable: preview.netPayable,
        status: 'FINALIZED',
      },
    });

    ok(res, finalized);
  } catch (error) {
    console.error('Error finalizing settlement:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/finance/settlements/:id/mark-paid
// Role: SUPERADMIN, BUSINESS_PARTNER, FRANCHISE, CENTER_MANAGER
router.post('/settlements/:id/mark-paid', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !canAccessSettlements(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const settlementId = Number(req.params.id);
    if (!Number.isInteger(settlementId) || settlementId <= 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid settlement id');
    }

    const parsed = settlementMarkPaidSchema.parse(req.body ?? {});

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) {
      return fail(res, 404, 'NOT_FOUND', 'Settlement not found');
    }

    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);
    if (!allowedOrgUnits.includes(settlement.orgUnitId)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
    }

    if (settlement.status !== 'FINALIZED') {
      return fail(res, 409, 'INVALID_STATUS', 'Settlement must be finalized before marking paid');
    }

    if (settlement.paymentStatus === 'PAID' || settlement.paidAt) {
      return fail(res, 409, 'ALREADY_PAID', 'Settlement is already marked paid');
    }

    if (settlement.netPayable < 0) {
      return fail(res, 409, 'INVALID_AMOUNT', 'Settlement net payable must be non-negative');
    }

    const updateResult = await prisma.settlement.updateMany({
      where: { id: settlement.id, status: 'FINALIZED', paymentStatus: 'UNPAID' },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
        paidByUserId: req.user.id ?? null,
        paymentRef: parsed.paymentRef ?? null,
      },
    });

    if (updateResult.count === 0) {
      return fail(res, 409, 'ALREADY_PAID', 'Settlement is already marked paid');
    }

    const updated = await prisma.settlement.findUnique({ where: { id: settlement.id } });

    await logAudit(req, {
      action: 'SETTLEMENT_MARKED_PAID',
      entityType: 'Settlement',
      entityId: settlement.id,
      meta: {
        orgUnitId: settlement.orgUnitId,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        netPayable: settlement.netPayable,
        paymentRef: parsed.paymentRef ?? null,
      },
    });

    ok(res, updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error marking settlement paid:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /center/finance
// Role: CENTER_MANAGER or ADMISSIONS
router.get('/center', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Get center's outstanding dues
    const duesQuery = `
      SELECT 
        COUNT(sfr."id") as "totalStudents",
        SUM(CASE WHEN sfr."status" IN ('PENDING','PARTIAL') THEN sfr."amount" ELSE 0 END) as "outstandingAmount"
      FROM "StudentFeeRecord" sfr
      WHERE sfr."orgUnitId" = $1
    `;

    const duesResult: any = await prisma.$queryRawUnsafe(duesQuery, req.user.orgUnitId);
    const dues = duesResult[0];

    // Log audit
    await logAudit(req, {
      action: 'CENTER_FINANCE_VIEWED',
      entityType: 'StudentFeeRecord',
      meta: { 
        orgUnitId: req.user.orgUnitId,
        totalStudents: parseInt(dues.totalStudents?.toString() || '0') || 0,
        outstandingAmount: parseInt(dues.outstandingAmount?.toString() || '0') || 0
      }
    });

    ok(res, {
      totalStudents: parseInt(dues.totalStudents?.toString() || '0') || 0,
      outstandingAmount: parseInt(dues.outstandingAmount?.toString() || '0') || 0
    });
  } catch (error) {
    console.error('Error fetching center dues:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /center/finance/transactions
// Role: CENTER_MANAGER or ADMISSIONS
router.post('/center/transactions', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Validate input
    const validatedData = createCenterTransactionSchema.parse(req.body);

    // Create payment transaction
    const transaction: any = await prisma.$queryRaw`
      INSERT INTO "PaymentTransaction" (
        "orgUnitId", "amount", "type", "method", "notes", "createdAt"
      ) VALUES (
        ${req.user.orgUnitId}, ${validatedData.amount}, 'CREDIT', ${validatedData.method || null}, ${validatedData.notes || null}, NOW()
      ) RETURNING *
    `;

    // Reduce outstanding dues starting with the oldest pending records
    let remaining = validatedData.amount;
    const pendingFees = await prisma.studentFeeRecord.findMany({
      where: { orgUnitId: req.user.orgUnitId, status: { in: ['PENDING', 'PARTIAL'] } },
      orderBy: { createdAt: 'asc' },
    });

    for (const fee of pendingFees) {
      if (remaining <= 0) break;
      if (remaining >= fee.amount) {
        remaining -= fee.amount;
        await prisma.studentFeeRecord.update({
          where: { id: fee.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
      } else {
        await prisma.studentFeeRecord.update({
          where: { id: fee.id },
          data: { amount: fee.amount - remaining, status: 'PARTIAL' },
        });
        remaining = 0;
      }
    }

    // Log audit
    await logAudit(req, {
      action: 'CENTER_TRANSACTION_CREATED',
      entityType: 'PaymentTransaction',
      entityId: transaction[0].id,
      meta: { 
        orgUnitId: req.user.orgUnitId,
        amount: transaction[0].amount,
        method: transaction[0].method
      }
    });

    ok(res, transaction[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating center transaction:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
