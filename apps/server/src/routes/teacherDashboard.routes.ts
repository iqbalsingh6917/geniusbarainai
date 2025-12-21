import { Router } from 'express';
import { prisma } from '@lms/db';
import { Prisma } from '@prisma/client';
import { ModuleAttemptStatus, WorksheetAttemptStatus, ExamAttemptStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get(
  '/dashboard/teacher/overview',
  requireAuth,
  requireRole(['TEACHER']),
  async (req, res, next) => {
    try {
      const teacherId = req.user?.id;
      if (!teacherId) {
        return res.status(401).json({ error: 'AUTH_REQUIRED' });
      }

      const assignments = await prisma.teacherStudentAssignment.findMany({
        where: { teacherUserId: teacherId },
        select: { studentId: true, enrollmentId: true },
      });
      const studentIds = Array.from(new Set(assignments.map((a) => a.studentId).filter(Boolean)));
      const enrollmentIds = Array.from(
        new Set(assignments.map((a) => a.enrollmentId).filter((v): v is number => !!v))
      );

      const enrollmentFilters: Prisma.AbacusEnrollmentWhereInput[] = [];
      if (enrollmentIds.length > 0) {
        enrollmentFilters.push({ id: { in: enrollmentIds } });
      }
      if (studentIds.length > 0) {
        enrollmentFilters.push({ studentId: { in: studentIds } });
      }
      const enrollmentWhere: Prisma.AbacusEnrollmentWhereInput =
        enrollmentFilters.length > 0 ? { OR: enrollmentFilters } : { id: { in: [-1] } };

      const enrollments = await prisma.abacusEnrollment.findMany({
        where: enrollmentWhere,
        include: {
          student: { select: { firstName: true, lastName: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      });

      const scopedEnrollmentIds = enrollments.map((e) => e.id);
      if (!scopedEnrollmentIds.length) {
        return res.json({
          kpis: {
            studentsAssigned: studentIds.length,
            worksheetsAssigned: 0,
            worksheetsPendingReview: 0,
            averageAccuracy: 0,
          },
          students: [],
        });
      }

      const courseIds = enrollments.map((e) => e.courseId);

      const [moduleTotals, moduleCompleted, worksheetCompleted, examCompleted] = await Promise.all([
        prisma.abacusModule.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIds } },
          _count: { courseId: true },
        }),
        prisma.moduleAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: scopedEnrollmentIds },
            status: ModuleAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
        prisma.worksheetAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: scopedEnrollmentIds },
            status: WorksheetAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
        prisma.examAttempt.groupBy({
          by: ['enrollmentId'],
          where: {
            enrollmentId: { in: scopedEnrollmentIds },
            status: ExamAttemptStatus.COMPLETED,
          },
          _count: { enrollmentId: true },
        }),
      ]);

      const moduleTotalsMap = new Map<number, number>(
        moduleTotals.map((m) => [m.courseId, m._count.courseId || 0])
      );
      const moduleCompletedMap = new Map<number, number>(
        moduleCompleted.map((m) => [m.enrollmentId, m._count.enrollmentId || 0])
      );
      const worksheetCompletedMap = new Map<number, number>(
        worksheetCompleted.map((w) => [w.enrollmentId, w._count.enrollmentId || 0])
      );
      const examCompletedMap = new Map<number, number>(
        examCompleted.map((e) => [e.enrollmentId, e._count.enrollmentId || 0])
      );

      const students = enrollments.map((enrollment) => {
        const completedModules = moduleCompletedMap.get(enrollment.id) || 0;
        const totalModules = moduleTotalsMap.get(enrollment.courseId) || 0;
        const progressPercent =
          totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

        return {
          enrollmentId: enrollment.id,
          studentName: [enrollment.student.firstName, enrollment.student.lastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          courseTitle: enrollment.course.name,
          courseCode: enrollment.course.code,
          progressPercent,
          completedModules,
          completedWorksheets: worksheetCompletedMap.get(enrollment.id) || 0,
          completedExams: examCompletedMap.get(enrollment.id) || 0,
        };
      });

      let worksheetsAssigned = 0;
      let worksheetsPendingReview = 0;
      if (studentIds.length > 0) {
        const assignedRows: any = await prisma.$queryRaw`
          SELECT COUNT(*)::int as "count"
          FROM "StudentWorksheetAssignment" swa
          JOIN "TeacherStudentAssignment" tsa
            ON tsa."studentId" = swa."studentId"
           AND tsa."teacherUserId" = ${teacherId}
        `;
        worksheetsAssigned = assignedRows?.[0]?.count ?? 0;

        const pendingRows: any = await prisma.$queryRaw`
          SELECT COUNT(*)::int as "count"
          FROM "StudentWorksheetAttempt" swa
          JOIN "TeacherStudentAssignment" tsa
            ON tsa."studentId" = swa."studentId"
           AND tsa."teacherUserId" = ${teacherId}
          WHERE swa."status" = 'SUBMITTED' AND swa."reviewedAt" IS NULL
        `;
        worksheetsPendingReview = pendingRows?.[0]?.count ?? 0;
      }

      let averageAccuracy = 0;
      if (studentIds.length > 0) {
        const accuracyRows: any = await prisma.$queryRaw`
          SELECT
            AVG(
              CASE
                WHEN swa."maxScore" > 0
                THEN (COALESCE(swa."teacherAdjustedScore", swa."totalScore")::float / swa."maxScore") * 100
                ELSE NULL
              END
            ) as "avgAccuracy"
          FROM "StudentWorksheetAttempt" swa
          JOIN "TeacherStudentAssignment" tsa
            ON tsa."studentId" = swa."studentId"
           AND tsa."teacherUserId" = ${teacherId}
          WHERE swa."status" = ANY(ARRAY['SUBMITTED','GRADED','COMPLETED'])
            AND swa."maxScore" IS NOT NULL
        `;
        averageAccuracy = accuracyRows?.[0]?.avgAccuracy
          ? Math.round(Number(accuracyRows[0].avgAccuracy) * 100) / 100
          : 0;
      }

      res.json({
        kpis: {
          studentsAssigned: studentIds.length,
          worksheetsAssigned,
          worksheetsPendingReview,
          averageAccuracy,
        },
        students,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
