import { z } from 'zod';

// Schema for creating an organization unit
export const createOrgUnitSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER']),
  parentId: z.number().optional()
});

// Schema for updating an organization unit
export const updateOrgUnitSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  type: z.enum(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER']).optional(),
  parentId: z.number().optional()
});
