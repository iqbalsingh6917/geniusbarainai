import prisma from '../prismaClient';
import { getAllowedOrgUnitsForUser } from './orgScopeEngine';
import {
  isSuperadmin,
  isCenterManager,
  isAdmissions,
  isTeacher,
  isStudent,
} from '../constants/roles';

export class DashboardAccessError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface StudentDashboardContext {
  studentId: number;
  role: string;
  userId: number;
  orgUnitId: number | null;
}

export async function buildStudentDashboardData(
  ctx: StudentDashboardContext
) {
  const studentResult: any = await prisma.$queryRaw`
    SELECT 
      s."id",
      s."code",
      s."firstName",
      s."lastName",
      s."status",
      s."orgUnitId",
      o."code" as "orgUnitCode",
      o."name" as "orgUnitName"
    FROM "Student" s
    LEFT JOIN "OrgUnit" o ON s."orgUnitId" = o."id"
    WHERE s."id" = ${ctx.studentId}
  `;

  if (!studentResult || studentResult.length === 0) {
    throw new DashboardAccessError(404, 'NOT_FOUND', 'Student not found');
  }

  const student = studentResult[0];

  const allowedOrgUnits =
    isSuperadmin(ctx.role) || isStudent(ctx.role)
      ? []
      : await getAllowedOrgUnitsForUser(ctx.role, ctx.orgUnitId || null);

  let hasAccess = false;

  if (isSuperadmin(ctx.role)) {
    hasAccess = true;
  } else if (isCenterManager(ctx.role) || isAdmissions(ctx.role)) {
    hasAccess =
      !!student.orgUnitId && allowedOrgUnits.includes(student.orgUnitId);
  } else if (isTeacher(ctx.role)) {
    const assignment: any = await prisma.$queryRaw`
      SELECT 1 
      FROM "TeacherStudentAssignment" 
      WHERE "teacherUserId" = ${ctx.userId} AND "studentId" = ${ctx.studentId}
      LIMIT 1
    `;
    hasAccess = assignment.length > 0;
  } else if (isStudent(ctx.role)) {
    hasAccess =
      student.id === ctx.studentId &&
      (ctx.orgUnitId ? student.orgUnitId === ctx.orgUnitId : true);
  }

  if (!hasAccess) {
    throw new DashboardAccessError(403, 'ACCESS_DENIED', 'Access denied for this student');
  }

  const enrollmentParams: any[] = [ctx.studentId];
  let enrollmentFilter = '';
  if (!isSuperadmin(ctx.role)) {
    if (isTeacher(ctx.role) && ctx.orgUnitId) {
      enrollmentFilter = ` AND e."orgUnitId" = $2`;
      enrollmentParams.push(ctx.orgUnitId);
    } else if (allowedOrgUnits.length > 0) {
      enrollmentFilter = ` AND e."orgUnitId" = ANY($2)`;
      enrollmentParams.push(allowedOrgUnits);
    }
  }

  const enrollmentQuery = `
    SELECT 
      e."id",
      e."status",
      e."courseId",
      c."code" as "courseCode",
      c."name" as "courseName",
      e."currentModuleId",
      m."title" as "currentModuleTitle",
      e."currentLevelId",
      l."name" as "currentLevelName",
      e."orgUnitId"
    FROM "AbacusEnrollment" e
    JOIN "AbacusCourse" c ON e."courseId" = c."id"
    LEFT JOIN "AbacusModule" m ON e."currentModuleId" = m."id"
    LEFT JOIN "AbacusLevel" l ON e."currentLevelId" = l."id"
    WHERE e."studentId" = $1${enrollmentFilter}
    ORDER BY CASE WHEN e."status" = 'ONGOING' THEN 0 ELSE 1 END, e."startDate" DESC
    LIMIT 1
  `;
  const activeEnrollmentResult: any = await prisma.$queryRawUnsafe(
    enrollmentQuery,
    ...enrollmentParams
  );
  const activeEnrollment = activeEnrollmentResult[0] || null;

  let progress = { totalLevels: 0, completedLevels: 0 };
  if (activeEnrollment) {
    const totalLevelsResult: any = await prisma.$queryRaw`
      SELECT COUNT(*) as "count"
      FROM "AbacusLevel" l
      JOIN "AbacusModule" m ON l."moduleId" = m."id"
      WHERE m."courseId" = ${activeEnrollment.courseId}
    `;

    const completedLevelsResult: any = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT a."levelId") as "count"
      FROM "AbacusAssessment" a
      WHERE a."enrollmentId" = ${activeEnrollment.id} AND a."passed" = true
    `;

    progress = {
      totalLevels: parseInt(totalLevelsResult[0]?.count?.toString() || '0'),
      completedLevels: parseInt(
        completedLevelsResult[0]?.count?.toString() || '0'
      ),
    };
  }

  const assessmentParams: any[] = [ctx.studentId];
  let assessmentFilter = '';
  if (!isSuperadmin(ctx.role)) {
    if (isTeacher(ctx.role) && ctx.orgUnitId) {
      assessmentFilter = ` AND e."orgUnitId" = $2`;
      assessmentParams.push(ctx.orgUnitId);
    } else if (allowedOrgUnits.length > 0) {
      assessmentFilter = ` AND e."orgUnitId" = ANY($2)`;
      assessmentParams.push(allowedOrgUnits);
    }
  }

  const assessmentsQuery = `
    SELECT 
      a."id",
      a."attemptDate" as "date",
      a."scorePercent",
      a."passed",
      a."remarks",
      c."code" as "courseCode",
      c."name" as "courseName",
      m."title" as "moduleName",
      l."name" as "levelName"
    FROM "AbacusAssessment" a
    JOIN "AbacusEnrollment" e ON a."enrollmentId" = e."id"
    JOIN "AbacusLevel" l ON a."levelId" = l."id"
    JOIN "AbacusModule" m ON l."moduleId" = m."id"
    JOIN "AbacusCourse" c ON m."courseId" = c."id"
    WHERE e."studentId" = $1${assessmentFilter}
    ORDER BY a."attemptDate" DESC
    LIMIT 5
  `;
  const recentAssessments: any[] = await prisma.$queryRawUnsafe(
    assessmentsQuery,
    ...assessmentParams
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const attendanceParams: any[] = [ctx.studentId, monthStart, monthEnd];
  let attendanceFilter = '';
  if (!isSuperadmin(ctx.role)) {
    if (isTeacher(ctx.role) && ctx.orgUnitId) {
      attendanceFilter = ` AND "orgUnitId" = $4`;
      attendanceParams.push(ctx.orgUnitId);
    } else if (allowedOrgUnits.length > 0) {
      attendanceFilter = ` AND "orgUnitId" = ANY($4)`;
      attendanceParams.push(allowedOrgUnits);
    }
  }

  const attendanceQuery = `
    SELECT 
      COUNT(*) as "totalClasses",
      COUNT(CASE WHEN "status" = 'PRESENT' THEN 1 END) as "present",
      COUNT(CASE WHEN "status" = 'ABSENT' THEN 1 END) as "absent",
      COUNT(CASE WHEN "status" = 'LATE' THEN 1 END) as "late",
      COUNT(CASE WHEN "status" = 'EXCUSED' THEN 1 END) as "excused"
    FROM "StudentAttendance"
    WHERE "studentId" = $1
      AND "classDate" >= $2
      AND "classDate" < $3${attendanceFilter}
  `;
  const attendanceResult: any = await prisma.$queryRawUnsafe(
    attendanceQuery,
    ...attendanceParams
  );
  const attendanceRow = attendanceResult[0] || {};
  const totalClasses = parseInt(attendanceRow.totalClasses?.toString() || '0');
  const present = parseInt(attendanceRow.present?.toString() || '0');
  const absent = parseInt(attendanceRow.absent?.toString() || '0');
  const late = parseInt(attendanceRow.late?.toString() || '0');
  const excused = parseInt(attendanceRow.excused?.toString() || '0');
  const attendancePercent =
    totalClasses > 0
      ? Math.round((present / totalClasses) * 10000) / 100
      : 0;

  return {
    student: {
      id: student.id,
      code: student.code,
      fullName: `${student.firstName} ${student.lastName || ''}`.trim(),
      status: student.status,
      orgUnit: {
        code: student.orgUnitCode,
        name: student.orgUnitName,
      },
      activeEnrollment: activeEnrollment
        ? {
            id: activeEnrollment.id,
            courseCode: activeEnrollment.courseCode,
            courseName: activeEnrollment.courseName,
            status: activeEnrollment.status,
          }
        : null,
    },
    progress,
    recentAssessments: recentAssessments.map((assessment: any) => ({
      id: assessment.id,
      date: assessment.date,
      courseCode: assessment.courseCode,
      courseName: assessment.courseName,
      moduleName: assessment.moduleName,
      levelName: assessment.levelName,
      scorePercent: assessment.scorePercent,
      status: assessment.passed ? 'PASS' : 'FAIL',
      remarks: assessment.remarks,
    })),
    attendanceSummary: {
      month: `${monthStart.getFullYear()}-${`${monthStart.getMonth() + 1}`.padStart(2, '0')}`,
      totalClasses,
      present,
      absent,
      late,
      excused,
      attendancePercent,
    },
  };
}

