// @ts-nocheck
import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import {
  isCenterManager,
  isAdmissions,
  isTeacher,
  isStudent,
  isSuperadmin,
} from '../constants/roles';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

const statusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);

const createAssignmentSchema = z.object({
  studentId: z.number(),
  worksheetId: z.number(),
  enrollmentId: z.number().optional(),
  status: statusEnum.optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateAssignmentSchema = z.object({
  status: statusEnum.optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// Helpers
const isCenterRole = (role: string) => isCenterManager(role) || isAdmissions(role);

async function ensureTeacherCanAccessStudent(userId: number, studentId: number, orgUnitId: number | null) {
  if (!orgUnitId) return false;
  const assignment: any = await prisma.$queryRaw`
    SELECT 1 FROM "TeacherStudentAssignment"
    WHERE "teacherUserId" = ${userId} AND "studentId" = ${studentId}
    LIMIT 1
  `;
  if (assignment.length > 0) return true;
  // fallback: same org unit
  const student: any = await prisma.$queryRaw`
    SELECT "orgUnitId" FROM "Student" WHERE "id" = ${studentId}
  `;
  if (student.length === 0) return false;
  return student[0].orgUnitId === orgUnitId;
}

function mapAssignmentRow(row: any) {
  return {
    id: row.assignmentId,
    status: row.status,
    dueDate: row.dueDate,
    submittedAt: row.submittedAt,
    notes: row.notes,
    student: {
      id: row.studentId,
      code: row.studentCode,
      name: `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
    },
    worksheet: {
      id: row.worksheetId,
      title: row.worksheetTitle,
      kind: row.worksheetKind,
      difficultyBand: row.worksheetDifficultyBand,
      questionCount: row.worksheetQuestionCount,
    },
    level: {
      id: row.levelId,
      name: row.levelName,
      order: row.levelOrder,
    },
    module: {
      id: row.moduleId,
      name: row.moduleTitle,
      index: row.moduleIndex,
    },
    course: {
      code: row.courseCode,
      name: row.courseName,
    },
  };
}

// GET /api/worksheet-assignments/center
router.get('/center', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !(isCenterRole(req.user.role) || isSuperadmin(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }
    const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId || null);
    const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const courseCode = req.query.courseCode ? String(req.query.courseCode) : null;

    let query = `
      SELECT 
        swa."id" as "assignmentId",
        swa."status",
        swa."dueDate",
        swa."submittedAt",
        swa."notes",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName" as "studentFirstName",
        s."lastName" as "studentLastName",
        w."id" as "worksheetId",
        w."title" as "worksheetTitle",
        w."kind" as "worksheetKind",
        w."difficultyBand" as "worksheetDifficultyBand",
        w."questionCount" as "worksheetQuestionCount",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "StudentWorksheetAssignment" swa
      JOIN "Student" s ON swa."studentId" = s."id"
      JOIN "AbacusWorksheet" w ON swa."worksheetId" = w."id"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      WHERE s."orgUnitId" = ANY($1)
    `;
    const params: any[] = [allowed];
    let idx = 2;
    if (studentId) {
      query += ` AND s."id" = $${idx++}`;
      params.push(studentId);
    }
    if (status) {
      query += ` AND swa."status" = $${idx++}`;
      params.push(status);
    }
    if (courseCode) {
      query += ` AND c."code" = $${idx++}`;
      params.push(courseCode);
    }
    query += ` ORDER BY swa."createdAt" DESC`;

    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);
    const assignments = rows.map(mapAssignmentRow);

    await logAudit(req, {
      action: 'WORKSHEET_ASSIGNMENTS_CENTER_VIEWED',
      entityType: 'StudentWorksheetAssignment',
      meta: { count: assignments.length },
    });

    ok(res, assignments);
  } catch (error) {
    console.error('Error fetching center assignments:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/worksheet-assignments/teacher
router.get('/teacher', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Teacher role required');
    }
    const teacherId = req.user.id;
    const status = req.query.status ? String(req.query.status) : null;
    const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : null;

    let query = `
      SELECT 
        swa."id" as "assignmentId",
        swa."status",
        swa."dueDate",
        swa."submittedAt",
        swa."notes",
        s."id" as "studentId",
        s."code" as "studentCode",
        s."firstName" as "studentFirstName",
        s."lastName" as "studentLastName",
        w."id" as "worksheetId",
        w."title" as "worksheetTitle",
        w."kind" as "worksheetKind",
        w."difficultyBand" as "worksheetDifficultyBand",
        w."questionCount" as "worksheetQuestionCount",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "StudentWorksheetAssignment" swa
      JOIN "Student" s ON swa."studentId" = s."id"
      JOIN "AbacusWorksheet" w ON swa."worksheetId" = w."id"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      WHERE (
        swa."assignedByUserId" = $1
        OR EXISTS (
          SELECT 1 FROM "TeacherStudentAssignment" tsa
          WHERE tsa."teacherUserId" = $1 AND tsa."studentId" = s."id"
        )
      )
    `;
    const params: any[] = [teacherId];
    let idx = 2;
    if (studentId) {
      query += ` AND s."id" = $${idx++}`;
      params.push(studentId);
    }
    if (status) {
      query += ` AND swa."status" = $${idx++}`;
      params.push(status);
    }
    query += ` ORDER BY swa."createdAt" DESC`;

    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);
    const assignments = rows.map(mapAssignmentRow);

    await logAudit(req, {
      action: 'WORKSHEET_ASSIGNMENTS_TEACHER_VIEWED',
      entityType: 'StudentWorksheetAssignment',
      meta: { count: assignments.length, teacherId },
    });

    ok(res, assignments);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/worksheet-assignments
router.post('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !(isCenterRole(req.user.role) || isTeacher(req.user.role) || isSuperadmin(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Insufficient role');
    }
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }
    const { studentId, worksheetId, enrollmentId, status, dueDate, notes } = parsed.data;

    // Validate student
    const student: any = await prisma.$queryRaw`SELECT "id","orgUnitId" FROM "Student" WHERE "id" = ${studentId}`;
    if (student.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Student not found');
    }
    const studentOrg = student[0].orgUnitId;

    // Scope checks
    if (isCenterRole(req.user.role) && req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
      if (!allowed.includes(studentOrg)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Student outside your org scope');
      }
    }
    if (isTeacher(req.user.role)) {
      const canAccess = await ensureTeacherCanAccessStudent(req.user.id, studentId, req.user.orgUnitId);
      if (!canAccess) {
        return fail(res, 403, 'ACCESS_DENIED', 'Teacher not assigned to student');
      }
    }

    // Validate worksheet
    const worksheet: any = await prisma.$queryRaw`
      SELECT w."id", l."id" as "levelId", m."courseId"
      FROM "AbacusWorksheet" w
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      WHERE w."id" = ${worksheetId}
    `;
    if (worksheet.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Worksheet not found');
    }

    if (enrollmentId) {
      const enrollment: any = await prisma.$queryRaw`
        SELECT "id","studentId","courseId" FROM "AbacusEnrollment" WHERE "id" = ${enrollmentId}
      `;
      if (enrollment.length === 0 || enrollment[0].studentId !== studentId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Enrollment does not belong to student');
      }
      // Optionally ensure course matches worksheet course
      if (enrollment[0].courseId !== worksheet[0].courseId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Worksheet course mismatch');
      }
    }

    const created: any = await prisma.$queryRaw`
      INSERT INTO "StudentWorksheetAssignment" 
      ("studentId","worksheetId","enrollmentId","assignedByUserId","status","dueDate","notes","createdAt","updatedAt")
      VALUES (
        ${studentId}, ${worksheetId}, ${enrollmentId || null}, ${req.user.id},
        ${status || 'NOT_STARTED'}, ${dueDate ? new Date(dueDate) : null}, ${notes || null}, NOW(), NOW()
      )
      RETURNING *
    `;

    await logAudit(req, {
      action: 'WORKSHEET_ASSIGNMENT_CREATED',
      entityType: 'StudentWorksheetAssignment',
      entityId: created[0].id,
      meta: { studentId, worksheetId },
    });

    ok(res, created[0], 201);
  } catch (error) {
    console.error('Error creating worksheet assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /api/worksheet-assignments/:id
router.put('/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);
    if (isNaN(assignmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid assignment id');
    }
    if (!req.user) {
      return fail(res, 401, 'AUTH_REQUIRED', 'Auth required');
    }
    const parsed = updateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }
    const { status, dueDate, notes } = parsed.data;

    const assignment: any = await prisma.$queryRaw`
      SELECT swa."id", swa."studentId", swa."status", s."orgUnitId"
      FROM "StudentWorksheetAssignment" swa
      JOIN "Student" s ON swa."studentId" = s."id"
      WHERE swa."id" = ${assignmentId}
    `;
    if (assignment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Assignment not found');
    }
    const current = assignment[0];

    // Student self-update
    if (isStudent(req.user.role)) {
      if (req.user.studentId !== current.studentId) {
        return fail(res, 403, 'ACCESS_DENIED', 'Cannot update other student assignments');
      }
      if (!status) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Status required');
      }
      if (dueDate !== undefined || notes !== undefined) {
        return fail(res, 403, 'ACCESS_DENIED', 'Students cannot edit due date or notes');
      }
      const nextStatus = status;
      const shouldSetSubmitted = nextStatus === 'COMPLETED' && current.status !== 'COMPLETED';
      const updated: any = await prisma.$queryRaw`
        UPDATE "StudentWorksheetAssignment"
        SET "status" = ${nextStatus},
            "submittedAt" = ${shouldSetSubmitted ? new Date() : null},
            "updatedAt" = NOW()
        WHERE "id" = ${assignmentId}
        RETURNING *
      `;
      await logAudit(req, {
        action: 'WORKSHEET_ASSIGNMENT_STATUS_UPDATED_STUDENT',
        entityType: 'StudentWorksheetAssignment',
        entityId: assignmentId,
        meta: { status: nextStatus },
      });
      return ok(res, updated[0]);
    }

    // Teacher/Center/Superadmin update
    const role = req.user.role;
    if (!(isCenterRole(role) || isTeacher(role) || isSuperadmin(role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Insufficient role');
    }
    if (isCenterRole(role) && req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(role, req.user.orgUnitId);
      if (!allowed.includes(current.orgUnitId)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Outside org scope');
      }
    }
    if (isTeacher(role)) {
      const canAccess = await ensureTeacherCanAccessStudent(req.user.id, current.studentId, req.user.orgUnitId);
      if (!canAccess) {
        return fail(res, 403, 'ACCESS_DENIED', 'Teacher not assigned to student');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (status) {
      updates.push(`"status" = $${idx++}`);
      params.push(status);
    }
    if (dueDate !== undefined) {
      updates.push(`"dueDate" = $${idx++}`);
      params.push(dueDate ? new Date(dueDate) : null);
    }
    if (notes !== undefined) {
      updates.push(`"notes" = $${idx++}`);
      params.push(notes || null);
    }
    if (updates.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'No fields to update');
    }
    let submittedClause = '';
    if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
      submittedClause = `, "submittedAt" = NOW()`;
    }
    const updated: any = await prisma.$queryRawUnsafe(
      `UPDATE "StudentWorksheetAssignment" SET ${updates.join(', ')}${submittedClause}, "updatedAt" = NOW() WHERE "id" = $${idx} RETURNING *`,
      ...params,
      assignmentId
    );

    await logAudit(req, {
      action: 'WORKSHEET_ASSIGNMENT_UPDATED',
      entityType: 'StudentWorksheetAssignment',
      entityId: assignmentId,
      meta: { status, dueDate, notes },
    });

    ok(res, updated[0]);
  } catch (error) {
    console.error('Error updating worksheet assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /api/worksheet-assignments/:id
router.delete('/:id', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);
    if (isNaN(assignmentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid assignment id');
    }
    if (!req.user || !(isCenterRole(req.user.role) || isTeacher(req.user.role) || isSuperadmin(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Insufficient role');
    }

    const assignment: any = await prisma.$queryRaw`
      SELECT swa."id", swa."studentId", s."orgUnitId"
      FROM "StudentWorksheetAssignment" swa
      JOIN "Student" s ON swa."studentId" = s."id"
      WHERE swa."id" = ${assignmentId}
    `;
    if (assignment.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Assignment not found');
    }
    const current = assignment[0];

    if (isCenterRole(req.user.role) && req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
      if (!allowed.includes(current.orgUnitId)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Outside org scope');
      }
    }
    if (isTeacher(req.user.role)) {
      const canAccess = await ensureTeacherCanAccessStudent(req.user.id, current.studentId, req.user.orgUnitId);
      if (!canAccess) {
        return fail(res, 403, 'ACCESS_DENIED', 'Teacher not assigned to student');
      }
    }

    await prisma.$queryRaw`DELETE FROM "StudentWorksheetAssignment" WHERE "id" = ${assignmentId}`;

    await logAudit(req, {
      action: 'WORKSHEET_ASSIGNMENT_DELETED',
      entityType: 'StudentWorksheetAssignment',
      entityId: assignmentId,
      meta: { studentId: current.studentId },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting worksheet assignment:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/worksheet-assignments/catalog/:studentId
router.get('/catalog/:studentId', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (isNaN(studentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student id');
    }
    if (!req.user || !(isTeacher(req.user.role) || isCenterRole(req.user.role) || isSuperadmin(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Insufficient role');
    }

    const student: any = await prisma.$queryRaw`SELECT "id","orgUnitId" FROM "Student" WHERE "id" = ${studentId}`;
    if (student.length === 0) {
      return fail(res, 404, 'NOT_FOUND', 'Student not found');
    }
    const studentOrg = student[0].orgUnitId;

    if (isCenterRole(req.user.role) && req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
      if (!allowed.includes(studentOrg)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Outside org scope');
      }
    }
    if (isTeacher(req.user.role)) {
      const canAccess = await ensureTeacherCanAccessStudent(req.user.id, studentId, req.user.orgUnitId);
      if (!canAccess) {
        return fail(res, 403, 'ACCESS_DENIED', 'Teacher not assigned to student');
      }
    }

    const enrollments: any[] = await prisma.$queryRaw`
      SELECT e."id" as "enrollmentId", c."id" as "courseId", c."code" as "courseCode", c."name" as "courseName"
      FROM "AbacusEnrollment" e
      JOIN "AbacusCourse" c ON e."courseId" = c."id"
      WHERE e."studentId" = ${studentId}
    `;
    const courseIds = enrollments.map((e) => e.courseId);
    if (courseIds.length === 0) {
      return ok(res, { studentId, courses: [] });
    }
    const modules: any[] = await prisma.$queryRaw`
      SELECT "id","courseId","index","title"
      FROM "AbacusModule"
      WHERE "courseId" = ANY(${courseIds}::int[])
      ORDER BY "index" ASC
    `;
    const moduleIds = modules.map((m) => m.id);
    const levels: any[] = moduleIds.length > 0 ? await prisma.$queryRaw`
      SELECT "id","moduleId","name","order"
      FROM "AbacusLevel"
      WHERE "moduleId" = ANY(${moduleIds}::int[])
      ORDER BY "order" ASC
    ` : [];
    const levelIds = levels.map((l) => l.id);
    const worksheets: any[] = levelIds.length > 0 ? await prisma.$queryRaw`
      SELECT "id","levelId","title","kind","difficultyBand","questionCount","notes"
      FROM "AbacusWorksheet"
      WHERE "levelId" = ANY(${levelIds}::int[])
      ORDER BY "id" ASC
    ` : [];

    const levelsByModule = levels.reduce((acc: any, level: any) => {
      if (!acc[level.moduleId]) acc[level.moduleId] = [];
      acc[level.moduleId].push(level);
      return acc;
    }, {});

    const worksheetsByLevel = worksheets.reduce((acc: any, worksheet: any) => {
      if (!acc[worksheet.levelId]) acc[worksheet.levelId] = [];
      acc[worksheet.levelId].push(worksheet);
      return acc;
    }, {});

    const modulesByCourse = modules.reduce((acc: any, module: any) => {
      if (!acc[module.courseId]) acc[module.courseId] = [];
      acc[module.courseId].push(module);
      return acc;
    }, {});

    const courses = enrollments.map((enrollment) => {
      const mods = modulesByCourse[enrollment.courseId] || [];
      return {
        courseId: enrollment.courseId,
        courseCode: enrollment.courseCode,
        courseName: enrollment.courseName,
        enrollmentId: enrollment.enrollmentId,
        modules: mods.map((module: any) => {
          const modLevels = levelsByModule[module.id] || [];
          return {
            moduleId: module.id,
            moduleName: module.title,
            moduleIndex: module.index,
            levels: modLevels.map((level: any) => ({
              levelId: level.id,
              levelName: level.name,
              levelOrder: level.order,
              worksheets: worksheetsByLevel[level.id] || [],
            })),
          };
        }),
      };
    });

    ok(res, { studentId, courses });
  } catch (error) {
    console.error('Error fetching worksheet catalog:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
// @ts-nocheck
