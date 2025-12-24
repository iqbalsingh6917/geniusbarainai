import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { getEffectiveOrgUnitId } from '../services/orgScope';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { 
  requireStudentCRUD, 
  requireEnrollmentCRUD 
} from '../middleware/permissions';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

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
const createStudentSchema = z.object({
  code: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  age: z.number().optional(),
  parentName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.string().optional(),
  // TODO_ROLE_SPLIT: Add orgUnitId for role-based scoping
  orgUnitId: z.number().optional(), // For SUPERADMIN to specify org unit
});

const updateStudentSchema = z.object({
  code: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  age: z.number().optional(),
  parentName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.string().optional(),
  // TODO_ROLE_SPLIT: Add orgUnitId for role-based scoping
  orgUnitId: z.number().optional(), // For SUPERADMIN to specify org unit
});

// GET /superadmin/abacus/students
// Returns a list of students with basic info plus number of enrollments
router.get('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const queryOrgUnitId = req.query.orgUnitId ? parseInt(req.query.orgUnitId as string) : undefined;
    const effectiveOrgUnitId = getEffectiveOrgUnitId(req.user!, queryOrgUnitId);

    const isTeacher = req.user!.role === 'TEACHER';
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null, req.user!.id);
    const teacherScope = isTeacher ? await getTeacherScope(req.user!.id) : { studentIds: [], enrollmentIds: [] };

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
    
    if (isTeacher) {
      if (teacherScope.studentIds.length === 0) {
        return ok(res, []);
      }
      studentsQuery += ` WHERE s."id" = ANY($1)`;
      queryParams.push(teacherScope.studentIds);
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        studentsQuery += ` WHERE s."orgUnitId" = ANY($1)`;
        queryParams.push(allowedOrgUnits);
      } else {
        studentsQuery += ` WHERE FALSE`;
      }
    } else if (effectiveOrgUnitId) {
      studentsQuery += ` WHERE s."orgUnitId" = $1`;
      queryParams.push(effectiveOrgUnitId);
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
      action: 'STUDENT_LIST_VIEWED',
      entityType: 'Student',
      meta: { 
        orgUnitId: effectiveOrgUnitId,
        userRole: req.user!.role,
        resultsCount: formattedStudents.length
      }
    });
    
    ok(res, formattedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/abacus/students/:id
// Returns detailed student info with enrollments and recent assessments
router.get('/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student ID');
    }
    
    const isTeacher = req.user!.role === 'TEACHER';
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user!.role, req.user!.orgUnitId || null, req.user!.id);
    const teacherScope = isTeacher ? await getTeacherScope(req.user!.id) : { studentIds: [], enrollmentIds: [] };
    
    // Build query with org unit filtering
    let studentQuery = `
      SELECT s.*, o."name" as "orgUnitName" 
      FROM "Student" s
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."id" = $1
    `;
    
    const queryParams: any[] = [studentId];
    
    if (isTeacher) {
      if (!teacherScope.studentIds.includes(studentId)) {
        return fail(res, 404, 'NOT_FOUND', 'Student not found');
      }
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        studentQuery += ` AND s."orgUnitId" = ANY($2)`;
        queryParams.push(allowedOrgUnits);
      } else {
        studentQuery += ` AND FALSE`;
      }
    }
    
    const studentResult: any = await prisma.$queryRawUnsafe(studentQuery, ...queryParams);
    
    if (studentResult.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Student not found');
    }
    
    const student = studentResult[0];
    
    // Get enrollments with course, module, and level info
    let enrollmentsQuery = `
      SELECT 
        e."id",
        e."status",
        e."startDate",
        e."endDate",
        e."orgUnitId",
        c."id" as "courseId",
        c."code" as "courseCode",
        c."name" as "courseName",
        m."id" as "moduleId",
        m."title" as "moduleName",
        m."index" as "moduleIndex",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder"
      FROM "AbacusEnrollment" e
      LEFT JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."studentId" = $1
    `;
    
    const enrollmentParams: any[] = [studentId];
    
    if (isTeacher) {
      if (teacherScope.enrollmentIds.length > 0) {
        enrollmentsQuery += ` AND e."id" = ANY($2)`;
        enrollmentParams.push(teacherScope.enrollmentIds);
      } else {
        enrollmentsQuery += ` AND FALSE`;
      }
    } else if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        enrollmentsQuery += ` AND e."orgUnitId" = ANY($2)`;
        enrollmentParams.push(allowedOrgUnits);
      } else {
        enrollmentsQuery += ` AND FALSE`;
      }
    }
    
    const enrollments: any = await prisma.$queryRawUnsafe(enrollmentsQuery, ...enrollmentParams);
    
    // Get recent assessments (limit 5)
    let assessmentsQuery = `
      SELECT 
        a."id",
        a."scorePercent",
        a."passed",
        a."attemptDate",
        a."remarks",
        l."name" as "levelName",
        l."order" as "levelOrder"
      FROM "AbacusAssessment" a
      JOIN "AbacusLevel" l ON a."levelId" = l."id"
      WHERE a."enrollmentId" IN (
        SELECT "id" FROM "AbacusEnrollment" WHERE "studentId" = $1
      )
    `;
    
    const assessmentParams: any[] = [studentId];
    
    // Add org unit filtering for non-SUPERADMIN users
    if (req.user!.role !== 'SUPERADMIN') {
      if (allowedOrgUnits.length > 0) {
        assessmentsQuery += ` AND EXISTS (
          SELECT 1 FROM "AbacusEnrollment" e 
          WHERE e."id" = a."enrollmentId" AND e."orgUnitId" = ANY($2)
        )`;
        assessmentParams.push(allowedOrgUnits);
      } else {
        // If no allowed org units, return empty result
        assessmentsQuery += ` AND FALSE`;
      }
    }
    
    assessmentsQuery += ` ORDER BY a."attemptDate" DESC LIMIT 5`;
    
    const assessments: any = await prisma.$queryRawUnsafe(assessmentsQuery, ...assessmentParams);
    
    // Log audit
    await logAudit(req, {
      action: 'STUDENT_DETAILS_VIEWED',
      entityType: 'Student',
      entityId: student.id,
      meta: { 
        studentCode: student.code,
        userRole: req.user!.role,
        enrollmentsCount: enrollments.length,
        assessmentsCount: assessments.length
      }
    });
    
    ok(res, {
      ...student,
      enrollments,
      recentAssessments: assessments
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/abacus/students
// Creates a new student
router.post('/', authRequired, requireStudentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = createStudentSchema.parse(req.body);
    
    // Auto-generate code if not provided
    let code = validatedData.code;
    if (!code) {
      // Get the highest existing student ID to generate next code
      const maxStudent: any = await prisma.$queryRaw`
        SELECT MAX(CAST(SUBSTRING("code", 3) AS INTEGER)) as maxId 
        FROM "Student" 
        WHERE "code" LIKE 'ST%'
      `;
      
      const nextId = (maxStudent[0].maxid || 0) + 1;
      code = `ST${nextId.toString().padStart(4, '0')}`;
    }
    
    // Check if code already exists
    const existingStudent: any = await prisma.$queryRaw`
      SELECT * FROM "Student" WHERE "code" = ${code}
    `;
    
    if (existingStudent.length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Student code already exists');
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
    
    // Create student
    const student: any = await prisma.$queryRaw`
      INSERT INTO "Student" (
        "code", "firstName", "lastName", "age", "parentName", 
        "contactPhone", "contactEmail", "status", "orgUnitId", "createdAt", "updatedAt"
      ) VALUES (
        ${code}, ${validatedData.firstName}, ${validatedData.lastName || null}, 
        ${validatedData.age || null}, ${validatedData.parentName || null}, 
        ${validatedData.contactPhone || null}, ${validatedData.contactEmail || null}, 
        ${validatedData.status || 'ACTIVE'}, ${orgUnitId}, NOW(), NOW()
      ) RETURNING *
    `;
    
    // Log audit
    await logAudit(req, {
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: student[0].id,
      meta: { 
        studentCode: student[0].code,
        firstName: student[0].firstName,
        lastName: student[0].lastName,
        orgUnitId: student[0].orgUnitId
      }
    });
    
    ok(res, student[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating student:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /superadmin/abacus/students/:id
// Partial update of student fields
router.put('/:id', authRequired, requireStudentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student ID');
    }
    
    // Validate input
    const validatedData = updateStudentSchema.parse(req.body);
    
    // Check if student exists
    const existingStudent: any = await prisma.$queryRaw`
      SELECT * FROM "Student" WHERE "id" = ${studentId}
    `;
    
    if (existingStudent.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Student not found');
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
    
    // Update student
    const student: any = await prisma.$queryRawUnsafe(
      `UPDATE "Student" SET ${updates.join(', ')} WHERE "id" = $${updates.length + 1} RETURNING *`,
      ...values,
      studentId
    );
    
    // Log audit
    await logAudit(req, {
      action: 'STUDENT_UPDATED',
      entityType: 'Student',
      entityId: student[0].id,
      meta: { 
        studentCode: student[0].code,
        changes: validatedData
      }
    });
    
    ok(res, student[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating student:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /superadmin/abacus/students/:id
// Deletes a student
router.delete('/:id', authRequired, requireStudentCRUD, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student ID');
    }
    
    // Check if student exists
    const existingStudent: any = await prisma.$queryRaw`
      SELECT * FROM "Student" WHERE "id" = ${studentId}
    `;
    
    if (existingStudent.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Student not found');
    }
    
    // Get student details for audit log
    const student = existingStudent[0];
    
    // Delete student
    await prisma.$queryRaw`
      DELETE FROM "Student" WHERE "id" = ${studentId}
    `;
    
    // Log audit
    await logAudit(req, {
      action: 'STUDENT_DELETED',
      entityType: 'Student',
      entityId: studentId,
      meta: { 
        studentCode: student.code,
        firstName: student.firstName,
        lastName: student.lastName
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting student:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
