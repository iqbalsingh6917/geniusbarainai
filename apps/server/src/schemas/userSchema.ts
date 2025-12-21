import { z } from 'zod';

// Schema for creating a user
export const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'ADMISSIONS', 'TEACHER']),
  orgUnitId: z.number().optional()
});

// Schema for updating a user
export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'ADMISSIONS', 'TEACHER']).optional(),
  orgUnitId: z.number().optional(),
  isActive: z.boolean().optional()
});

// Schema for changing password
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});