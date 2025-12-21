import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isCenterManager, isAdmissions, isTeacher } from '../constants/roles';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ROLES } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import { createTeacherAssignmentSchema, updateTeacherAssignmentSchema } from '../schemas/teacherAssignmentSchema';

const router = Router();
const prisma = new PrismaClient();

// GET /api/teacher-assignments/center
// Roles: CENTER_MANAGER, ADMISSIONS
router.get('/center', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Ensure the user's org unit is a CENTER
    const orgUnit: any = await prisma.$queryRaw`
      SELECT "type" FROM "OrgUnit" WHERE "id" = ${req.user.orgUnitId}
    `;

    if (orgUnit.length === 0 || orgUnit[0].type !== 'CENTER') {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. User must belong to a CENTER.');
    }

    // Fetch teachers: Users with role TEACHER and orgUnitId = user.orgUnitId
    const teachers: any = await prisma.$queryRaw`
      SELECT "id", "username" 
      FROM "User" 
      WHERE "role" = ${ROLES.TEACHER} AND "orgUnitId" = ${req.user.orgUnitId}
    `;

    // Fetch students: Students with orgUnitId = user.orgUnitId
    const students: any = await prisma.$queryRaw`
      SELECT "id", "code", "firstName", "lastName" 
      FROM "Student" 
      WHERE "orgUnitId" = ${req.user.orgUnitId}
    `;

    // Fetch assignments: TeacherStudentAssignment where orgUnitId = user.orgUnitId
    const assignments: any = await prisma.$queryRaw`
      SELECT 
        tsa."id",
        tsa."teacherUserId",
        tsa."studentId",
        tsa."enrollmentId",
        u."username" as "teacherName",
        s."firstName" || ' ' || s."lastName" as "studentName"
      FROM "TeacherStudentAssignment" tsa
      JOIN "User" u ON tsa."teacherUserId" = u."id"
      JOIN "Student" s ON tsa."studentId" = s."id"
      WHERE tsa."orgUnitId" = ${req.user.orgUnitId}
    `;

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSIGNMENTS_CENTER_VIEWED',
      entityType: 'TeacherStudentAssignment',
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        teachersCount: teachers.length,
        studentsCount: students.length,
        assignmentsCount: assignments.length
      }
    });

    ok(res, {
      teachers: teachers.map((teacher: any) => ({
        id: teacher.id,
        username: teacher.username,
        fullName: teacher.username // Using username as fullName since we don't have firstName/lastName
      })),
      students: students.map((student: any) => ({
        id: student.id,
        code: student.code,
        fullName: `${student.firstName || ''} ${student.lastName || ''}`.trim()
      })),
      assignments: assignments.map((assignment: any) => ({
        id: assignment.id,
        teacherUserId: assignment.teacherUserId,
        teacherName: assignment.teacherName,
        studentId: assignment.studentId,
        studentName: assignment.studentName,
        enrollmentId: assignment.enrollmentId
      }))
    });
  } catch (error) {
    console.error('Error fetching teacher assignments for center:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/teacher-assignments/me
// Role: TEACHER
router.get('/me', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Get assignments for this teacher
    const assignmentsQuery = `
      SELECT 
        tsa."id",
        tsa."studentId",
        tsa."enrollmentId",
        s."code",
        s."firstName",
        s."lastName",
        s."status"
      FROM "TeacherStudentAssignment" tsa
      JOIN "Student" s ON tsa."studentId" = s."id"
      WHERE tsa."teacherUserId" = $1 AND tsa."orgUnitId" = $2
    `;
    const assignments: any = await prisma.$queryRawUnsafe(assignmentsQuery, req.user.id, req.user.orgUnitId);

    const studentIds = assignments.map((a: any) => a.studentid || a.studentId);

    // Build students list
    const students = assignments.map((a: any) => ({
      id: a.studentid || a.studentId,
      code: a.code,
      firstName: a.firstname || a.firstName,
      lastName: a.lastname || a.lastName,
      status: a.status,
    }));

    // Fetch enrollments for those students
    let enrollments: any[] = [];
    if (studentIds.length > 0) {
      const enrollmentsQuery = `
        SELECT 
          e."id",
          e."studentId",
          e."status",
          c."code" as "courseCode",
          c."name" as "courseName",
          m."title" as "currentModuleTitle",
          l."name" as "currentLevelName"
        FROM "AbacusEnrollment" e
        JOIN "AbacusCourse" c ON e."courseId" = c."id"
        LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
        LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
        WHERE e."studentId" = ANY($1) AND e."orgUnitId" = $2
      `;
      enrollments = await prisma.$queryRawUnsafe(enrollmentsQuery, studentIds, req.user.orgUnitId);
    }

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSIGNMENTS_SELF_VIEWED',
      entityType: 'TeacherStudentAssignment',
      meta: {
        teacherId: req.user.id,
        orgUnitId: req.user.orgUnitId,
        studentsCount: students.length,
        enrollmentsCount: enrollments.length,
      },
    });

    ok(res, { students, enrollments });
  } catch (error) {
    console.error('Error fetching teacher assignments (me):', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/teacher-assignments
// Roles: CENTER_MANAGER, ADMISSIONS
router.post('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Validate input
    const validatedData = createTeacherAssignmentSchema.parse(req.body);
    
    const { teacherUserId, studentId, enrollmentId } = validatedData;

    // Validate teacherUserId → must be a TEACHER in same orgUnitId as current user
    const teacherResult: any = await prisma.$queryRaw`
      SELECT "id", "role", "orgUnitId" 
      FROM "User" 
      WHERE "id" = ${teacherUserId} AND "role" = ${ROLES.TEACHER} AND "orgUnitId" = ${req.user.orgUnitId}
    `;

    if (teacherResult.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid teacherUserId: must be a TEACHER in the same center');
    }

    // Validate studentId → must belong to same orgUnitId as current user
    const studentResult: any = await prisma.$queryRaw`
      SELECT "id", "orgUnitId" 
      FROM "Student" 
      WHERE "id" = ${studentId} AND "orgUnitId" = ${req.user.orgUnitId}
    `;

    if (studentResult.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid studentId: must belong to the same center');
    }

    // Validate enrollmentId (if provided)
    if (enrollmentId) {
      const enrollmentResult: any = await prisma.$queryRaw`
        SELECT "id", "studentId", "orgUnitId" 
        FROM "AbacusEnrollment" 
        WHERE "id" = ${enrollmentId} AND "studentId" = ${studentId} AND "orgUnitId" = ${req.user.orgUnitId}
      `;

      if (enrollmentResult.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollmentId: must belong to the student and same center');
      }
    }

    // Upsert assignment by (teacherUserId, studentId)
    const assignmentResult: any = await prisma.$queryRaw`
      INSERT INTO "TeacherStudentAssignment" ("teacherUserId", "studentId", "enrollmentId", "orgUnitId", "createdAt", "updatedAt")
      VALUES (${teacherUserId}, ${studentId}, ${enrollmentId || null}, ${req.user.orgUnitId}, NOW(), NOW())
      ON CONFLICT ("teacherUserId", "studentId") 
      DO UPDATE SET "enrollmentId" = ${enrollmentId || null}, "updatedAt" = NOW()
      RETURNING *
    `;

    const assignment = assignmentResult[0];

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSIGNMENT_CREATED',
      entityType: 'TeacherStudentAssignment',
      entityId: assignment.id,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        teacherUserId: assignment.teacherUserId,
        studentId: assignment.studentId,
        enrollmentId: assignment.enrollmentId
      }
    });

    ok(res, assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating teacher assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /api/teacher-assignments/:id
// Roles: CENTER_MANAGER, ADMISSIONS
router.put('/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);
    
    if (isNaN(assignmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid assignment ID');
    }

    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Validate input
    const validatedData = updateTeacherAssignmentSchema.parse(req.body);
    
    const { enrollmentId } = validatedData;

    // Check if assignment exists and belongs to user's org unit
    const existingAssignment: any = await prisma.$queryRaw`
      SELECT * FROM "TeacherStudentAssignment" 
      WHERE "id" = ${assignmentId} AND "orgUnitId" = ${req.user.orgUnitId}
    `;

    if (existingAssignment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Assignment not found');
    }

    // Validate enrollmentId (if provided)
    if (enrollmentId) {
      const enrollmentResult: any = await prisma.$queryRaw`
        SELECT "id", "studentId", "orgUnitId" 
        FROM "AbacusEnrollment" 
        WHERE "id" = ${enrollmentId} AND "studentId" = ${existingAssignment[0].studentId} AND "orgUnitId" = ${req.user.orgUnitId}
      `;

      if (enrollmentResult.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid enrollmentId: must belong to the student and same center');
      }
    }

    // Update assignment
    const assignmentResult: any = await prisma.$queryRaw`
      UPDATE "TeacherStudentAssignment"
      SET "enrollmentId" = ${enrollmentId || null}, "updatedAt" = NOW()
      WHERE "id" = ${assignmentId}
      RETURNING *
    `;

    const assignment = assignmentResult[0];

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSIGNMENT_UPDATED',
      entityType: 'TeacherStudentAssignment',
      entityId: assignment.id,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        teacherUserId: assignment.teacherUserId,
        studentId: assignment.studentId,
        enrollmentId: assignment.enrollmentId
      }
    });

    ok(res, assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating teacher assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /api/teacher-assignments/:id
// Roles: CENTER_MANAGER, ADMISSIONS
router.delete('/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);
    
    if (isNaN(assignmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid assignment ID');
    }

    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Check if assignment exists and belongs to user's org unit
    const existingAssignment: any = await prisma.$queryRaw`
      SELECT * FROM "TeacherStudentAssignment" 
      WHERE "id" = ${assignmentId} AND "orgUnitId" = ${req.user.orgUnitId}
    `;

    if (existingAssignment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Assignment not found');
    }

    // Delete assignment
    await prisma.$queryRaw`
      DELETE FROM "TeacherStudentAssignment" 
      WHERE "id" = ${assignmentId}
    `;

    // Log audit
    await logAudit(req, {
      action: 'TEACHER_ASSIGNMENT_DELETED',
      entityType: 'TeacherStudentAssignment',
      entityId: assignmentId,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        teacherUserId: existingAssignment[0].teacherUserId,
        studentId: existingAssignment[0].studentId
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting teacher assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
