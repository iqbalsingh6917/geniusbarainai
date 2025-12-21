import { z } from 'zod';

// Schema for students report query parameters
export const studentsReportSchema = z.object({
  orgUnitId: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

// Schema for enrollments report query parameters
export const enrollmentsReportSchema = z.object({
  orgUnitId: z.string().optional(),
  status: z.string().optional(),
  courseCode: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

// Schema for attendance report query parameters
export const attendanceReportSchema = z.object({
  orgUnitId: z.string().optional(),
  date: z.string().optional(),
  courseCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

// Schema for finance report query parameters
export const financeReportSchema = z.object({
  orgUnitId: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});

export const financeAdvancedReportSchema = z.object({
  orgUnitId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  courseCode: z.string().optional()
});

export const commissionSummarySchema = z.object({
  orgUnitId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  type: z.string().optional(),
  courseCode: z.string().optional()
});

// Schema for assessments report query parameters
export const assessmentsReportSchema = z.object({
  orgUnitId: z.string().optional(),
  courseCode: z.string().optional(),
  levelId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});
