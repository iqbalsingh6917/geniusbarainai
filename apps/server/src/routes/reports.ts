import { Router, Response, NextFunction } from 'express';
import { prisma } from '@lms/db';
import { authRequired, AuthRequest } from '../middleware/auth';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { isSuperadmin, isBusinessPartner, isFranchise, isCenterManager, isAdmissions, isTeacher } from '../constants/roles';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import PDFDocument from 'pdfkit';
import stream from 'stream';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import { studentsReportSchema, enrollmentsReportSchema, attendanceReportSchema, financeReportSchema, assessmentsReportSchema } from '../schemas/reportsSchema';

const router = Router();

type StudentRow = {
  id: number;
  code: string;
  firstName: string;
  lastName: string | null;
  age: number | null;
  status: string;
  createdAt: Date;
  orgUnitCode: string;
  orgUnitName: string;
};

type EnrollmentRow = {
  id: number;
  status: string;
  startDate: Date;
  endDate: Date | null;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  courseCode: string;
  courseName: string;
  orgUnitCode: string;
  orgUnitName: string;
};

type AttendanceRow = {
  id: number;
  classDate: Date;
  status: string;
  remarks: string | null;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  courseCode: string;
  dayOfWeek: string | null;
  recordedByName: string | null;
  orgUnitCode: string;
  orgUnitName: string;
};

type FinanceRow = {
  id: number;
  amount: number;
  dueDate: Date | null;
  status: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  orgUnitCode: string;
  orgUnitName: string;
};

type AssessmentRow = {
  id: number;
  scorePercent: number | null;
  passed: boolean | null;
  attemptDate: Date | null;
  remarks: string | null;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  courseCode: string;
  courseName: string;
  levelName: string | null;
  orgUnitCode: string;
  orgUnitName: string;
};

// Helper function to check if user has access to reports
const canAccessReports = (role: string): boolean => {
  // TEACHER role cannot access reports
  return !isTeacher(role);
};

// Helper function to validate date format
const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

// Helper function to format date for display
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper function to validate status values
const isValidStatus = (status: string, validStatuses: string[]): boolean => {
  return validStatuses.includes(status.toUpperCase());
};

// Middleware to check report access
const reportAccessRequired = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
  }

  if (!canAccessReports(req.user.role)) {
    return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teachers cannot access reports.');
  }

  next();
};

