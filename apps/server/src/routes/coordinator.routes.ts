import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { isCoordinator } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/coordinator/centers
// Role: COORDINATOR only
router.get('/centers', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get centers under allowed org units
    const centers: any = await prisma.$queryRaw`
      SELECT 
        ou."id",
        ou."code",
        ou."name",
        ou."type",
        ou."parentId",
        parent_ou."name" as "parentName"
      FROM "OrgUnit" ou
      LEFT JOIN "OrgUnit" parent_ou ON ou."parentId" = parent_ou."id"
      WHERE ou."id" = ANY($1) AND ou."type" = 'CENTER'
      ORDER BY ou."name"
    `;

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_CENTERS_VIEWED',
      entityType: 'OrgUnit',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        centersCount: centers.length
      }
    });

    return ok(res, centers);
  } catch (error) {
    console.error('Error fetching coordinator centers:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/coordinator/teachers
// Role: COORDINATOR only
router.get('/teachers', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get teachers under allowed centers
    const teachers: any = await prisma.$queryRaw`
      SELECT 
        u."id",
        u."username",
        u."orgUnitId",
        ou."name" as "centerName"
      FROM "User" u
      JOIN "OrgUnit" ou ON u."orgUnitId" = ou."id"
      WHERE u."role" = 'TEACHER' 
        AND u."orgUnitId" = ANY($1)
      ORDER BY ou."name", u."username"
    `;

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_TEACHERS_VIEWED',
      entityType: 'User',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        teachersCount: teachers.length
      }
    });

    return ok(res, teachers);
  } catch (error) {
    console.error('Error fetching coordinator teachers:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/coordinator/students
// Role: COORDINATOR only
router.get('/students', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get students under allowed centers
    const students: any = await prisma.$queryRaw`
      SELECT 
        s."id",
        s."code",
        s."firstName",
        s."lastName",
        s."orgUnitId",
        ou."name" as "centerName",
        COUNT(e."id") as "enrollmentCount"
      FROM "Student" s
      JOIN "OrgUnit" ou ON s."orgUnitId" = ou."id"
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" != 'DROPPED'
      WHERE s."orgUnitId" = ANY($1)
      GROUP BY s."id", s."code", s."firstName", s."lastName", s."orgUnitId", ou."name"
      ORDER BY ou."name", s."firstName", s."lastName"
    `;

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_STUDENTS_VIEWED',
      entityType: 'Student',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        studentsCount: students.length
      }
    });

    return ok(res, students);
  } catch (error) {
    console.error('Error fetching coordinator students:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/coordinator/attendance-summary
// Role: COORDINATOR only
router.get('/attendance-summary', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get attendance summary for allowed centers
    const attendanceSummary: any = await prisma.$queryRaw`
      SELECT 
        ou."name" as "centerName",
        COUNT(s."id") as "totalStudents",
        COALESCE(SUM(
          CASE 
            WHEN a."date" >= CURRENT_DATE - INTERVAL '7 days' THEN 1 
            ELSE 0 
          END
        ), 0) as "recentAttendanceCount"
      FROM "OrgUnit" ou
      LEFT JOIN "Student" s ON ou."id" = s."orgUnitId"
      LEFT JOIN "Attendance" a ON s."id" = a."studentId"
      WHERE ou."id" = ANY($1) AND ou."type" = 'CENTER'
      GROUP BY ou."id", ou."name"
      ORDER BY ou."name"
    `;

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_ATTENDANCE_SUMMARY_VIEWED',
      entityType: 'Attendance',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        summaryCount: attendanceSummary.length
      }
    });

    return ok(res, attendanceSummary);
  } catch (error) {
    console.error('Error fetching coordinator attendance summary:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/coordinator/progress-summary
// Role: COORDINATOR only
router.get('/progress-summary', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get progress summary for students in allowed centers
    const progressSummary: any = await prisma.$queryRaw`
      SELECT 
        ou."name" as "centerName",
        COUNT(DISTINCT s."id") as "totalStudents",
        ROUND(AVG(
          CASE 
            WHEN total_modules > 0 THEN (completed_modules * 100.0 / total_modules)
            ELSE 0
          END
        ), 2) as "avgProgressPercent"
      FROM "Student" s
      JOIN "OrgUnit" ou ON s."orgUnitId" = ou."id"
      JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" != 'DROPPED'
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as total_modules
        FROM "AbacusModule" m
        WHERE m."courseId" = c."id"
      ) tm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as completed_modules
        FROM "AbacusModuleCompletion" mc
        WHERE mc."studentId" = s."id" AND mc."moduleId" IN (
          SELECT m."id" FROM "AbacusModule" m WHERE m."courseId" = c."id"
        )
      ) cm ON TRUE
      WHERE s."orgUnitId" = ANY($1)
      GROUP BY ou."id", ou."name"
      ORDER BY ou."name"
    `;

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_PROGRESS_SUMMARY_VIEWED',
      entityType: 'Progress',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        summaryCount: progressSummary.length
      }
    });

    return ok(res, progressSummary);
  } catch (error) {
    console.error('Error fetching coordinator progress summary:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/coordinator/flag-attendance-issue
// Role: COORDINATOR only
router.post('/flag-attendance-issue', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    const { studentId, date, issueType, description } = req.body;

    // Validate required fields
    if (!studentId || !date || !issueType) {
      return fail(res, 400, 'VALIDATION_ERROR', 'studentId, date, and issueType are required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Check if the student belongs to allowed org units
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        orgUnitId: { in: allowedOrgUnits }
      }
    });

    if (!student) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Student not in allowed organization units.');
    }

    // In a real implementation, you would log this issue to a database
    // For now, we'll just log it for tracking purposes
    console.log(`Attendance issue flagged by coordinator ${req.user.username}:`, {
      studentId,
      date,
      issueType,
      description,
      coordinatorId: req.user.id,
      orgUnitId: req.user.orgUnitId
    });

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_ATTENDANCE_ISSUE_FLAGGED',
      entityType: 'AttendanceIssue',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        studentId,
        issueType
      }
    });

    return ok(res, { message: 'Attendance issue flagged successfully' });
  } catch (error) {
    console.error('Error flagging attendance issue:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/coordinator/flag-progress-issue
// Role: COORDINATOR only
router.post('/flag-progress-issue', authRequired, requireRole(['COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isCoordinator(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Coordinator role required.');
    }

    const { studentId, enrollmentId, issueType, description } = req.body;

    // Validate required fields
    if (!studentId || !enrollmentId || !issueType) {
      return fail(res, 400, 'VALIDATION_ERROR', 'studentId, enrollmentId, and issueType are required.');
    }

    // Get allowed org units for the coordinator
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Check if the student belongs to allowed org units
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        orgUnitId: { in: allowedOrgUnits }
      }
    });

    const enrollment = await prisma.abacusEnrollment.findFirst({
      where: {
        id: enrollmentId,
        studentId: studentId,
        orgUnitId: { in: allowedOrgUnits }
      }
    });

    if (!student || !enrollment) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Student or enrollment not in allowed organization units.');
    }

    // In a real implementation, you would log this issue to a database
    // For now, we'll just log it for tracking purposes
    console.log(`Progress issue flagged by coordinator ${req.user.username}:`, {
      studentId,
      enrollmentId,
      issueType,
      description,
      coordinatorId: req.user.id,
      orgUnitId: req.user.orgUnitId
    });

    // Log audit
    await logAudit(req, {
      action: 'COORDINATOR_PROGRESS_ISSUE_FLAGGED',
      entityType: 'ProgressIssue',
      meta: {
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role,
        studentId,
        enrollmentId,
        issueType
      }
    });

    return ok(res, { message: 'Progress issue flagged successfully' });
  } catch (error) {
    console.error('Error flagging progress issue:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;