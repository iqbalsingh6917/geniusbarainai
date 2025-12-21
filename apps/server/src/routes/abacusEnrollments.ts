import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { getEffectiveOrgUnitId } from '../services/orgScope';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { generateStudentFeeRecord } from '../services/financeService';
import { 
  requireEnrollmentCRUD, 
  requireAssessmentCreate,
  requireProgressUpdate
} from '../middleware/permissions';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { incrementLicenseSeat, decrementLicenseSeat, hasAvailableSeatForEnrollment } from '../services/licensingService';

const router = Router();
const prisma = new PrismaClient();

async function getTeacherScope(teacherUserId: number) {
  const assignments = await prisma.teacherStudentAssignment.findMany({
    where: { teacherUserId },
    select: { studentId: true, enrollmentId: true },
  });
  const studentIds = Array.from(new Set(assignments.map((a) => a.studentId).filter(Boolean)));
  const enrollmentIds = Array.from(new Set(assignments.map((a) => a.enrollmentId).filter((v): v is number => !!v)));
  return { studentIds, enrollmentIds };
}

// Validation schemas
const createEnrollmentSchema = z.object({
  studentId: z.number(),
  courseId: z.number(),
  currentModuleId: z.number().optional(),
  currentLevelId: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  // TODO_ROLE_SPLIT: Add orgUnitId for role-based scoping
  orgUnitId: z.number().optional(), // For SUPERADMIN to specify org unit
});

const updateEnrollmentSchema = z.object({
  currentModuleId: z.number().optional(),
  currentLevelId: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  // TODO_ROLE_SPLIT: Add orgUnitId for role-based scoping
  orgUnitId: z.number().optional(), // For SUPERADMIN to specify org unit
});

