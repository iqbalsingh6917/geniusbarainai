import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { isTeacher } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';

const router = Router();
const prisma = new PrismaClient();

// GET /api/teacher/worksheets
// Role: TEACHER only
router.get('/worksheets', authRequired, requireRole(['TEACHER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    // Get allowed org units for the teacher
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get worksheets assigned to students of this teacher
    const worksheets: any = await prisma.$queryRaw`
      SELECT DISTINCT
        w."id",
        w."title",
        w."kind",
        w."difficultyBand",
        w."questionCount",
        l."name" AS "levelName",
        l."order" AS "levelOrder",
        m."title" AS "moduleTitle",
        m."index" AS "moduleIndex",
        c."code" AS "courseCode",
        c."name" AS "courseName",
        COUNT(swa."id") AS "assignedCount",
        COUNT(CASE WHEN swa."status" = 'COMPLETED' THEN 1 END) AS "completedCount"
      FROM "AbacusWorksheet" w
      JOIN "AbacusLevel" l ON w."levelId" = l."id"
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      JOIN "AbacusCourse" c ON m."courseId" = c."id"
      JOIN "StudentWorksheetAssignment" swa ON swa."worksheetId" = w."id"
      JOIN "Student" s ON swa."studentId" = s."id"
      JOIN "TeacherStudentAssignment" tsa ON tsa."studentId" = s."id"
      WHERE s."orgUnitId" = ANY($1)
        AND tsa."teacherUserId" = $2
      GROUP BY w."id", l."id", m."id", c."id"
      ORDER BY m."index", l."order", w."title"
    `;

    return ok(res, worksheets);
  } catch (error) {
    console.error('Error fetching teacher worksheets:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/teacher/exams
// Role: TEACHER only
router.get('/exams', authRequired, requireRole(['TEACHER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    // Get allowed org units for the teacher
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Get exams assigned to students of this teacher
    const exams: any = await prisma.$queryRaw`
      SELECT DISTINCT
        e."id",
        e."title",
        e."description",
        e."durationMins",
        e."maxScore",
        e."passingScore",
        COUNT(ea."id") AS "assignedCount",
        COUNT(CASE WHEN ea."status" = 'SUBMITTED' THEN 1 END) AS "submittedCount"
      FROM "Exam" e
      LEFT JOIN "ExamAttempt" ea ON ea."examId" = e."id"
      LEFT JOIN "AbacusEnrollment" en ON ea."enrollmentId" = en."id"
      LEFT JOIN "Student" s ON en."studentId" = s."id"
      LEFT JOIN "TeacherStudentAssignment" tsa ON tsa."studentId" = s."id"
      WHERE s."orgUnitId" = ANY($1)
        AND tsa."teacherUserId" = $2
      GROUP BY e."id"
      ORDER BY e."title"
    `;

    return ok(res, exams);
  } catch (error) {
    console.error('Error fetching teacher exams:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/teacher/submissions
// Role: TEACHER only
router.get('/submissions', authRequired, requireRole(['TEACHER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    const type = req.query.type as string || 'all'; // 'worksheet' | 'exam' | 'all'
    const status = req.query.status as string || 'all'; // 'pending' | 'graded' | 'all'

    // Get allowed org units for the teacher
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    let submissions: any[] = [];

    if (type === 'worksheet' || type === 'all') {
      // Get worksheet submissions
      const worksheetSubmissions: any = await prisma.$queryRaw`
        SELECT 
          'worksheet' AS "type",
          swa."id" AS "id",
          s."firstName" || ' ' || s."lastName" AS "studentName",
          s."code" AS "studentCode",
          w."title" AS "title",
          swa."status",
          swa."createdAt",
          swa."submittedAt",
          swa."totalScore",
          swa."maxScore",
          swa."teacherAdjustedScore",
          swa."teacherComment",
          swa."reviewedAt"
        FROM "StudentWorksheetAttempt" swa
        JOIN "Student" s ON swa."studentId" = s."id"
        JOIN "AbacusWorksheet" w ON swa."worksheetId" = w."id"
        JOIN "TeacherStudentAssignment" tsa ON tsa."studentId" = s."id"
        WHERE s."orgUnitId" = ANY($1)
          AND tsa."teacherUserId" = $2
          AND ($3 = 'all' OR swa."status" = ANY(
            CASE 
              WHEN $3 = 'pending' THEN ARRAY['SUBMITTED']::text[]
              WHEN $3 = 'graded' THEN ARRAY['GRADED']::text[]
              ELSE ARRAY[swa."status"]::text[]
            END
          ))
        ORDER BY swa."submittedAt" DESC NULLS LAST, swa."createdAt" DESC
      `;

      submissions = submissions.concat(worksheetSubmissions);
    }

    if (type === 'exam' || type === 'all') {
      // Get exam submissions
      const examSubmissions: any = await prisma.$queryRaw`
        SELECT 
          'exam' AS "type",
          ea."id" AS "id",
          s."firstName" || ' ' || s."lastName" AS "studentName",
          s."code" AS "studentCode",
          e."title" AS "title",
          ea."status",
          ea."createdAt",
          ea."submittedAt",
          ea."score" AS "totalScore",
          ea."maxScore",
          ea."teacherScore" AS "teacherAdjustedScore",
          ea."teacherFeedback" AS "teacherComment",
          ea."gradedAt" AS "reviewedAt"
        FROM "ExamAttempt" ea
        JOIN "Student" s ON ea."studentId" = s."id"
        JOIN "Exam" e ON ea."examId" = e."id"
        JOIN "TeacherStudentAssignment" tsa ON tsa."studentId" = s."id"
        WHERE s."orgUnitId" = ANY($1)
          AND tsa."teacherUserId" = $2
          AND ($3 = 'all' OR ea."status" = ANY(
            CASE 
              WHEN $3 = 'pending' THEN ARRAY['SUBMITTED']::text[]
              WHEN $3 = 'graded' THEN ARRAY['GRADED']::text[]
              ELSE ARRAY[ea."status"]::text[]
            END
          ))
        ORDER BY ea."submittedAt" DESC NULLS LAST, ea."createdAt" DESC
      `;

      submissions = submissions.concat(examSubmissions);
    }

    // Sort all submissions by submitted date descending
    submissions.sort((a, b) => {
      const dateA = new Date(b.submittedAt || b.createdAt).getTime();
      const dateB = new Date(a.submittedAt || a.createdAt).getTime();
      return dateB - dateA;
    });

    return ok(res, submissions);
  } catch (error) {
    console.error('Error fetching teacher submissions:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/teacher/submissions/:id/grade
// Role: TEACHER only
router.post('/submissions/:id/grade', authRequired, requireRole(['TEACHER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    const submissionId = parseInt(req.params.id, 10);
    if (isNaN(submissionId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid submission ID');
    }

    const { score, maxScore, remarks } = req.body;

    // Validate required fields
    if (score === undefined || score === null) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Score is required');
    }

    // Get allowed org units for the teacher
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(
      req.user.role,
      req.user.orgUnitId ?? null,
      req.user.id
    );

    if (allowedOrgUnits.length === 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with any organization unit');
    }

    // Check if submission exists and belongs to teacher's students
    // First, try to find it as a worksheet attempt
    let submissionType = 'worksheet';
    let updatedSubmission: any = null;

    const worksheetAttempt = await prisma.studentWorksheetAttempt.findFirst({
      where: {
        id: submissionId,
        student: {
          orgUnitId: { in: allowedOrgUnits },
          teacherAssignments: {
            some: {
              teacherUserId: req.user.id
            }
          }
        }
      }
    });

    if (worksheetAttempt) {
      // Update worksheet attempt
      updatedSubmission = await prisma.studentWorksheetAttempt.update({
        where: { id: submissionId },
        data: {
          totalScore: score,
          maxScore: maxScore,
          teacherComment: remarks || null,
          teacherAdjustedScore: score,
          reviewedAt: new Date(),
          status: 'GRADED',
          graderUserId: req.user.id
        }
      });
    } else {
      // Try to find it as an exam attempt
      const examAttempt = await prisma.examAttempt.findFirst({
        where: {
          id: submissionId,
          student: {
            orgUnitId: { in: allowedOrgUnits },
            teacherAssignments: {
              some: {
                teacherUserId: req.user.id
              }
            }
          }
        }
      });

      if (examAttempt) {
        submissionType = 'exam';
        updatedSubmission = await prisma.examAttempt.update({
          where: { id: submissionId },
          data: {
            score: score,
            maxScore: maxScore,
            feedback: remarks || null,
            gradedAt: new Date(),
            status: 'COMPLETED'
          }
        });
      } else {
        return fail(res, 404, 'NOT_FOUND', 'Submission not found or access denied');
      }
    }

    return ok(res, { 
      message: 'Submission graded successfully', 
      submission: updatedSubmission,
      type: submissionType
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;