// GET /api/reports/students
router.get('/students', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    const validatedQuery = studentsReportSchema.parse(req.query);
    
    const { orgUnitId, status, fromDate, toDate } = validatedQuery;
    
    // Check if user has appropriate role
    if (!req.user || (!isSuperadmin(req.user.role) && 
        !isBusinessPartner(req.user.role) && 
        !isFranchise(req.user.role) && 
        !isCenterManager(req.user.role) && 
        !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."id",
        s."code",
        s."firstName",
        s."lastName",
        s."age",
        s."status",
        s."createdAt",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "Student" s
      JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."orgUnitId" = ANY($1)
    `;
    
    const queryParams: unknown[] = [targetOrgUnits];
    let paramIndex = 2;

    // Filter by status if provided
    if (status) {
      query += ` AND s."status" = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND s."createdAt" >= $${paramIndex}`;
      queryParams.push(new Date(fromDate as string));
      paramIndex++;
    }

    if (toDate) {
      query += ` AND s."createdAt" <= $${paramIndex}`;
      queryParams.push(new Date(toDate as string));
      paramIndex++;
    }

    query += ` ORDER BY s."createdAt" DESC`;

    const students = await prisma.$queryRawUnsafe<StudentRow[]>(query, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'REPORT_STUDENTS_VIEWED',
      entityType: 'Report',
      meta: {
        reportType: 'students',
        filters: {
          orgUnitId,
          status,
          fromDate,
          toDate
        },
        resultsCount: students.length
      }
    });

    ok(res, students);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching students report:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/reports/enrollments
router.get('/enrollments', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    const validatedQuery = enrollmentsReportSchema.parse(req.query);
    
    const { orgUnitId, status, courseCode, fromDate, toDate } = validatedQuery;
    
    // Check if user has appropriate role
    if (!req.user || (!isSuperadmin(req.user.role) && 
        !isBusinessPartner(req.user.role) && 
        !isFranchise(req.user.role) && 
        !isCenterManager(req.user.role) && 
        !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        e."id",
        e."status",
        e."startDate",
        e."endDate",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      WHERE e."orgUnitId" = ANY($1)
    `;
    
    const queryParams: unknown[] = [targetOrgUnits];
    let paramIndex = 2;

    // Filter by status if provided
    if (status) {
      query += ` AND e."status" = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Filter by course code if provided
    if (courseCode) {
      query += ` AND c."code" = $${paramIndex}`;
      queryParams.push(courseCode);
      paramIndex++;
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND e."startDate" >= $${paramIndex}`;
      queryParams.push(new Date(fromDate as string));
      paramIndex++;
    }

    if (toDate) {
      query += ` AND e."startDate" <= $${paramIndex}`;
      queryParams.push(new Date(toDate as string));
      paramIndex++;
    }

    query += ` ORDER BY e."startDate" DESC`;

    const enrollments = await prisma.$queryRawUnsafe<EnrollmentRow[]>(query, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'REPORT_ENROLLMENTS_VIEWED',
      entityType: 'Report',
      meta: {
        reportType: 'enrollments',
        filters: {
          orgUnitId,
          status,
          courseCode,
          fromDate,
          toDate
        },
        resultsCount: enrollments.length
      }
    });

    ok(res, enrollments);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching enrollments report:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/reports/attendance
router.get('/attendance', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    const validatedQuery = attendanceReportSchema.parse(req.query);
    
    const { orgUnitId, date, courseCode } = validatedQuery;
    
    // Check if user has appropriate role
    if (!req.user || (!isSuperadmin(req.user.role) && 
        !isBusinessPartner(req.user.role) && 
        !isFranchise(req.user.role) && 
        !isCenterManager(req.user.role) && 
        !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Validate date if provided
    if (date && !isValidDate(date as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        sa."id",
        sa."classDate",
        sa."status",
        sa."remarks",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        acs."courseCode",
        acs."dayOfWeek",
        u."username" as "recordedByName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "StudentAttendance" sa
      JOIN "Student" s ON sa."studentId" = s."id"
      JOIN "AbacusClassSchedule" acs ON sa."scheduleId" = acs."id"
      JOIN "User" u ON sa."recordedById" = u."id"
      JOIN "OrgUnit" o ON sa."orgUnitId" = o."id"
      WHERE sa."orgUnitId" = ANY($1)
    `;
    
    const queryParams: unknown[] = [targetOrgUnits];
    let paramIndex = 2;

    // Filter by date if provided
    if (date) {
      query += ` AND sa."classDate" = $${paramIndex}`;
      queryParams.push(new Date(date as string));
      paramIndex++;
    }

    // Filter by course code if provided
    if (courseCode) {
      query += ` AND acs."courseCode" = $${paramIndex}`;
      queryParams.push(courseCode);
      paramIndex++;
    }

    query += ` ORDER BY sa."classDate" DESC, s."firstName", s."lastName"`;

    const attendance = await prisma.$queryRawUnsafe<AttendanceRow[]>(query, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'REPORT_ATTENDANCE_VIEWED',
      entityType: 'Report',
      meta: {
        reportType: 'attendance',
        filters: {
          orgUnitId,
          date,
          courseCode
        },
        resultsCount: attendance.length
      }
    });

    ok(res, attendance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching attendance report:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/reports/finance
router.get('/finance', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    const validatedQuery = financeReportSchema.parse(req.query);
    
    const { orgUnitId, status, fromDate, toDate } = validatedQuery;
    
    // Check if user has appropriate role
    if (!req.user || (!isSuperadmin(req.user.role) && 
        !isBusinessPartner(req.user.role) && 
        !isFranchise(req.user.role) && 
        !isCenterManager(req.user.role) && 
        !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['PENDING', 'PAID'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: PENDING, PAID.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        sfr."id",
        sfr."amount",
        sfr."dueDate",
        sfr."status",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "StudentFeeRecord" sfr
      JOIN "Student" s ON sfr."studentId" = s."id"
      JOIN "OrgUnit" o ON sfr."orgUnitId" = o."id"
      WHERE sfr."orgUnitId" = ANY($1)
    `;
    
    const queryParams: unknown[] = [targetOrgUnits];
    let paramIndex = 2;

    // Filter by status if provided
    if (status) {
      query += ` AND sfr."status" = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND sfr."dueDate" >= $${paramIndex}`;
      queryParams.push(new Date(fromDate as string));
      paramIndex++;
    }

    if (toDate) {
      query += ` AND sfr."dueDate" <= $${paramIndex}`;
      queryParams.push(new Date(toDate as string));
      paramIndex++;
    }

    query += ` ORDER BY sfr."dueDate" DESC`;

    const financeRecords = await prisma.$queryRawUnsafe<FinanceRow[]>(query, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'REPORT_FINANCE_VIEWED',
      entityType: 'Report',
      meta: {
        reportType: 'finance',
        filters: {
          orgUnitId,
          status,
          fromDate,
          toDate
        },
        resultsCount: financeRecords.length
      }
    });

    ok(res, financeRecords);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching finance report:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/reports/assessments
router.get('/assessments', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    const validatedQuery = assessmentsReportSchema.parse(req.query);
    
    const { orgUnitId, courseCode, levelId, fromDate, toDate } = validatedQuery;
    
    // Check if user has appropriate role
    if (!req.user || (!isSuperadmin(req.user.role) && 
        !isBusinessPartner(req.user.role) && 
        !isFranchise(req.user.role) && 
        !isCenterManager(req.user.role) && 
        !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        aa."id",
        aa."scorePercent",
        aa."passed",
        aa."attemptDate",
        aa."remarks",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        al."name" as "levelName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "AbacusAssessment" aa
      JOIN "AbacusEnrollment" ae ON aa."enrollmentId" = ae."id"
      JOIN "Student" s ON ae."studentId" = s."id"
      JOIN "AbacusCourse" c ON ae."courseId" = c."id"
      JOIN "AbacusLevel" al ON aa."levelId" = al."id"
      JOIN "OrgUnit" o ON ae."orgUnitId" = o."id"
      WHERE ae."orgUnitId" = ANY($1)
    `;
    
    const queryParams: unknown[] = [targetOrgUnits];
    let paramIndex = 2;

    // Filter by course code if provided
    if (courseCode) {
      query += ` AND c."code" = $${paramIndex}`;
      queryParams.push(courseCode);
      paramIndex++;
    }

    // Filter by level ID if provided
    if (levelId) {
      const levelIdNum = parseInt(levelId as string);
      if (!isNaN(levelIdNum)) {
        query += ` AND al."id" = $${paramIndex}`;
        queryParams.push(levelIdNum);
        paramIndex++;
      }
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND aa."attemptDate" >= $${paramIndex}`;
      queryParams.push(new Date(fromDate as string));
      paramIndex++;
    }

    if (toDate) {
      query += ` AND aa."attemptDate" <= $${paramIndex}`;
      queryParams.push(new Date(toDate as string));
      paramIndex++;
    }

    query += ` ORDER BY aa."attemptDate" DESC`;

    const assessments = await prisma.$queryRawUnsafe<AssessmentRow[]>(query, ...queryParams);

    // Log audit
    await logAudit(req, {
      action: 'REPORT_ASSESSMENTS_VIEWED',
      entityType: 'Report',
      meta: {
        reportType: 'assessments',
        filters: {
          orgUnitId,
          courseCode,
          levelId,
          fromDate,
          toDate
        },
        resultsCount: assessments.length
      }
    });

    ok(res, assessments);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching assessments report:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// CSV Export Endpoints
router.get('/students.csv', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Reuse the same logic as the JSON endpoint but format as CSV
    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ACTIVE', 'INACTIVE', 'ALL'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ACTIVE, INACTIVE, ALL.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        s."status",
        s."createdAt"
      FROM "Student" s
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add status filter
    if (status && (status as string).toUpperCase() !== 'ALL') {
      query += ` AND s."status" = $${queryParams.length + 1}`;
      queryParams.push(status as string);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND s."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND s."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY s."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const students = result.map((student: any) => ({
      studentId: student.studentId,
      studentCode: student.studentCode,
      fullName: student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName,
      orgUnitCode: student.orgUnitCode,
      orgUnitName: student.orgUnitName,
      status: student.status,
      createdAt: formatDate(student.createdAt)
    }));

    // Create CSV
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="students-report.csv"');
    
    // Write CSV header
    res.write('Student ID,Student Code,Full Name,Org Unit Code,Org Unit Name,Status,Created At\n');
    
    // Write CSV rows
    students.forEach((student: any) => {
      res.write(`${student.studentId},${student.studentCode},"${student.fullName}",${student.orgUnitCode},"${student.orgUnitName}",${student.status},${student.createdAt}\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting students CSV:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/enrollments.csv', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        e."id" as "enrollmentId",
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        o."code" as "orgUnitCode",
        e."status",
        e."startDate",
        e."endDate",
        m."title" as "currentModule",
        l."name" as "currentLevel"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Filter by status if provided
    if (status) {
      query += ` AND e."status" = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    // Filter by course code if provided
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND e."startDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND e."startDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY e."startDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const enrollments = result.map((enrollment: any) => ({
      enrollmentId: enrollment.enrollmentId,
      fullName: enrollment.lastName ? `${enrollment.firstName} ${enrollment.lastName}` : enrollment.firstName,
      courseCode: enrollment.courseCode,
      courseName: enrollment.courseName,
      orgUnitCode: enrollment.orgUnitCode,
      status: enrollment.status,
      startDate: formatDate(enrollment.startDate),
      endDate: enrollment.endDate ? formatDate(enrollment.endDate) : null,
      currentModule: enrollment.currentModule,
      currentLevel: enrollment.currentLevel
    }));

    // Create CSV
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="enrollments-report.csv"');
    
    // Write CSV header
    res.write('Enrollment ID,Full Name,Course Code,Course Name,Org Unit Code,Status,Start Date,End Date,Current Module,Current Level\n');
    
    // Write CSV rows
    enrollments.forEach((enrollment: any) => {
      res.write(`${enrollment.enrollmentId},"${enrollment.fullName}",${enrollment.courseCode},"${enrollment.courseName}",${enrollment.orgUnitCode},${enrollment.status},${enrollment.startDate},${enrollment.endDate || ''},"${enrollment.currentModule || ''}","${enrollment.currentLevel || ''}"\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting enrollments CSV:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PDF Export Endpoints
router.get('/students.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Reuse the same logic as the JSON endpoint but format as PDF
    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ACTIVE', 'INACTIVE', 'ALL'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ACTIVE, INACTIVE, ALL.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        s."status",
        s."createdAt"
      FROM "Student" s
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add status filter
    if (status && (status as string).toUpperCase() !== 'ALL') {
      query += ` AND s."status" = $${queryParams.length + 1}`;
      queryParams.push(status as string);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND s."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND s."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY s."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const students = result.map((student: any) => ({
      studentId: student.studentId,
      studentCode: student.studentCode,
      fullName: student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName,
      orgUnitCode: student.orgUnitCode,
      orgUnitName: student.orgUnitName,
      status: student.status,
      createdAt: formatDate(student.createdAt)
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="students-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(16).text('Students Report');

    // Write PDF rows
    students.forEach((student: any) => {
      doc.fontSize(12).text(`Student ID: ${student.studentId}`);
      doc.fontSize(12).text(`Student Code: ${student.studentCode}`);
      doc.fontSize(12).text(`Full Name: ${student.fullName}`);
      doc.fontSize(12).text(`Org Unit Code: ${student.orgUnitCode}`);
      doc.fontSize(12).text(`Org Unit Name: ${student.orgUnitName}`);
      doc.fontSize(12).text(`Status: ${student.status}`);
      doc.fontSize(12).text(`Created At: ${student.createdAt}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting students PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/enrollments.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        e."id" as "enrollmentId",
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        o."code" as "orgUnitCode",
        e."status",
        e."startDate",
        e."endDate",
        m."title" as "currentModule",
        l."name" as "currentLevel"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Filter by status if provided
    if (status) {
      query += ` AND e."status" = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    // Filter by course code if provided
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Filter by date range if provided
    if (fromDate) {
      query += ` AND e."startDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND e."startDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY e."startDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const enrollments = result.map((enrollment: any) => ({
      enrollmentId: enrollment.enrollmentId,
      fullName: enrollment.lastName ? `${enrollment.firstName} ${enrollment.lastName}` : enrollment.firstName,
      courseCode: enrollment.courseCode,
      courseName: enrollment.courseName,
      orgUnitCode: enrollment.orgUnitCode,
      status: enrollment.status,
      startDate: formatDate(enrollment.startDate),
      endDate: enrollment.endDate ? formatDate(enrollment.endDate) : null,
      currentModule: enrollment.currentModule,
      currentLevel: enrollment.currentLevel
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="enrollments-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(16).text('Enrollments Report');

    // Write PDF rows
    enrollments.forEach((enrollment: any) => {
      doc.fontSize(12).text(`Enrollment ID: ${enrollment.enrollmentId}`);
      doc.fontSize(12).text(`Full Name: ${enrollment.fullName}`);
      doc.fontSize(12).text(`Course Code: ${enrollment.courseCode}`);
      doc.fontSize(12).text(`Course Name: ${enrollment.courseName}`);
      doc.fontSize(12).text(`Org Unit Code: ${enrollment.orgUnitCode}`);
      doc.fontSize(12).text(`Status: ${enrollment.status}`);
      doc.fontSize(12).text(`Start Date: ${enrollment.startDate}`);
      doc.fontSize(12).text(`End Date: ${enrollment.endDate || ''}`);
      doc.fontSize(12).text(`Current Module: ${enrollment.currentModule || ''}`);
      doc.fontSize(12).text(`Current Level: ${enrollment.currentLevel || ''}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting enrollments PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});


router.get('/attendance.csv', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, date, courseCode } = req.query;

    // Validate date if provided
    if (date && !isValidDate(date as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        sa."id",
        sa."classDate",
        sa."status",
        sa."remarks",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        acs."courseCode",
        acs."dayOfWeek",
        u."username" as "recordedByName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "StudentAttendance" sa
      JOIN "Student" s ON sa."studentId" = s."id"
      JOIN "AbacusClassSchedule" acs ON sa."scheduleId" = acs."id"
      JOIN "User" u ON sa."recordedById" = u."id"
      JOIN "OrgUnit" o ON sa."orgUnitId" = o."id"
      WHERE sa."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add date filter
    if (date) {
      query += ` AND sa."classDate" = $${queryParams.length + 1}`;
      queryParams.push(new Date(date as string));
    }

    // Add course code filter
    if (courseCode) {
      query += ` AND acs."courseCode" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    query += ` ORDER BY sa."classDate" DESC, s."firstName", s."lastName"`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const attendance = result.map((record: any) => ({
      attendanceId: record.id,
      studentCode: record.studentCode,
      studentName: `${record.firstName} ${record.lastName}`,
      courseCode: record.courseCode,
      dayOfWeek: record.dayOfWeek,
      classDate: formatDate(record.classDate),
      status: record.status,
      remarks: record.remarks,
      recordedByName: record.recordedByName,
      orgUnitCode: record.orgUnitCode,
      orgUnitName: record.orgUnitName
    }));

    // Create CSV
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    
    // Write CSV header
    res.write('Attendance ID,Student Code,Student Name,Course Code,Day of Week,Class Date,Status,Remarks,Recorded By,Org Unit Code,Org Unit Name\n');
    
    // Write CSV rows
    attendance.forEach((record: any) => {
      res.write(`${record.attendanceId},${record.studentCode},"${record.studentName}",${record.courseCode},${record.dayOfWeek},${record.classDate},${record.status},${record.remarks},${record.recordedByName},${record.orgUnitCode},"${record.orgUnitName}"\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting attendance CSV:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/finance.csv', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates
    if (!fromDate || !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Valid fromDate is required. Use YYYY-MM-DD.');
    }

    if (!toDate || !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Valid toDate is required. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for finance report
    let query = `
      SELECT 
        pt."id" as "transactionId",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        pt."amount",
        pt."type",
        pt."method",
        pt."notes",
        pt."createdAt"
      FROM "PaymentTransaction" pt
      JOIN "OrgUnit" o ON pt."orgUnitId" = o."id"
      WHERE pt."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add date range filter
    if (fromDate) {
      query += ` AND pt."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND pt."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY pt."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const transactions = result.map((transaction: any) => ({
      transactionId: transaction.transactionId,
      orgUnitCode: transaction.orgUnitCode,
      orgUnitName: transaction.orgUnitName,
      amount: parseInt(transaction.amount?.toString() || '0') || 0,
      type: transaction.type,
      method: transaction.method,
      notes: transaction.notes,
      createdAt: formatDate(transaction.createdAt)
    }));

    // Create CSV
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="finance-report.csv"');
    
    // Write CSV header
    res.write('Transaction ID,Org Unit Code,Org Unit Name,Amount,Type,Method,Notes,Created At\n');
    
    // Write CSV rows
    transactions.forEach((transaction: any) => {
      res.write(`${transaction.transactionId},${transaction.orgUnitCode},"${transaction.orgUnitName}",${transaction.amount},${transaction.type},${transaction.method},"${transaction.notes}",${transaction.createdAt}\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting finance CSV:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/assessments.csv', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, levelId, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for assessments report
    let query = `
      SELECT 
        a."id" as "assessmentId",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        c."code" as "courseCode",
        c."name" as "courseName",
        al."name" as "levelName",
        al."order" as "levelOrder",
        a."scorePercent",
        a."passed",
        a."attemptDate",
        a."remarks"
      FROM "AbacusAssessment" a
      JOIN "AbacusEnrollment" ae ON a."enrollmentId" = ae."id"
      JOIN "Student" s ON ae."studentId" = s."id"
      JOIN "AbacusCourse" c ON ae."courseId" = c."id"
      JOIN "AbacusLevel" al ON a."levelId" = al."id"
      JOIN "OrgUnit" o ON ae."orgUnitId" = o."id"
      WHERE ae."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add level filter
    if (levelId) {
      const levelIdNum = parseInt(levelId as string);
      if (!isNaN(levelIdNum)) {
        query += ` AND al."id" = $${queryParams.length + 1}`;
        queryParams.push(levelIdNum);
      }
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND a."attemptDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND a."attemptDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY a."attemptDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const assessments = result.map((assessment: any) => ({
      assessmentId: assessment.assessmentId,
      studentId: assessment.studentId,
      studentCode: assessment.studentCode,
      fullName: assessment.lastName ? `${assessment.firstName} ${assessment.lastName}` : assessment.firstName,
      orgUnitCode: assessment.orgUnitCode,
      orgUnitName: assessment.orgUnitName,
      courseCode: assessment.courseCode,
      courseName: assessment.courseName,
      levelName: assessment.levelName,
      levelOrder: assessment.levelOrder,
      scorePercent: assessment.scorePercent,
      passed: assessment.passed,
      attemptDate: formatDate(assessment.attemptDate),
      remarks: assessment.remarks
    }));

    // Create CSV
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="assessments-report.csv"');
    
    // Write CSV header
    res.write('Assessment ID,Student ID,Student Code,Full Name,Org Unit Code,Org Unit Name,Course Code,Course Name,Level Name,Level Order,Score Percent,Passed,Attempt Date,Remarks\n');
    
    // Write CSV rows
    assessments.forEach((assessment: any) => {
      res.write(`${assessment.assessmentId},${assessment.studentId},${assessment.studentCode},"${assessment.fullName}",${assessment.orgUnitCode},"${assessment.orgUnitName}",${assessment.courseCode},"${assessment.courseName}",${assessment.levelName},${assessment.levelOrder},${assessment.scorePercent},${assessment.passed},${assessment.attemptDate},${assessment.remarks}\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting assessments CSV:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PDF Export Endpoints
router.get('/students.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Reuse the same logic as the JSON endpoint but format as PDF
    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ACTIVE', 'INACTIVE', 'ALL'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ACTIVE, INACTIVE, ALL.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        s."status",
        s."createdAt"
      FROM "Student" s
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add status filter
    if (status && (status as string).toUpperCase() !== 'ALL') {
      query += ` AND s."status" = $${queryParams.length + 1}`;
      queryParams.push(status as string);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND s."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND s."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY s."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const students = result.map((student: any) => ({
      studentId: student.studentId,
      studentCode: student.studentCode,
      fullName: student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName,
      orgUnitCode: student.orgUnitCode,
      orgUnitName: student.orgUnitName,
      status: student.status,
      createdAt: formatDate(student.createdAt)
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="students-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(18).text('Students Report', { align: 'center' });
    doc.moveDown();

    // Write PDF rows
    students.forEach((student: any) => {
      doc.text(`Student ID: ${student.studentId}`);
      doc.text(`Student Code: ${student.studentCode}`);
      doc.text(`Full Name: ${student.fullName}`);
      doc.text(`Org Unit Code: ${student.orgUnitCode}`);
      doc.text(`Org Unit Name: ${student.orgUnitName}`);
      doc.text(`Status: ${student.status}`);
      doc.text(`Created At: ${student.createdAt}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting students PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/enrollments.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for enrollments
    let query = `
      SELECT 
        e."id" as "enrollmentId",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        c."code" as "courseCode",
        c."name" as "courseName",
        e."status",
        e."startDate",
        e."endDate"
      FROM "AbacusEnrollment" e
      JOIN "Student" s ON e."studentId" = s."id"
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      WHERE e."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add status filter
    if (status) {
      query += ` AND e."status" = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND e."startDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND e."startDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY e."startDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const enrollments = result.map((enrollment: any) => ({
      enrollmentId: enrollment.enrollmentId,
      studentId: enrollment.studentId,
      studentCode: enrollment.studentCode,
      fullName: enrollment.lastName ? `${enrollment.firstName} ${enrollment.lastName}` : enrollment.firstName,
      orgUnitCode: enrollment.orgUnitCode,
      orgUnitName: enrollment.orgUnitName,
      courseCode: enrollment.courseCode,
      courseName: enrollment.courseName,
      status: enrollment.status,
      startDate: formatDate(enrollment.startDate),
      endDate: enrollment.endDate ? formatDate(enrollment.endDate) : null
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="enrollments-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(18).text('Enrollments Report', { align: 'center' });
    doc.moveDown();

    // Write PDF rows
    enrollments.forEach((enrollment: any) => {
      doc.text(`Enrollment ID: ${enrollment.enrollmentId}`);
      doc.text(`Student ID: ${enrollment.studentId}`);
      doc.text(`Student Code: ${enrollment.studentCode}`);
      doc.text(`Full Name: ${enrollment.fullName}`);
      doc.text(`Org Unit Code: ${enrollment.orgUnitCode}`);
      doc.text(`Org Unit Name: ${enrollment.orgUnitName}`);
      doc.text(`Course Code: ${enrollment.courseCode}`);
      doc.text(`Course Name: ${enrollment.courseName}`);
      doc.text(`Status: ${enrollment.status}`);
      doc.text(`Start Date: ${enrollment.startDate}`);
      doc.text(`End Date: ${enrollment.endDate}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting enrollments PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/attendance.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, date, courseCode } = req.query;

    // Validate date if provided
    if (date && !isValidDate(date as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        sa."id",
        sa."classDate",
        sa."status",
        sa."remarks",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        acs."courseCode",
        acs."dayOfWeek",
        u."username" as "recordedByName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName"
      FROM "StudentAttendance" sa
      JOIN "Student" s ON sa."studentId" = s."id"
      JOIN "AbacusClassSchedule" acs ON sa."scheduleId" = acs."id"
      JOIN "User" u ON sa."recordedById" = u."id"
      JOIN "OrgUnit" o ON sa."orgUnitId" = o."id"
      WHERE sa."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add date filter
    if (date) {
      query += ` AND sa."classDate" = $${queryParams.length + 1}`;
      queryParams.push(new Date(date as string));
    }

    // Add course code filter
    if (courseCode) {
      query += ` AND acs."courseCode" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    query += ` ORDER BY sa."classDate" DESC, s."firstName", s."lastName"`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const attendance = result.map((record: any) => ({
      attendanceId: record.id,
      studentCode: record.studentCode,
      studentName: `${record.firstName} ${record.lastName}`,
      courseCode: record.courseCode,
      dayOfWeek: record.dayOfWeek,
      classDate: formatDate(record.classDate),
      status: record.status,
      remarks: record.remarks,
      recordedByName: record.recordedByName,
      orgUnitCode: record.orgUnitCode,
      orgUnitName: record.orgUnitName
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(18).text('Attendance Report', { align: 'center' });
    doc.moveDown();

    // Write PDF rows
    attendance.forEach((record: any) => {
      doc.text(`Attendance ID: ${record.attendanceId}`);
      doc.text(`Student Code: ${record.studentCode}`);
      doc.text(`Student Name: ${record.studentName}`);
      doc.text(`Course Code: ${record.courseCode}`);
      doc.text(`Day of Week: ${record.dayOfWeek}`);
      doc.text(`Class Date: ${record.classDate}`);
      doc.text(`Status: ${record.status}`);
      doc.text(`Remarks: ${record.remarks}`);
      doc.text(`Recorded By: ${record.recordedByName}`);
      doc.text(`Org Unit Code: ${record.orgUnitCode}`);
      doc.text(`Org Unit Name: ${record.orgUnitName}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting attendance PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/finance.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates
    if (!fromDate || !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Valid fromDate is required. Use YYYY-MM-DD.');
    }

    if (!toDate || !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Valid toDate is required. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for finance report
    let query = `
      SELECT 
        pt."id" as "transactionId",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        pt."amount",
        pt."type",
        pt."method",
        pt."notes",
        pt."createdAt"
      FROM "PaymentTransaction" pt
      JOIN "OrgUnit" o ON pt."orgUnitId" = o."id"
      WHERE pt."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add date range filter
    if (fromDate) {
      query += ` AND pt."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND pt."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY pt."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const transactions = result.map((transaction: any) => ({
      transactionId: transaction.transactionId,
      orgUnitCode: transaction.orgUnitCode,
      orgUnitName: transaction.orgUnitName,
      amount: parseInt(transaction.amount?.toString() || '0') || 0,
      type: transaction.type,
      method: transaction.method,
      notes: transaction.notes,
      createdAt: formatDate(transaction.createdAt)
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="finance-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(18).text('Finance Report', { align: 'center' });
    doc.moveDown();

    // Write PDF rows
    transactions.forEach((transaction: any) => {
      doc.text(`Transaction ID: ${transaction.transactionId}`);
      doc.text(`Org Unit Code: ${transaction.orgUnitCode}`);
      doc.text(`Org Unit Name: ${transaction.orgUnitName}`);
      doc.text(`Amount: ${transaction.amount}`);
      doc.text(`Type: ${transaction.type}`);
      doc.text(`Method: ${transaction.method}`);
      doc.text(`Notes: ${transaction.notes}`);
      doc.text(`Created At: ${transaction.createdAt}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting finance PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/assessments.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, levelId, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for assessments report
    let query = `
      SELECT 
        a."id" as "assessmentId",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        c."code" as "courseCode",
        c."name" as "courseName",
        al."name" as "levelName",
        al."order" as "levelOrder",
        a."scorePercent",
        a."passed",
        a."attemptDate",
        a."remarks"
      FROM "AbacusAssessment" a
      JOIN "AbacusEnrollment" ae ON a."enrollmentId" = ae."id"
      JOIN "Student" s ON ae."studentId" = s."id"
      JOIN "AbacusCourse" c ON ae."courseId" = c."id"
      JOIN "AbacusLevel" al ON a."levelId" = al."id"
      JOIN "OrgUnit" o ON ae."orgUnitId" = o."id"
      WHERE ae."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add level filter
    if (levelId) {
      const levelIdNum = parseInt(levelId as string);
      if (!isNaN(levelIdNum)) {
        query += ` AND al."id" = $${queryParams.length + 1}`;
        queryParams.push(levelIdNum);
      }
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND a."attemptDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND a."attemptDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY a."attemptDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const assessments = result.map((assessment: any) => ({
      assessmentId: assessment.assessmentId,
      studentId: assessment.studentId,
      studentCode: assessment.studentCode,
      fullName: assessment.lastName ? `${assessment.firstName} ${assessment.lastName}` : assessment.firstName,
      orgUnitCode: assessment.orgUnitCode,
      orgUnitName: assessment.orgUnitName,
      courseCode: assessment.courseCode,
      courseName: assessment.courseName,
      levelName: assessment.levelName,
      levelOrder: assessment.levelOrder,
      scorePercent: assessment.scorePercent,
      passed: assessment.passed,
      attemptDate: formatDate(assessment.attemptDate),
      remarks: assessment.remarks
    }));

    // Create PDF
    const doc = new PDFDocument();
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', 'attachment; filename="assessments-report.pdf"');
      res.send(pdfData);
    });

    // Write PDF header
    doc.fontSize(18).text('Assessments Report', { align: 'center' });
    doc.moveDown();

    // Write PDF rows
    assessments.forEach((assessment: any) => {
      doc.text(`Assessment ID: ${assessment.assessmentId}`);
      doc.text(`Student ID: ${assessment.studentId}`);
      doc.text(`Student Code: ${assessment.studentCode}`);
      doc.text(`Full Name: ${assessment.fullName}`);
      doc.text(`Org Unit Code: ${assessment.orgUnitCode}`);
      doc.text(`Org Unit Name: ${assessment.orgUnitName}`);
      doc.text(`Course Code: ${assessment.courseCode}`);
      doc.text(`Course Name: ${assessment.courseName}`);
      doc.text(`Level Name: ${assessment.levelName}`);
      doc.text(`Level Order: ${assessment.levelOrder}`);
      doc.text(`Score Percent: ${assessment.scorePercent}`);
      doc.text(`Passed: ${assessment.passed}`);
      doc.text(`Attempt Date: ${assessment.attemptDate}`);
      doc.text(`Remarks: ${assessment.remarks}`);
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting assessments PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PDF Export Endpoints
router.get('/students.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Reuse the same logic as the JSON endpoint but format as PDF
    const { orgUnitId, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ACTIVE', 'INACTIVE', 'ALL'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ACTIVE, INACTIVE, ALL.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        o."name" as "orgUnitName",
        s."status",
        s."createdAt"
      FROM "Student" s
      LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
      WHERE s."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add status filter
    if (status && (status as string).toUpperCase() !== 'ALL') {
      query += ` AND s."status" = $${queryParams.length + 1}`;
      queryParams.push(status as string);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND s."createdAt" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND s."createdAt" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY s."createdAt" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const students = result.map((student: any) => ({
      studentId: student.studentId,
      studentCode: student.studentCode,
      fullName: student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName,
      orgUnitCode: student.orgUnitCode,
      orgUnitName: student.orgUnitName,
      status: student.status,
      createdAt: formatDate(student.createdAt)
    }));

    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="students-report.pdf"');
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    doc.fontSize(18).text('Students Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10);
    const headerY = 100;
    doc.text('Student ID', 50, headerY);
    doc.text('Student Code', 120, headerY);
    doc.text('Full Name', 200, headerY);
    doc.text('Org Unit', 320, headerY);
    doc.text('Status', 420, headerY);
    doc.text('Created At', 480, headerY);
    
    // Add horizontal line
    doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke();
    
    // Add data rows
    let y = headerY + 30;
    students.forEach((student: any) => {
      if (y > 700) { // Start a new page if needed
        doc.addPage();
        y = 50;
      }
      
      doc.text(student.studentId.toString(), 50, y);
      doc.text(student.studentCode, 120, y);
      doc.text(student.fullName, 200, y);
      doc.text(`${student.orgUnitCode} (${student.orgUnitName})`, 320, y);
      doc.text(student.status, 420, y);
      doc.text(student.createdAt, 480, y);
      
      y += 20;
    });
    
    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error exporting students PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/enrollments.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, status, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['ONGOING', 'COMPLETED', 'CANCELLED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: ONGOING, COMPLETED, CANCELLED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        e."id" as "enrollmentId",
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        c."name" as "courseName",
        o."code" as "orgUnitCode",
        e."status",
        e."startDate",
        e."endDate",
        m."title" as "currentModule",
        l."name" as "currentLevel"
      FROM "AbacusEnrollment" e
      LEFT JOIN "Student" s ON e."studentId" = s."id"
      LEFT JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
      LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
      WHERE e."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add status filter
    if (status) {
      query += ` AND e."status" = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND e."startDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND e."startDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    query += ` ORDER BY e."startDate" DESC`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const enrollments = result.map((enrollment: any) => ({
      enrollmentId: enrollment.enrollmentId,
      studentName: enrollment.lastName ? `${enrollment.firstName} ${enrollment.lastName}` : enrollment.firstName,
      courseCode: enrollment.courseCode,
      courseName: enrollment.courseName,
      orgUnitCode: enrollment.orgUnitCode,
      status: enrollment.status,
      startDate: enrollment.startDate ? formatDate(enrollment.startDate) : null,
      endDate: enrollment.endDate ? formatDate(enrollment.endDate) : null,
      currentModule: enrollment.currentModule,
      currentLevel: enrollment.currentLevel
    }));

    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="enrollments-report.pdf"');
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    doc.fontSize(18).text('Enrollments Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10);
    const headerY = 100;
    doc.text('Student', 50, headerY);
    doc.text('Course', 150, headerY);
    doc.text('Org Unit', 250, headerY);
    doc.text('Status', 330, headerY);
    doc.text('Start Date', 400, headerY);
    doc.text('Current Level', 480, headerY);
    
    // Add horizontal line
    doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke();
    
    // Add data rows
    let y = headerY + 30;
    enrollments.forEach((enrollment: any) => {
      if (y > 700) { // Start a new page if needed
        doc.addPage();
        y = 50;
      }
      
      doc.text(enrollment.studentName, 50, y);
      doc.text(`${enrollment.courseCode} (${enrollment.courseName})`, 150, y);
      doc.text(enrollment.orgUnitCode, 250, y);
      doc.text(enrollment.status, 330, y);
      doc.text(enrollment.startDate || '-', 400, y);
      doc.text(enrollment.currentLevel || '-', 480, y);
      
      y += 20;
    });
    
    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error exporting enrollments PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/attendance.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, date, fromDate, toDate, courseCode, status } = req.query;

    // Validate dates if provided
    if (date && !isValidDate(date as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD.');
    }

    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate status if provided
    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (status && !isValidStatus(status as string, validStatuses)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid status. Valid values: PRESENT, ABSENT, LATE, EXCUSED.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        a."classDate" as "date",
        s."firstName",
        s."lastName",
        o."code" as "orgUnitCode",
        sch."courseCode" as "courseCode",
        a."status",
        a."remarks"
      FROM "StudentAttendance" a
      LEFT JOIN "Student" s ON a."studentId" = s."id"
      LEFT JOIN "OrgUnit" o ON a."orgUnitId" = o."id"
      LEFT JOIN "AbacusClassSchedule" sch ON a."scheduleId" = sch."id"
      WHERE a."orgUnitId" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add date filter
    if (date) {
      query += ` AND a."classDate" = $${queryParams.length + 1}`;
      queryParams.push(new Date(date as string));
    } else {
      if (fromDate) {
        query += ` AND a."classDate" >= $${queryParams.length + 1}`;
        queryParams.push(new Date(fromDate as string));
      }

      if (toDate) {
        query += ` AND a."classDate" <= $${queryParams.length + 1}`;
        queryParams.push(new Date(toDate as string));
      }
    }

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add status filter
    if (status) {
      query += ` AND a."status" = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY a."classDate" DESC, s."firstName", s."lastName"`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const attendance = result.map((record: any) => ({
      date: formatDate(record.date),
      studentName: record.lastName ? `${record.firstName} ${record.lastName}` : record.firstName,
      orgUnitCode: record.orgUnitCode,
      courseCode: record.courseCode,
      status: record.status,
      remarks: record.remarks
    }));

    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    doc.fontSize(18).text('Attendance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10);
    const headerY = 100;
    doc.text('Date', 50, headerY);
    doc.text('Student', 120, headerY);
    doc.text('Org Unit', 220, headerY);
    doc.text('Course', 300, headerY);
    doc.text('Status', 380, headerY);
    doc.text('Remarks', 450, headerY);
    
    // Add horizontal line
    doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke();
    
    // Add data rows
    let y = headerY + 30;
    attendance.forEach((record: any) => {
      if (y > 700) { // Start a new page if needed
        doc.addPage();
        y = 50;
      }
      
      doc.text(record.date, 50, y);
      doc.text(record.studentName, 120, y);
      doc.text(record.orgUnitCode, 220, y);
      doc.text(record.courseCode, 300, y);
      doc.text(record.status, 380, y);
      doc.text(record.remarks || '-', 450, y);
      
      y += 20;
    });
    
    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error exporting attendance PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/finance.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, fromDate, toDate } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query for finance summary
    let summaryQuery = `
      SELECT 
        o."code" as "centerCode",
        o."name" as "centerName",
        COALESCE(SUM(sfr."amount"), 0) as "totalDue",
        COALESCE(SUM(CASE WHEN sfr."status" = 'PAID' THEN sfr."amount" ELSE 0 END), 0) as "totalPaid",
        COALESCE(SUM(CASE WHEN sfr."status" = 'PENDING' THEN sfr."amount" ELSE 0 END), 0) as "outstanding"
      FROM "OrgUnit" o
      LEFT JOIN "StudentFeeRecord" sfr ON o."id" = sfr."orgUnitId"
      WHERE o."id" = ANY($1) AND o."type" = 'CENTER'
      GROUP BY o."id", o."code", o."name"
      ORDER BY o."code"
    `;

    const summaryResult: any = await prisma.$queryRawUnsafe(summaryQuery, targetOrgUnits);

    // Format response
    const financeSummary = summaryResult.map((record: any) => ({
      centerCode: record.centerCode,
      centerName: record.centerName,
      totalDue: parseInt(record.totalDue.toString()),
      totalPaid: parseInt(record.totalPaid.toString()),
      outstanding: parseInt(record.outstanding.toString())
    }));

    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="finance-report.pdf"');
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    doc.fontSize(18).text('Finance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10);
    const headerY = 100;
    doc.text('Center', 50, headerY);
    doc.text('Total Due', 200, headerY);
    doc.text('Total Paid', 300, headerY);
    doc.text('Outstanding', 400, headerY);
    
    // Add horizontal line
    doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke();
    
    // Add data rows
    let y = headerY + 30;
    financeSummary.forEach((record: any) => {
      if (y > 700) { // Start a new page if needed
        doc.addPage();
        y = 50;
      }
      
      doc.text(`${record.centerCode} (${record.centerName})`, 50, y);
      doc.text(`₹${record.totalDue.toLocaleString()}`, 200, y);
      doc.text(`₹${record.totalPaid.toLocaleString()}`, 300, y);
      doc.text(`₹${record.outstanding.toLocaleString()}`, 400, y);
      
      y += 20;
    });
    
    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error exporting finance PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/assessments.pdf', authRequired, reportAccessRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    const { orgUnitId, courseCode, fromDate, toDate, minScore, maxScore } = req.query;

    // Validate dates if provided
    if (fromDate && !isValidDate(fromDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid fromDate format. Use YYYY-MM-DD.');
    }

    if (toDate && !isValidDate(toDate as string)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid toDate format. Use YYYY-MM-DD.');
    }

    // Validate scores if provided
    let minScoreValue: number | null = null;
    let maxScoreValue: number | null = null;

    if (minScore) {
      minScoreValue = parseInt(minScore as string);
      if (isNaN(minScoreValue)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid minScore. Must be a number.');
      }
    }

    if (maxScore) {
      maxScoreValue = parseInt(maxScore as string);
      if (isNaN(maxScoreValue)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid maxScore. Must be a number.');
      }
    }

    // Get allowed org units for the user
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId ?? null);

    // If orgUnitId is provided, check if user can access it
    let targetOrgUnits = allowedOrgUnits;
    if (orgUnitId) {
      const orgId = parseInt(orgUnitId as string);
      if (isNaN(orgId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid orgUnitId.');
      }

      // For non-SUPERADMIN users, check if they can access the specified org unit
      if (!isSuperadmin(req.user.role)) {
        if (!allowedOrgUnits.includes(orgId)) {
          return fail(res, 403, 'ACCESS_DENIED', 'Access denied to specified org unit.');
        }
      }

      targetOrgUnits = [orgId];
    }

    // Build query
    let query = `
      SELECT 
        s."firstName",
        s."lastName",
        c."code" as "courseCode",
        l."name" as "levelName",
        a."scorePercent",
        a."passed",
        a."attemptDate",
        a."remarks"
      FROM "AbacusAssessment" a
      LEFT JOIN "AbacusEnrollment" e ON a."enrollmentId" = e."id"
      LEFT JOIN "Student" s ON e."studentId" = s."id"
      LEFT JOIN "AbacusCourse" c ON e."courseId" = c."id"
      LEFT JOIN "AbacusLevel" l ON a."levelId" = l."id"
      LEFT JOIN "OrgUnit" o ON e."orgUnitId" = o."id"
      WHERE o."id" = ANY($1)
    `;

    const queryParams: unknown[] = [targetOrgUnits];

    // Add course code filter
    if (courseCode) {
      query += ` AND c."code" = $${queryParams.length + 1}`;
      queryParams.push(courseCode);
    }

    // Add date range filter
    if (fromDate) {
      query += ` AND a."attemptDate" >= $${queryParams.length + 1}`;
      queryParams.push(new Date(fromDate as string));
    }

    if (toDate) {
      query += ` AND a."attemptDate" <= $${queryParams.length + 1}`;
      queryParams.push(new Date(toDate as string));
    }

    // Add score range filter
    if (minScoreValue !== null) {
      query += ` AND a."scorePercent" >= $${queryParams.length + 1}`;
      queryParams.push(minScoreValue);
    }

    if (maxScoreValue !== null) {
      query += ` AND a."scorePercent" <= $${queryParams.length + 1}`;
      queryParams.push(maxScoreValue);
    }

    query += ` ORDER BY a."attemptDate" DESC, s."firstName", s."lastName"`;

    const result: any = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Format response
    const assessments = result.map((assessment: any) => ({
      studentName: assessment.lastName ? `${assessment.firstName} ${assessment.lastName}` : assessment.firstName,
      courseCode: assessment.courseCode,
      levelName: assessment.levelName,
      score: assessment.scorePercent,
      status: assessment.passed ? 'PASS' : 'FAIL',
      date: formatDate(assessment.attemptDate),
      remarks: assessment.remarks
    }));

    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="assessments-report.pdf"');
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add content to the PDF
    doc.fontSize(18).text('Assessments Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add table headers
    doc.fontSize(10);
    const headerY = 100;
    doc.text('Student', 50, headerY);
    doc.text('Course', 150, headerY);
    doc.text('Level', 230, headerY);
    doc.text('Score', 310, headerY);
    doc.text('Status', 380, headerY);
    doc.text('Date', 450, headerY);
    
    // Add horizontal line
    doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke();
    
    // Add data rows
    let y = headerY + 30;
    assessments.forEach((assessment: any) => {
      if (y > 700) { // Start a new page if needed
        doc.addPage();
        y = 50;
      }
      
      doc.text(assessment.studentName, 50, y);
      doc.text(assessment.courseCode, 150, y);
      doc.text(assessment.levelName, 230, y);
      doc.text(assessment.score.toString(), 310, y);
      doc.text(assessment.status, 380, y);
      doc.text(assessment.date, 450, y);
      
      y += 20;
    });
    
    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error exporting assessments PDF:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
// @ts-nocheck