// GET /superadmin/abacus/enrollments
// Return a list of enrollments with student, course, module, and level info
router.get('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Get effective org unit ID (for future role-based scoping)
    const queryOrgUnitId = req.query.orgUnitId ? parseInt(req.query.orgUnitId as string) : undefined;
    const effectiveOrgUnitId = getEffectiveOrgUnitId(req.user!, queryOrgUnitId);
    
    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    const isTeacher = req.user!.role === 'TEACHER';
    const teacherScope = isTeacher ? await getTeacherScope(req.user!.id) : { studentIds: [], enrollmentIds: [] };
    
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
    
    if (isTeacher) {
      if (teacherScope.enrollmentIds.length > 0) {
        enrollmentsQuery += ` WHERE e."id" = ANY($1)`;
        queryParams.push(teacherScope.enrollmentIds);
      } else if (teacherScope.studentIds.length > 0) {
        enrollmentsQuery += ` WHERE e."studentId" = ANY($1)`;
        queryParams.push(teacherScope.studentIds);
      } else {
        enrollmentsQuery += ` WHERE FALSE`;
      }
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        enrollmentsQuery += ` WHERE e."orgUnitId" = ANY($1)`;
        queryParams.push(allowedOrgUnits);
      } else {
        enrollmentsQuery += ` WHERE FALSE`;
      }
    } else if (effectiveOrgUnitId) {
      enrollmentsQuery += ` WHERE e."orgUnitId" = $1`;
      queryParams.push(effectiveOrgUnitId);
    }
    
    enrollmentsQuery += ` ORDER BY e."startDate" DESC`;
    
    const enrollments: any = await prisma.$queryRawUnsafe(enrollmentsQuery, ...queryParams);
    
    // Log audit
    await logAudit(req, {
      action: 'ENROLLMENT_LIST_VIEWED',
      entityType: 'AbacusEnrollment',
      meta: { 
        orgUnitId: effectiveOrgUnitId,
        userRole: req.user!.role,
        resultsCount: enrollments.length
      }
    });
    
    ok(res, enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/abacus/enrollments
// Creates a new enrollment
router.post('/', authRequired, requireEnrollmentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = createEnrollmentSchema.parse(req.body);
    
    // Check if student exists
    const studentResult: any = await prisma.$queryRaw`
      SELECT * FROM "Student" WHERE "id" = ${validatedData.studentId}
    `;
    
    if (studentResult.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Student not found');
    }
    
    // Check if course exists
    const courseResult: any = await prisma.$queryRaw`
      SELECT * FROM "AbacusCourse" WHERE "id" = ${validatedData.courseId}
    `;
    
    if (courseResult.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Course not found');
    }
    
    // Check if module exists (if provided)
    if (validatedData.currentModuleId) {
      const moduleResult: any = await prisma.$queryRaw`
        SELECT * FROM "AbacusModule" WHERE "id" = ${validatedData.currentModuleId}
      `;
      
      if (moduleResult.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Module not found');
      }
    }
    
    // Check if level exists (if provided)
    if (validatedData.currentLevelId) {
      const levelResult: any = await prisma.$queryRaw`
        SELECT * FROM "AbacusLevel" WHERE "id" = ${validatedData.currentLevelId}
      `;
      
      if (levelResult.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Level not found');
      }
    }
    
    // Determine orgUnitId - if not provided, default to user's org unit
    let orgUnitId = validatedData.orgUnitId;
    if (!orgUnitId && req.user!.orgUnitId) {
      orgUnitId = req.user!.orgUnitId;
    }
    
    // If still no orgUnitId, use default center (CE001)
    if (!orgUnitId) {
      const defaultCenter: any = await prisma.$queryRaw`
        SELECT "id" FROM "OrgUnit" WHERE "code" = 'CE001'
      `;
      
      if (defaultCenter.length > 0) {
        orgUnitId = defaultCenter[0].id;
      }
    }
    
    // Enforce seat availability if creating as ONGOING
    const isOngoing = (validatedData.status || 'ONGOING') === 'ONGOING';
    if (isOngoing && orgUnitId && courseResult[0]?.code) {
      const canUseSeat = await hasAvailableSeatForEnrollment(orgUnitId, courseResult[0].code);
      if (!canUseSeat) {
        return fail(res, 400, 'NO_SEATS_AVAILABLE', 'No remaining seats for this course at this center. Please contact your administrator.');
      }
    }

    // Create enrollment
    const enrollment: any = await prisma.$queryRaw`
      INSERT INTO "AbacusEnrollment" (
        "studentId", "courseId", "currentModuleId", "currentLevelId",
        "status", "notes", "orgUnitId", "startDate", "createdAt", "updatedAt"
      ) VALUES (
        ${validatedData.studentId}, ${validatedData.courseId}, 
        ${validatedData.currentModuleId || null}, ${validatedData.currentLevelId || null},
        ${validatedData.status || 'ONGOING'}, ${validatedData.notes || null},
        ${orgUnitId}, NOW(), NOW(), NOW()
      ) RETURNING *
    `;
    
    // Update license usage if enrollment is ONGOING
    if (isOngoing && orgUnitId && courseResult[0]?.code) {
      try {
        await incrementLicenseSeat(orgUnitId, courseResult[0].code);
      } catch (err: any) {
        return fail(
          res,
          400,
          err?.code || 'LICENSE_ERROR',
          err?.message || 'Unable to allocate license seat'
        );
      }
    }
    
    // Generate student fee record if enrollment is ONGOING
    if ((validatedData.status || 'ONGOING') === 'ONGOING' && orgUnitId) {
      try {
        await generateStudentFeeRecord(
          enrollment[0].id,
          validatedData.studentId,
          orgUnitId
        );
      } catch (error) {
        console.error('Error generating student fee record:', error);
      }
    }
    
    // Log audit
    await logAudit(req, {
      action: 'ENROLLMENT_CREATED',
      entityType: 'AbacusEnrollment',
      entityId: enrollment[0].id,
      meta: { 
        studentId: validatedData.studentId,
        courseId: validatedData.courseId,
        orgUnitId: enrollment[0].orgUnitId,
        status: enrollment[0].status
      }
    });
    
    ok(res, enrollment[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating enrollment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /superadmin/abacus/enrollments/:id
// Partial update of enrollment fields
router.put('/:id', authRequired, requireEnrollmentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    
    if (isNaN(enrollmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollment ID');
    }
    
    // Validate input
    const validatedData = updateEnrollmentSchema.parse(req.body);
    
    // Check if enrollment exists
    const existingEnrollment: any = await prisma.$queryRaw`
      SELECT * FROM "AbacusEnrollment" WHERE "id" = ${enrollmentId}
    `;
    
    if (existingEnrollment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found');
    }
    
    const targetStatus = validatedData.status ?? existingEnrollment[0].status;
    const targetOrgUnitId = validatedData.orgUnitId ?? existingEnrollment[0].orgUnitId;

    // If transitioning into ONGOING, enforce seat availability
    const becomingOngoing = existingEnrollment[0].status !== 'ONGOING' && targetStatus === 'ONGOING';
    if (becomingOngoing) {
      const courseCodeResult: any = await prisma.$queryRaw`
        SELECT "code" FROM "AbacusCourse" WHERE "id" = ${existingEnrollment[0].courseId}
      `;
      const courseCode = courseCodeResult[0]?.code;
      if (courseCode && targetOrgUnitId) {
        const canUseSeat = await hasAvailableSeatForEnrollment(targetOrgUnitId, courseCode);
        if (!canUseSeat) {
          return fail(
            res,
            400,
            'NO_SEATS_AVAILABLE',
            'No remaining seats for this course at this center. Please contact your administrator.'
          );
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    
    Object.entries(validatedData).forEach(([key, value]) => {
      // Skip orgUnitId from dynamic updates for now - handle separately
      if (key === 'orgUnitId') return;
      
      if (value !== undefined) {
        updates.push(`"${key}" = $${updates.length + 1}`);
        values.push(value);
      }
    });
    
    // Handle orgUnitId separately
    if (validatedData.orgUnitId !== undefined) {
      updates.push(`"orgUnitId" = $${updates.length + 1}`);
      values.push(validatedData.orgUnitId);
    }
    
    if (updates.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');
    }
    
    updates.push('"updatedAt" = NOW()');
    
    // Update enrollment
    const enrollment: any = await prisma.$queryRawUnsafe(
      `UPDATE "AbacusEnrollment" SET ${updates.join(', ')} WHERE "id" = $${updates.length + 1} RETURNING *`,
      ...values,
      enrollmentId
    );
    
    // Handle license seat adjustments on status transitions
    try {
      const previousStatus = existingEnrollment[0].status;
      const updatedEnrollment = enrollment[0];
      const courseCodeResult: any = await prisma.$queryRaw`
        SELECT "code" FROM "AbacusCourse" WHERE "id" = ${updatedEnrollment.courseId}
      `;
      const courseCode = courseCodeResult[0]?.code;

      if (courseCode && updatedEnrollment.orgUnitId) {
        if (previousStatus !== 'ONGOING' && updatedEnrollment.status === 'ONGOING') {
          try {
            await incrementLicenseSeat(updatedEnrollment.orgUnitId, courseCode);
          } catch (err: any) {
            return fail(
              res,
              400,
              err?.code || 'LICENSE_ERROR',
              err?.message || 'Unable to allocate license seat'
            );
          }
        } else if (previousStatus === 'ONGOING' && updatedEnrollment.status !== 'ONGOING') {
          await decrementLicenseSeat(updatedEnrollment.orgUnitId, courseCode);
        }
      }
    } catch (err) {
      console.error('Error adjusting license seats on enrollment update:', err);
    }
    
    // Handle fee record generation if status changed to ONGOING
    if (validatedData.status === 'ONGOING') {
      try {
        // Get the full enrollment data
        const fullEnrollment: any = await prisma.$queryRaw`
          SELECT * FROM "AbacusEnrollment" WHERE "id" = ${enrollmentId}
        `;
        
        if (fullEnrollment.length > 0) {
          const enrollmentData = fullEnrollment[0];
          // Check if fee record already exists
          const existingFeeRecord: any = await prisma.$queryRaw`
            SELECT * FROM "StudentFeeRecord" WHERE "enrollmentId" = ${enrollmentId}
          `;
          
          // If no fee record exists and orgUnitId is available, create one
          if (existingFeeRecord.length === 0 && enrollmentData.orgUnitId) {
            await generateStudentFeeRecord(
              enrollmentId,
              enrollmentData.studentId,
              enrollmentData.orgUnitId
            );
          }
        }
      } catch (error) {
        console.error('Error handling fee record on status change:', error);
      }
    }
    
    // Log audit
    await logAudit(req, {
      action: 'ENROLLMENT_UPDATED',
      entityType: 'AbacusEnrollment',
      entityId: enrollment[0].id,
      meta: { 
        changes: validatedData
      }
    });
    
    ok(res, enrollment[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating enrollment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/abacus/enrollments/:id/progress
// Returns a "progress snapshot"
router.get('/:id/progress', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    
    if (isNaN(enrollmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollment ID');
    }
    
    const isTeacher = req.user!.role === 'TEACHER';
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null);
    const teacherScope = isTeacher ? await getTeacherScope(req.user!.id) : { studentIds: [], enrollmentIds: [] };
    
    // Build query with org unit filtering
    let enrollmentQuery = `
      SELECT 
        e.*,
        s."code" as "studentCode",
        s."firstName" as "studentFirstName",
        s."lastName" as "studentLastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        l."name" as "levelName",
        l."order" as "levelOrder"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."id" = $1
    `;
    
    const queryParams: any[] = [enrollmentId];
    
    if (isTeacher) {
      if (teacherScope.enrollmentIds.length > 0) {
        enrollmentQuery += ` AND e."id" = ANY($2)`;
        queryParams.push(teacherScope.enrollmentIds);
      } else if (teacherScope.studentIds.length > 0) {
        enrollmentQuery += ` AND e."studentId" = ANY($2)`;
        queryParams.push(teacherScope.studentIds);
      } else {
        enrollmentQuery += ` AND FALSE`;
      }
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        enrollmentQuery += ` AND e."orgUnitId" = ANY($2)`;
        queryParams.push(allowedOrgUnits);
      } else {
        enrollmentQuery += ` AND FALSE`;
      }
    }
    
    const enrollmentResult: any = await prisma.$queryRawUnsafe(enrollmentQuery, ...queryParams);
    
    if (enrollmentResult.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found');
    }
    
    const enrollment = enrollmentResult[0];
    
    // Get all assessments for this enrollment
    let assessmentsQuery = `
      SELECT 
        a.*,
        l."name" as "levelName",
        l."order" as "levelOrder"
      FROM "AbacusAssessment" a
      JOIN "AbacusLevel" l ON a."levelId" = l."id"
      WHERE a."enrollmentId" = $1
    `;
    
    const assessmentParams: any[] = [enrollmentId];
    
    if (isTeacher) {
      if (teacherScope.enrollmentIds.length > 0) {
        assessmentsQuery += ` AND a."enrollmentId" = ANY($2)`;
        assessmentParams.push(teacherScope.enrollmentIds);
      } else if (teacherScope.studentIds.length > 0) {
        assessmentsQuery += ` AND EXISTS (
          SELECT 1 FROM "AbacusEnrollment" e 
          WHERE e."id" = a."enrollmentId" AND e."studentId" = ANY($2)
        )`;
        assessmentParams.push(teacherScope.studentIds);
      } else {
        assessmentsQuery += ` AND FALSE`;
      }
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        assessmentsQuery += ` AND EXISTS (
          SELECT 1 FROM "AbacusEnrollment" e 
          WHERE e."id" = a."enrollmentId" AND e."orgUnitId" = ANY($2)
        )`;
        assessmentParams.push(allowedOrgUnits);
      } else {
        assessmentsQuery += ` AND FALSE`;
      }
    }
    
    assessmentsQuery += ` ORDER BY a."attemptDate" DESC LIMIT 5`;
    
    const assessments: any = await prisma.$queryRawUnsafe(assessmentsQuery, ...assessmentParams);
    
    // Log audit
    await logAudit(req, {
      action: 'ENROLLMENT_PROGRESS_VIEWED',
      entityType: 'AbacusEnrollment',
      entityId: enrollment.id,
      meta: { 
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        assessmentsCount: assessments.length
      }
    });
    
    ok(res, {
      ...enrollment,
      assessments
    });
  } catch (error) {
    console.error('Error fetching enrollment progress:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /superadmin/abacus/enrollments/:id
// Deletes an enrollment
router.delete('/:id', authRequired, requireEnrollmentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    
    if (isNaN(enrollmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollment ID');
    }
    
    // Check if enrollment exists
    const existingEnrollment: any = await prisma.$queryRaw`
      SELECT * FROM "AbacusEnrollment" WHERE "id" = ${enrollmentId}
    `;
    
    if (existingEnrollment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Enrollment not found');
    }
    
    // Get enrollment details for audit log
    const enrollment = existingEnrollment[0];
    try {
      const courseCodeResult: any = await prisma.$queryRaw`
        SELECT "code" FROM "AbacusCourse" WHERE "id" = ${enrollment.courseId}
      `;
      const courseCode = courseCodeResult[0]?.code;
      if (courseCode && enrollment.orgUnitId && enrollment.status === 'ONGOING') {
        await decrementLicenseSeat(enrollment.orgUnitId, courseCode);
      }
    } catch (err) {
      console.error('Error adjusting license seats on enrollment delete:', err);
    }
    
    // Delete enrollment
    await prisma.$queryRaw`
      DELETE FROM "AbacusEnrollment" WHERE "id" = ${enrollmentId}
    `;
    
    // Log audit
    await logAudit(req, {
      action: 'ENROLLMENT_DELETED',
      entityType: 'AbacusEnrollment',
      entityId: enrollmentId,
      meta: { 
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        orgUnitId: enrollment.orgUnitId
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
