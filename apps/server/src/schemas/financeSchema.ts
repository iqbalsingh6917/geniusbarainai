import { z } from 'zod';

// Schema for finance settings
export const financeSettingsSchema = z.object({
  amountPerStudent: z.number().nonnegative(),
  currency: z.string().min(1)
});

// Schema for creating a transaction
export const createTransactionSchema = z.object({
  orgUnitId: z.number().positive(),
  amount: z.number().positive(),
  method: z.string().optional(),
  notes: z.string().optional()
});

// Schema for center transaction
export const createCenterTransactionSchema = z.object({
  amount: z.number().positive(),
  method: z.string().optional(),
  notes: z.string().optional()
});

const settlementWindowSchema = z
  .object({
    orgUnitId: z.number().int().positive(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    revenueSharePercent: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'periodEnd must be after periodStart',
    path: ['periodEnd'],
  });

export const settlementPreviewSchema = settlementWindowSchema;
export const settlementCreateSchema = settlementWindowSchema;

export const settlementListSchema = z.object({
  orgUnitId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'FINALIZED', 'PAID']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
