import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { requireAssessmentCreate, requireProgressUpdate } from '../middleware/permissions';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const updateProgressSchema = z.object({
  currentModuleId: z.number().optional(),
  currentLevelId: z.number().optional(),
  status: z.string().optional(),
});

const addAssessmentSchema = z.object({
  enrollmentId: z.number(),
  levelId: z.number(),
  scorePercent: z.number().min(0).max(100),
  passed: z.boolean(),
  remarks: z.string().optional(),
  attemptDate: z.string().optional(), // ISO date string
});

// Middleware to ensure only teachers can access these routes
const teacherOnly = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user) {
    return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  if (req.user.role !== 'TEACHER') {
    return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
  }
  
  next();
};

// GET /teacher/abacus/students
// Returns students in the teacher's org unit (center)
router.get('/students', authRequired, teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get allowed org units for the teacher (their center)
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    
    let studentsQuery = `
      SELECT 
        s."id",
        s."code",
        s."firstName",
        s."lastName",
        s."age",
        s."status",
        s."orgUnitId",
        o."name" as "orgUnitName",
        COUNT(e."id") as "enrollmentsCount"
      FROM "Student" s
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId"
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
    `;
    
    const queryParams: any[] = [];
    
    // Filter by allowed org units
    if (allowedOrgUnits.length > 0) {
      studentsQuery += ` WHERE s."orgUnitId" = ANY($1)`;
      queryParams.push(allowedOrgUnits);
    } else {
      // If no allowed org units, return empty result
      studentsQuery += ` WHERE FALSE`;
    }
    
    studentsQuery += `
      GROUP BY s."id", s."code", s."firstName", s."lastName", s."age", s."status", s."orgUnitId", o."name"
      ORDER BY s."createdAt" DESC
    `;
    
    const students: any[] = await prisma.$queryRawUnsafe(studentsQuery, ...queryParams);
    
    // Convert BigInt to Number for enrollmentsCount
    const formattedStudents = students.map((student: any) => ({
      ...student,
      enrollmentsCount: parseInt(student.enrollmentsCount.toString())
    }));

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_STUDENTS_VIEWED',
      entityType: 'Student',
      meta: {
        teacherId: req.user?.id,
        orgUnitId: req.user?.orgUnitId,
        resultsCount: formattedStudents.length
      }
    });

    ok(res, formattedStudents);
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /teacher/abacus/enrollments
// Returns enrollments in the teacher's org unit (center)
router.get('/enrollments', authRequired, teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get allowed org units for the teacher (their center)
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    
    let enrollmentsQuery = `
      SELECT 
        e."id",
        e."status",
        e."startDate",
        e."endDate",
        e."orgUnitId",
        o."name" as "orgUnitName",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName" as "studentFirstName",
        s."lastName" as "studentLastName",
        c."id" as "courseId",
        c."code" as "courseCode",
        c."name" as "courseName",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      LEFT JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
    `;
    
    const queryParams: any[] = [];
    
    // Filter by allowed org units
    if (allowedOrgUnits.length > 0) {
      enrollmentsQuery += ` WHERE e."orgUnitId" = ANY($1)`;
      queryParams.push(allowedOrgUnits);
    } else {
      // If no allowed org units, return empty result
      enrollmentsQuery += ` WHERE FALSE`;
    }
    
    enrollmentsQuery += ` ORDER BY e."startDate" DESC`;
    
    const enrollments: any = await prisma.$queryRawUnsafe(enrollmentsQuery, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ENROLLMENTS_VIEWED',
      entityType: 'AbacusEnrollment',
      meta: {
        teacherId: req.user?.id,
        orgUnitId: req.user?.orgUnitId,
        resultsCount: enrollments.length
      }
    });

    ok(res, enrollments);
  } catch (error) {
    console.error('Error fetching teacher enrollments:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /teacher/abacus/enrollments/:id/progress
// Update progress for an enrollment (limited fields)
router.put('/enrollments/:id/progress', authRequired, teacherOnly, requireProgressUpdate, async (req: AuthRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    
    if (isNaN(enrollmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollment ID');
    }
    
    // Validate input
    const validatedData = updateProgressSchema.parse(req.body);
    
    // Check if enrollment exists and belongs to teacher's org unit
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    
    let enrollmentQuery = `
      SELECT e.* 
      FROM "AbacusEnrollment" e
      WHERE e."id" = $1
    `;
    
    const enrollmentParams: any[] = [enrollmentId];
    
    if (allowedOrgUnits.length > 0) {
      enrollmentQuery += ` AND e."orgUnitId" = ANY($2)`;
      enrollmentParams.push(allowedOrgUnits);
    } else {
      enrollmentQuery += ` AND FALSE`;
    }
    
    const enrollmentResult: any = await prisma.$queryRawUnsafe(enrollmentQuery, ...enrollmentParams);
    
    if (enrollmentResult.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found or access denied');
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    
    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`"${key}" = $${updates.length + 1}`);
        values.push(value);
      }
    });
    
    if (updates.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');
    }
    
    updates.push('"updatedAt" = NOW()');
    
    // Update enrollment
    const updatedEnrollment: any = await prisma.$queryRawUnsafe(
      `UPDATE "AbacusEnrollment" SET ${updates.join(', ')} WHERE "id" = $${updates.length + 1} RETURNING *`,
      ...values,
      enrollmentId
    );

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ENROLLMENT_PROGRESS_UPDATED',
      entityType: 'AbacusEnrollment',
      entityId: enrollmentId,
      meta: {
        teacherId: req.user?.id,
        orgUnitId: req.user?.orgUnitId,
        updatedFields: Object.keys(validatedData)
      }
    });

    ok(res, updatedEnrollment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating enrollment progress:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /teacher/abacus/assessments
// Add a new assessment for an enrollment
router.post('/assessments', authRequired, teacherOnly, requireAssessmentCreate, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = addAssessmentSchema.parse(req.body);
    
    // Check if enrollment exists and belongs to teacher's org unit
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    
    let enrollmentQuery = `
      SELECT e.* 
      FROM "AbacusEnrollment" e
      WHERE e."id" = $1
    `;
    
    const enrollmentParams: any[] = [validatedData.enrollmentId];
    
    if (allowedOrgUnits.length > 0) {
      enrollmentQuery += ` AND e."orgUnitId" = ANY($2)`;
      enrollmentParams.push(allowedOrgUnits);
    } else {
      enrollmentQuery += ` AND FALSE`;
    }
    
    const enrollmentResult: any = await prisma.$queryRawUnsafe(enrollmentQuery, ...enrollmentParams);
    
    if (enrollmentResult.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found or access denied');
    }
    
    // Check if level exists
    const levelResult: any = await prisma.$queryRaw`
      SELECT * FROM "AbacusLevel" WHERE "id" = ${validatedData.levelId}
    `;
    
    if (levelResult.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Level not found');
    }
    
    // Create assessment
    const newAssessment: any = await prisma.$queryRaw`
      INSERT INTO "AbacusAssessment" (
        "enrollmentId", "levelId", "scorePercent", "passed", "remarks", "attemptDate", "createdAt", "updatedAt"
      ) VALUES (
        ${validatedData.enrollmentId}, ${validatedData.levelId}, 
        ${validatedData.scorePercent}, ${validatedData.passed},
        ${validatedData.remarks || null}, 
        ${validatedData.attemptDate ? new Date(validatedData.attemptDate) : new Date()}, 
        NOW(), NOW()
      ) RETURNING *
    `;

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSESSMENT_ADDED',
      entityType: 'AbacusAssessment',
      entityId: newAssessment.id,
      meta: {
        teacherId: req.user?.id,
        orgUnitId: req.user?.orgUnitId,
        enrollmentId: validatedData.enrollmentId,
        levelId: validatedData.levelId,
        scorePercent: validatedData.scorePercent,
        passed: validatedData.passed
      }
    });

    ok(res, newAssessment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating assessment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /teacher/abacus/assessments/:enrollmentId
// Get assessments for a specific enrollment
router.get('/assessments/:enrollmentId', authRequired, teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId);
    
    if (isNaN(enrollmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollment ID');
    }
    
    // Check if enrollment exists and belongs to teacher's org unit
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    
    let enrollmentQuery = `
      SELECT e.* 
      FROM "AbacusEnrollment" e
      WHERE e."id" = $1
    `;
    
    const enrollmentParams: any[] = [enrollmentId];
    
    if (allowedOrgUnits.length > 0) {
      enrollmentQuery += ` AND e."orgUnitId" = ANY($2)`;
      enrollmentParams.push(allowedOrgUnits);
    } else {
      enrollmentQuery += ` AND FALSE`;
    }
    
    const enrollmentResult: any = await prisma.$queryRawUnsafe(enrollmentQuery, ...enrollmentParams);
    
    if (enrollmentResult.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found or access denied');
    }
    
    // Get assessments
    const assessments: any = await prisma.$queryRaw`
      SELECT * FROM "AbacusAssessment" WHERE "enrollmentId" = ${enrollmentId}
    `;

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSESSMENTS_VIEWED',
      entityType: 'AbacusAssessment',
      meta: {
        teacherId: req.user?.id,
        orgUnitId: req.user?.orgUnitId,
        enrollmentId: enrollmentId,
        resultsCount: assessments.length
      }
    });

    ok(res, assessments);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;