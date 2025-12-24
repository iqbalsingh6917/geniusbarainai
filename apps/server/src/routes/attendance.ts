import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import {
  isCenterManager,
  isAdmissions,
  isCoordinator,
  isHeadCoordinator,
  isTeacher,
  isSuperadmin,
} from '../constants/roles';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

// Apply auth middleware to all routes
router.use(authRequired);

// Zod schema for recording attendance
const AttendanceEntrySchema = z.object({
  studentId: z.number(),
  enrollmentId: z.number().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  remarks: z.string().optional(),
});

const RecordAttendanceSchema = z.object({
  classDate: z.string(), // YYYY-MM-DD
  scheduleId: z.number().optional(),
  entries: z.array(AttendanceEntrySchema),
});

// GET /api/attendance/center
// Roles: CENTER_MANAGER, ADMISSIONS, SUPERADMIN
router.get('/center', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (
      !req.user ||
      (!isCenterManager(req.user.role) &&
        !isAdmissions(req.user.role) &&
        !isCoordinator(req.user.role) &&
        !isHeadCoordinator(req.user.role) &&
        !isSuperadmin(req.user.role))
    ) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Get orgUnitId - either from query param (SUPERADMIN only) or user's orgUnitId
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null, req.user.id);
    let orgUnitId: number | undefined;
    if (req.query.orgUnitId) {
      orgUnitId = parseInt(req.query.orgUnitId as string);
      if (Number.isNaN(orgUnitId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId');
      }
      if (!isSuperadmin(req.user.role) && !allowedOrgUnits.includes(orgUnitId)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit outside your scope');
      }
    } else if (req.user.orgUnitId) {
      orgUnitId = req.user.orgUnitId;
    } else if (allowedOrgUnits.length > 0) {
      orgUnitId = allowedOrgUnits[0];
    }

    if (!orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Build base query
    let query = `
      SELECT 
        sa."id",
        sa."studentId",
        sa."enrollmentId",
        sa."classDate",
        sa."status",
        sa."scheduleId",
        sa."remarks",
        s."firstName",
        s."lastName",
        s."code" as "studentCode",
        u."username" as "recordedByName",
        sc."id" as "scheduleId"
      FROM "StudentAttendance" sa
      JOIN "Student" s ON sa."studentId" = s."id"
      JOIN "User" u ON sa."recordedById" = u."id"
      LEFT JOIN "AbacusClassSchedule" sc ON sa."scheduleId" = sc."id"
      WHERE sa."orgUnitId" = $1
    `;
    
    const queryParams: any[] = [orgUnitId];
    let paramIndex = 2;

    // Filter by date if provided
    if (req.query.date) {
      const dateStr = req.query.date as string;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD');
      }
      
      query += ` AND sa."classDate" = $${paramIndex}`;
      queryParams.push(date);
      paramIndex++;
    }

    // Filter by courseCode if provided
    if (req.query.courseCode) {
      query += ` AND EXISTS (
        SELECT 1 FROM "AbacusEnrollment" e 
        JOIN "AbacusCourse" c ON e."courseId" = c."id"
        WHERE e."id" = sa."enrollmentId" AND c."code" = $${paramIndex}
      )`;
      queryParams.push(req.query.courseCode);
      paramIndex++;
    }

    query += ` ORDER BY sa."classDate" DESC, s."firstName" ASC`;

    // Execute query
    const attendances: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Get enrollment details for course information
    const enrollmentIds = [...new Set(attendances.map((a: any) => a.enrollmentId).filter((id: any) => id !== null))] as number[];
    let enrollmentDetails: any = [];
    if (enrollmentIds.length > 0) {
      const enrollmentQuery = `
        SELECT 
          e."id",
          c."code" as "courseCode",
          c."name" as "courseName"
        FROM "AbacusEnrollment" e
        JOIN "AbacusCourse" c ON e."courseId" = c."id"
        WHERE e."id" = ANY($1)
      `;
      enrollmentDetails = await prisma.$queryRawUnsafe(enrollmentQuery, enrollmentIds);
    }

    const enrollmentMap = new Map(enrollmentDetails.map((e: any) => [e.id, e]));

    // Format response
    const result = attendances.map((attendance: any) => {
      const enrollment: any = attendance.enrollmentId ? enrollmentMap.get(attendance.enrollmentId) : null;
      
      return {
        id: attendance.id,
        studentId: attendance.studentId,
        studentName: `${attendance.firstName}${attendance.lastName ? ` ${attendance.lastName}` : ''}`,
        studentCode: attendance.studentCode,
        enrollmentId: attendance.enrollmentId,
        courseCode: enrollment?.courseCode || null,
        courseName: enrollment?.courseName || null,
        classDate: attendance.classDate,
        status: attendance.status,
        scheduleId: attendance.scheduleId,
        recordedByName: attendance.recordedByName,
        remarks: attendance.remarks
      };
    });

    // Log audit
    await logAudit(req, {
      action: 'ATTENDANCE_CENTER_VIEWED',
      entityType: 'StudentAttendance',
      meta: { 
        orgUnitId,
        resultsCount: result.length,
        filters: {
          date: req.query.date,
          courseCode: req.query.courseCode
        }
      }
    });

    ok(res, result);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/attendance/me
// Role: TEACHER
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Get assigned student IDs
    const assignmentsQuery = `
      SELECT "studentId" 
      FROM "TeacherStudentAssignment" 
      WHERE "teacherUserId" = $1 AND "orgUnitId" = $2
    `;
    const assignments: any = await prisma.$queryRawUnsafe(assignmentsQuery, req.user.id, req.user.orgUnitId);
    const studentIds = assignments.map((a: any) => a.studentId);
    
    if (studentIds.length === 0) {
      // Log audit
      await logAudit(req, {
        action: 'ATTENDANCE_TEACHER_VIEWED',
        entityType: 'StudentAttendance',
        meta: { 
          teacherId: req.user.id,
          orgUnitId: req.user.orgUnitId,
          resultsCount: 0
        }
      });
      
      return ok(res, []);
    }

    // Build query for attendance records
    let query = `
      SELECT 
        sa."id",
        sa."studentId",
        sa."enrollmentId",
        sa."classDate",
        sa."status",
        sa."scheduleId",
        sa."remarks",
        s."firstName",
        s."lastName",
        s."code" as "studentCode",
        u."username" as "recordedByName",
        sc."id" as "scheduleId"
      FROM "StudentAttendance" sa
      JOIN "Student" s ON sa."studentId" = s."id"
      JOIN "User" u ON sa."recordedById" = u."id"
      LEFT JOIN "AbacusClassSchedule" sc ON sa."scheduleId" = sc."id"
      WHERE sa."studentId" = ANY($1) AND sa."orgUnitId" = $2
    `;
    
    const queryParams: any[] = [studentIds, req.user.orgUnitId];
    let paramIndex = 3;

    // Filter by date if provided
    if (req.query.date) {
      const dateStr = req.query.date as string;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD');
      }
      
      query += ` AND sa."classDate" = $${paramIndex}`;
      queryParams.push(date);
      paramIndex++;
    }

    query += ` ORDER BY sa."classDate" DESC, s."firstName" ASC`;

    // Execute query
    const attendances: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const result = attendances.map((attendance: any) => ({
      id: attendance.id,
      studentId: attendance.studentId,
      studentName: `${attendance.firstName}${attendance.lastName ? ` ${attendance.lastName}` : ''}`,
      studentCode: attendance.studentCode,
      enrollmentId: attendance.enrollmentId,
      classDate: attendance.classDate,
      status: attendance.status,
      scheduleId: attendance.scheduleId,
      recordedByName: attendance.recordedByName,
      remarks: attendance.remarks
    }));

    // Log audit
    await logAudit(req, {
      action: 'ATTENDANCE_TEACHER_VIEWED',
      entityType: 'StudentAttendance',
      meta: { 
        teacherId: req.user.id,
        orgUnitId: req.user.orgUnitId,
        resultsCount: result.length,
        filters: {
          date: req.query.date
        }
      }
    });

    ok(res, result);
  } catch (error) {
    console.error('Error fetching my attendance:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/attendance/record
// Roles: CENTER_MANAGER, ADMISSIONS, TEACHER
router.post('/record', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (
      !req.user ||
      (!isCenterManager(req.user.role) &&
        !isAdmissions(req.user.role) &&
        !isCoordinator(req.user.role) &&
        !isTeacher(req.user.role))
    ) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    if (!req.user.orgUnitId) {
      return res.status(400).json({ error: 'User not associated with an organization unit' });
    }

    // Validate request body
    const parsed = RecordAttendanceSchema.parse(req.body);
    
    // Convert classDate string to Date
    const classDate = new Date(parsed.classDate);
    if (isNaN(classDate.getTime())) {
      return res.status(400).json({ error: 'Invalid classDate format. Use YYYY-MM-DD' });
    }

    // Validate scheduleId if provided
    if (parsed.scheduleId) {
      const scheduleQuery = `
        SELECT "id" 
        FROM "AbacusClassSchedule" 
        WHERE "id" = $1 AND "orgUnitId" = $2
      `;
      const schedule: any = await prisma.$queryRawUnsafe(scheduleQuery, parsed.scheduleId, req.user.orgUnitId);

      if (schedule.length === 0) {
        return res.status(400).json({ error: 'Invalid scheduleId: schedule not found in this center' });
      }
    }

    // For TEACHER, validate that all students are assigned to this teacher
    if (isTeacher(req.user.role)) {
      const studentIds = parsed.entries.map(entry => entry.studentId);
      
      if (studentIds.length > 0) {
        const assignmentsQuery = `
          SELECT "studentId" 
          FROM "TeacherStudentAssignment" 
          WHERE "teacherUserId" = $1 AND "studentId" = ANY($2) AND "orgUnitId" = $3
        `;
        const assignments: any = await prisma.$queryRawUnsafe(
          assignmentsQuery, 
          req.user.id, 
          studentIds, 
          req.user.orgUnitId
        );

        const assignedStudentIds = new Set(assignments.map((a: any) => a.studentId));
        
        // Check if all students are assigned to this teacher
        const unassignedStudents = studentIds.filter(id => !assignedStudentIds.has(id));
        if (unassignedStudents.length > 0) {
          return res.status(400).json({ 
            error: 'Some students are not assigned to this teacher', 
            unassignedStudents 
          });
        }
      }
    }

    // Validate each entry
    for (const entry of parsed.entries) {
      // Check if student exists and belongs to the same orgUnit
      const studentQuery = `
        SELECT "id" 
        FROM "Student" 
        WHERE "id" = $1 AND "orgUnitId" = $2
      `;
      const student: any = await prisma.$queryRawUnsafe(studentQuery, entry.studentId, req.user.orgUnitId);

      if (student.length === 0) {
        return res.status(400).json({ 
          error: `Invalid studentId: ${entry.studentId}. Student not found in this center.` 
        });
      }

      // If enrollmentId is provided, validate it
      if (entry.enrollmentId) {
        const enrollmentQuery = `
          SELECT "id" 
          FROM "AbacusEnrollment" 
          WHERE "id" = $1 AND "studentId" = $2 AND "orgUnitId" = $3
        `;
        const enrollment: any = await prisma.$queryRawUnsafe(
          enrollmentQuery, 
          entry.enrollmentId, 
          entry.studentId, 
          req.user.orgUnitId
        );

        if (enrollment.length === 0) {
          return res.status(400).json({ 
            error: `Invalid enrollmentId: ${entry.enrollmentId}. Enrollment not found for this student in this center.` 
          });
        }
      }
    }

    // Process attendance entries - upsert each one
    const results = [];
    for (const entry of parsed.entries) {
      // Check if attendance record already exists
      const existingQuery = `
        SELECT "id" 
        FROM "StudentAttendance" 
        WHERE "studentId" = $1 AND "classDate" = $2 AND "scheduleId" IS NOT DISTINCT FROM $3
      `;
      const existing: any = await prisma.$queryRawUnsafe(
        existingQuery, 
        entry.studentId, 
        classDate, 
        parsed.scheduleId || null
      );

      let attendance: any;
      if (existing.length > 0) {
        // Update existing record
        const updateQuery = `
          UPDATE "StudentAttendance" 
          SET 
            "status" = $1,
            "remarks" = $2,
            "enrollmentId" = $3,
            "recordedById" = $4,
            "updatedAt" = NOW()
          WHERE "id" = $5
          RETURNING *
        `;
        const updated: any = await prisma.$queryRawUnsafe(
          updateQuery,
          entry.status,
          entry.remarks || null,
          entry.enrollmentId || null,
          req.user.id,
          existing[0].id
        );
        attendance = updated[0];
      } else {
        // Create new record
        const insertQuery = `
          INSERT INTO "StudentAttendance" 
          ("studentId", "enrollmentId", "orgUnitId", "classDate", "scheduleId", "status", "remarks", "recordedById", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING *
        `;
        const inserted: any = await prisma.$queryRawUnsafe(
          insertQuery,
          entry.studentId,
          entry.enrollmentId || null,
          req.user.orgUnitId,
          classDate,
          parsed.scheduleId || null,
          entry.status,
          entry.remarks || null,
          req.user.id
        );
        attendance = inserted[0];
      }

      results.push(attendance);
    }

    // Log audit
    await logAudit(req, {
      action: 'ATTENDANCE_RECORDED',
      entityType: 'StudentAttendance',
      meta: { 
        orgUnitId: req.user.orgUnitId,
        recordedBy: req.user.id,
        classDate: classDate.toISOString(),
        entriesCount: results.length
      }
    });

    res.status(201).json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
