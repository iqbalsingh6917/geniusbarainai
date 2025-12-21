import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isCenterManager, isTeacher } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { logAudit } from '../services/auditService';

const router = Router();

router.get('/attempts', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !(isTeacher(req.user.role) || isCenterManager(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }

    const studentId = req.query.studentId ? parseInt(String(req.query.studentId), 10) : null;
    const worksheetId = req.query.worksheetId ? parseInt(String(req.query.worksheetId), 10) : null;

    let params: any[] = [];
    let hasWhere = false;
    let query = `
      SELECT 
        swa."id" as "attemptId",
        swa."status",
        swa."submittedAt",
        swa."totalScore",
        swa."maxScore",
        swa."assignmentId",
        swa."reviewedAt",
        swa."teacherComment",
        swa."teacherAdjustedScore",
        s."id" as "studentId",
        s."firstName" as "studentFirstName",
        s."lastName" as "studentLastName",
        w."id" as "worksheetId",
        w."title" as "worksheetTitle",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "StudentWorksheetAttempt" swa
      JOIN "Student" s ON s."id" = swa."studentId"
      JOIN "AbacusWorksheet" w ON w."id" = swa."worksheetId"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
    `;

    if (isTeacher(req.user.role)) {
      query += `
        JOIN "TeacherStudentAssignment" tsa 
          ON tsa."studentId" = s."id" 
         AND tsa."teacherUserId" = $1
      `;
      params.push(req.user.id);
    } else if (req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
      if (allowed.length === 0) {
        return ok(res, []);
      }
      query += ` WHERE s."orgUnitId" = ANY($1)`;
      params.push(allowed);
      hasWhere = true;
    }

    let idx = params.length + 1;
    const filters: string[] = [];
    if (studentId) {
      filters.push(`s."id" = $${idx++}`);
      params.push(studentId);
    }
    if (worksheetId) {
      filters.push(`w."id" = $${idx++}`);
      params.push(worksheetId);
    }
    if (filters.length > 0) {
      query += hasWhere ? ` AND ${filters.join(' AND ')}` : ` WHERE ${filters.join(' AND ')}`;
      hasWhere = true;
    }

    query += ` ORDER BY swa."submittedAt" DESC NULLS LAST, swa."createdAt" DESC`;

    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);
    const attempts = rows.map((row: any) => ({
      id: row.attemptId,
      status: row.status,
      submittedAt: row.submittedAt,
      totalScore: row.totalScore,
      maxScore: row.maxScore,
      assignmentId: row.assignmentId,
      reviewedAt: row.reviewedAt,
      teacherComment: row.teacherComment,
      teacherAdjustedScore: row.teacherAdjustedScore,
      student: {
        id: row.studentId,
        name: `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
      },
      worksheet: {
        id: row.worksheetId,
        title: row.worksheetTitle,
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
    }));

    await logAudit(req, {
      action: 'TEACHER_WORKSHEET_ATTEMPTS_VIEWED',
      entityType: 'StudentWorksheetAttempt',
      meta: { count: attempts.length, studentId, worksheetId },
    });

    ok(res, attempts);
  } catch (error) {
    console.error('Error fetching worksheet attempts:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

router.get('/attempts/history/:studentId', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !(isTeacher(req.user.role) || isCenterManager(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }
    const studentId = parseInt(req.params.studentId, 10);
    if (Number.isNaN(studentId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid student id');
    }

    if (isTeacher(req.user.role)) {
      const assignment: any = await prisma.$queryRaw`
        SELECT 1 FROM "TeacherStudentAssignment"
        WHERE "teacherUserId" = ${req.user.id} AND "studentId" = ${studentId}
        LIMIT 1
      `;
      if (assignment.length === 0) {
        return fail(res, 403, 'ACCESS_DENIED', 'Teacher not assigned to student');
      }
    } else if (isCenterManager(req.user.role) && req.user.orgUnitId) {
      const allowed = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
      const student: any = await prisma.$queryRaw`
        SELECT "orgUnitId" FROM "Student" WHERE "id" = ${studentId}
      `;
      if (!student || student.length === 0 || !allowed.includes(student[0].orgUnitId)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Student outside your center');
      }
    }

    const rows: any[] = await prisma.$queryRaw`
      SELECT 
        swa."id" as "attemptId",
        swa."status",
        swa."submittedAt",
        swa."totalScore",
        swa."maxScore",
        swa."assignmentId",
        swa."reviewedAt",
        swa."teacherComment",
        swa."teacherAdjustedScore",
        w."id" as "worksheetId",
        w."title" as "worksheetTitle",
        l."id" as "levelId",
        l."name" as "levelName",
        l."order" as "levelOrder",
        m."id" as "moduleId",
        m."title" as "moduleTitle",
        m."index" as "moduleIndex",
        c."code" as "courseCode",
        c."name" as "courseName"
      FROM "StudentWorksheetAttempt" swa
      JOIN "AbacusWorksheet" w ON w."id" = swa."worksheetId"
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      WHERE swa."studentId" = ${studentId}
      ORDER BY swa."submittedAt" DESC NULLS LAST, swa."createdAt" DESC
    `;

    const attempts = rows.map((row: any) => ({
      id: row.attemptId,
      status: row.status,
      submittedAt: row.submittedAt,
      totalScore: row.totalScore,
      maxScore: row.maxScore,
      assignmentId: row.assignmentId,
      reviewedAt: row.reviewedAt,
      teacherComment: row.teacherComment,
      teacherAdjustedScore: row.teacherAdjustedScore,
      worksheet: {
        id: row.worksheetId,
        title: row.worksheetTitle,
      },
      level: { id: row.levelId, name: row.levelName, order: row.levelOrder },
      module: { id: row.moduleId, name: row.moduleTitle, index: row.moduleIndex },
      course: { code: row.courseCode, name: row.courseName },
    }));

    await logAudit(req, {
      action: 'TEACHER_WORKSHEET_ATTEMPTS_HISTORY_VIEWED',
      entityType: 'StudentWorksheetAttempt',
      meta: { count: attempts.length, studentId },
    });

    ok(res, attempts);
  } catch (error) {
    console.error('Error fetching attempt history:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
