import { z } from 'zod';

// Schema for creating/updating a teacher assignment
export const createTeacherAssignmentSchema = z.object({
  teacherUserId: z.number(),
  studentId: z.number(),
  enrollmentId: z.number().optional()
});

// Schema for updating a teacher assignment
export const updateTeacherAssignmentSchema = z.object({
  enrollmentId: z.number().optional()
});