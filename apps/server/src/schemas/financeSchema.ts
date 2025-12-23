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

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateInput = (value: unknown, isEnd: boolean) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (dateOnlyRegex.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (isEnd) {
        return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
      }
      return start;
    }
  }
  return value;
};

const settlementWindowSchema = z
  .object({
    orgUnitId: z.number().int().positive(),
    periodStart: z.preprocess((value) => normalizeDateInput(value, false), z.coerce.date()),
    periodEnd: z.preprocess((value) => normalizeDateInput(value, true), z.coerce.date()),
    revenueSharePercent: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: 'periodEnd must be after periodStart',
    path: ['periodEnd'],
  });

export const settlementPreviewSchema = settlementWindowSchema;
export const settlementCreateSchema = settlementWindowSchema;

export const settlementListSchema = z.object({
  orgUnitId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'FINALIZED', 'PAID']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID']).optional(),
  periodStart: z.preprocess((value) => normalizeDateInput(value, false), z.coerce.date()).optional(),
  periodEnd: z.preprocess((value) => normalizeDateInput(value, true), z.coerce.date()).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).refine((data) => {
  if (data.periodStart && data.periodEnd) {
    return data.periodEnd > data.periodStart;
  }
  return true;
}, {
  message: 'periodEnd must be after periodStart',
  path: ['periodEnd'],
});

export const settlementMarkPaidSchema = z.object({
  paymentRef: z.string().trim().min(1).max(120).optional(),
});
