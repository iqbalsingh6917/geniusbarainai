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