import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { isBusinessPartner, isFranchise, isCenterManager, isAdmissions, isTeacher } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import { 
  superadminDashboardSchema, 
  businessPartnerDashboardSchema, 
  franchiseDashboardSchema, 
  centerDashboardSchema, 
  teacherDashboardSchema 
} from '../schemas/dashboardSchema';

const router = Router();
const prisma = new PrismaClient();

// Helper function to get org unit details
const getOrgUnitDetails = async (orgUnitId: number) => {
  const orgUnit: any = await prisma.$queryRaw`
    SELECT "id", "code", "name", "type" 
    FROM "OrgUnit" 
    WHERE "id" = ${orgUnitId}
  `;
  return orgUnit[0] || null;
};

// GET /api/dashboard/superadmin
// Role: SUPERADMIN only
router.get('/superadmin', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    superadminDashboardSchema.parse(req.query);

    // Get global totals
    const totalsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "Student") as totalStudents,
        (SELECT COUNT(*) FROM "AbacusEnrollment" WHERE "status" = 'ONGOING') as activeEnrollments,
        (SELECT COUNT(*) FROM "OrgUnit" WHERE "type" = 'CENTER') as totalCenters,
        (SELECT COUNT(*) FROM "OrgUnit" WHERE "type" = 'BUSINESS_PARTNER') as totalBusinessPartners,
        (SELECT COUNT(*) FROM "OrgUnit" WHERE "type" = 'FRANCHISE') as totalFranchises
    `;
    
    const totalsResult: any = await prisma.$queryRawUnsafe(totalsQuery);
    const totals = totalsResult[0];
    
    // Get Abacus curriculum stats
    const abacusQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "AbacusCourse") as totalCourses,
        (SELECT COUNT(*) FROM "AbacusModule") as totalModules,
        (SELECT COUNT(*) FROM "AbacusLevel") as totalLevels
    `;
    
    const abacusResult: any = await prisma.$queryRawUnsafe(abacusQuery);
    const abacus = abacusResult[0];
    
    // Get activity stats (last 30 days)
    const activityQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "AbacusEnrollment" WHERE "createdAt" >= NOW() - INTERVAL '30 days') as enrollmentsLast30Days,
        (SELECT COUNT(*) FROM "AbacusAssessment" WHERE "attemptDate" >= NOW() - INTERVAL '30 days') as assessmentsLast30Days
    `;
    
    const activityResult: any = await prisma.$queryRawUnsafe(activityQuery);
    const activity = activityResult[0];
    
    // Get per-course summary
    const perCourseQuery = `
      SELECT 
        c."code" as "courseCode",
        c."name" as "courseName",
        COUNT(DISTINCT s."id") as "studentsCount",
        COUNT(e."id") as "activeEnrollmentsCount",
        CASE 
          WHEN COUNT(e."id") > 0 THEN 
            ROUND((COUNT(CASE WHEN e."status" = 'COMPLETED' THEN 1 END) * 100.0 / COUNT(e."id")), 2)
          ELSE 0 
        END as "completionRatePercent"
      FROM "AbacusCourse" c
      LEFT JOIN "AbacusEnrollment" e ON c."id" = e."courseId"
      LEFT JOIN "Student" s ON e."studentId" = s."id"
      GROUP BY c."id", c."code", c."name"
      ORDER BY c."code"
    `;
    
    // Get finance summary
    const financeQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN sfr."status" = 'PENDING' THEN sfr."amount" ELSE 0 END), 0) as "totalDues",
        COALESCE(SUM(CASE WHEN pt."type" = 'CREDIT' THEN pt."amount" ELSE 0 END), 0) as "totalCollected"
      FROM "StudentFeeRecord" sfr
      FULL OUTER JOIN "PaymentTransaction" pt ON TRUE
    `;
    
    const perCourse: any = await prisma.$queryRawUnsafe(perCourseQuery);
    
    // Get finance summary
    const financeResult: any = await prisma.$queryRawUnsafe(financeQuery);
    const finance = financeResult[0];
    
    // Convert BigInt to Number for all count fields
    const formattedPerCourse = perCourse.map((course: any) => ({
      ...course,
      studentsCount: course.studentsCount ? parseInt(course.studentsCount.toString()) : 0,
      activeEnrollmentsCount: course.activeEnrollmentsCount ? parseInt(course.activeEnrollmentsCount.toString()) : 0,
      completionRatePercent: course.completionRatePercent ? parseFloat(course.completionRatePercent.toString()) : 0
    }));
    
    // Log audit
    await logAudit(req, {
      action: 'DASHBOARD_SUPERADMIN_VIEWED',
      entityType: 'Dashboard',
      meta: { dashboardType: 'superadmin' }
    });

    ok(res, {
      totals: {
        totalStudents: totals.totalstudents ? parseInt(totals.totalstudents.toString()) : 0,
        activeEnrollments: totals.activeenrollments ? parseInt(totals.activeenrollments.toString()) : 0,
        totalCenters: totals.totalcenters ? parseInt(totals.totalcenters.toString()) : 0,
        totalBusinessPartners: totals.totalbusinesspartners ? parseInt(totals.totalbusinesspartners.toString()) : 0,
        totalFranchises: totals.totalfranchises ? parseInt(totals.totalfranchises.toString()) : 0
      },
      abacus: {
        totalCourses: abacus.totalcourses ? parseInt(abacus.totalcourses.toString()) : 0,
        totalModules: abacus.totalmodules ? parseInt(abacus.totalmodules.toString()) : 0,
        totalLevels: abacus.totallevels ? parseInt(abacus.totallevels.toString()) : 0
      },
      activity: {
        enrollmentsLast30Days: activity.enrollmentslast30days ? parseInt(activity.enrollmentslast30days.toString()) : 0,
        assessmentsLast30Days: activity.assessmentslast30days ? parseInt(activity.assessmentslast30days.toString()) : 0
      },
      finance: {
        totalDues: finance.totaldues ? parseInt(finance.totaldues.toString()) : 0,
        totalCollected: finance.totalcollected ? parseInt(finance.totalcollected.toString()) : 0
      },
      perCourse: formattedPerCourse
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching superadmin dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/dashboard/business-partner
// Role: BUSINESS_PARTNER only
router.get('/business-partner', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    businessPartnerDashboardSchema.parse(req.query);

    // Check if user is BUSINESS_PARTNER
    if (!req.user || !isBusinessPartner(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Business Partner role required.');
    }
    
    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }
    
    // Get allowed org units for the BP
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
    
    // Get BP org unit details
    const bpOrgUnit = await getOrgUnitDetails(req.user.orgUnitId);
    
    if (!bpOrgUnit) {
      return fail(res, 404, 'NOT_FOUND', 'Business Partner organization unit not found');
    }
    
    // Get franchises and centers count under BP
    const orgQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "OrgUnit" WHERE "type" = 'FRANCHISE' AND "parentId" = $1) as franchisesCount,
        (SELECT COUNT(*) FROM "OrgUnit" WHERE "type" = 'CENTER' AND "parentId" IN (
          SELECT "id" FROM "OrgUnit" WHERE "type" = 'FRANCHISE' AND "parentId" = $1
        )) as centersCount
    `;
    
    const orgResult: any = await prisma.$queryRawUnsafe(orgQuery, req.user.orgUnitId);
    const org = orgResult[0];
    
    // Get totals for students and active enrollments in BP hierarchy
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT s."id") as studentsCount,
        COUNT(e."id") as activeEnrollmentsCount
      FROM "Student" s
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" = 'ONGOING'
      WHERE s."orgUnitId" = ANY($1)
    `;
    
    const totalsResult: any = await prisma.$queryRawUnsafe(totalsQuery, allowedOrgUnits);
    const totals = totalsResult[0];
    
    // Get per-center data
    const perCenterQuery = `
      SELECT 
        o."code" as "centerCode",
        o."name" as "centerName",
        COUNT(DISTINCT s."id") as "studentsCount",
        COUNT(e."id") as "activeEnrollmentsCount"
      FROM "OrgUnit" o
      LEFT JOIN "Student" s ON o."id" = s."orgUnitId"
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" = 'ONGOING'
      WHERE o."type" = 'CENTER' AND o."id" = ANY($1)
      GROUP BY o."id", o."code", o."name"
      ORDER BY o."code"
    `;
    
    const perCenter: any = await prisma.$queryRawUnsafe(perCenterQuery, allowedOrgUnits);
    
    // Convert BigInt to Number for all count fields
    const formattedPerCenter = perCenter.map((center: any) => ({
      ...center,
      studentsCount: center.studentscount ? parseInt(center.studentscount.toString()) : 0,
      activeEnrollmentsCount: center.activeenrollmentscount ? parseInt(center.activeenrollmentscount.toString()) : 0
    }));
    
    // Log audit
    await logAudit(req, {
      action: 'DASHBOARD_BUSINESS_PARTNER_VIEWED',
      entityType: 'Dashboard',
      meta: { 
        dashboardType: 'business-partner',
        orgUnitId: req.user?.orgUnitId
      }
    });

    ok(res, {
      org: {
        businessPartnerCode: bpOrgUnit.code,
        franchisesCount: org.franchisescount ? parseInt(org.franchisescount.toString()) : 0,
        centersCount: org.centerscount ? parseInt(org.centerscount.toString()) : 0
      },
      totals: {
        studentsCount: totals.studentscount ? parseInt(totals.studentscount.toString()) : 0,
        activeEnrollmentsCount: totals.activeenrollmentscount ? parseInt(totals.activeenrollmentscount.toString()) : 0
      },
      perCenter: formattedPerCenter
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching business partner dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/dashboard/franchise
// Role: FRANCHISE only
router.get('/franchise', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    franchiseDashboardSchema.parse(req.query);

    // Check if user is FRANCHISE
    if (!req.user || !isFranchise(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Franchise role required.');
    }
    
    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }
    
    // Get franchise org unit details
    const franchiseOrgUnit = await getOrgUnitDetails(req.user.orgUnitId);
    
    if (!franchiseOrgUnit) {
      return fail(res, 404, 'NOT_FOUND', 'Franchise organization unit not found');
    }
    
    // Get centers count under franchise
    const orgQuery = `
      SELECT COUNT(*) as centersCount
      FROM "OrgUnit" 
      WHERE "type" = 'CENTER' AND "parentId" = $1
    `;
    
    const orgResult: any = await prisma.$queryRawUnsafe(orgQuery, req.user.orgUnitId);
    const org = orgResult[0];
    
    // Get allowed org units (franchise + its centers)
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, req.user.orgUnitId);
    
    // Get totals for students and active enrollments in franchise hierarchy
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT s."id") as studentsCount,
        COUNT(e."id") as activeEnrollmentsCount
      FROM "Student" s
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" = 'ONGOING'
      WHERE s."orgUnitId" = ANY($1)
    `;
    
    const totalsResult: any = await prisma.$queryRawUnsafe(totalsQuery, allowedOrgUnits);
    const totals = totalsResult[0];
    
    // Get per-center data
    const perCenterQuery = `
      SELECT 
        o."code" as "centerCode",
        o."name" as "centerName",
        COUNT(DISTINCT s."id") as "studentsCount",
        COUNT(e."id") as "activeEnrollmentsCount"
      FROM "OrgUnit" o
      LEFT JOIN "Student" s ON o."id" = s."orgUnitId"
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId" AND e."status" = 'ONGOING'
      WHERE o."type" = 'CENTER' AND o."parentId" = $1
      GROUP BY o."id", o."code", o."name"
      ORDER BY o."code"
    `;
    
    const perCenter: any = await prisma.$queryRawUnsafe(perCenterQuery, req.user.orgUnitId);
    
    // Convert BigInt to Number for all count fields
    const formattedPerCenter = perCenter.map((center: any) => ({
      ...center,
      studentsCount: center.studentscount ? parseInt(center.studentscount.toString()) : 0,
      activeEnrollmentsCount: center.activeenrollmentscount ? parseInt(center.activeenrollmentscount.toString()) : 0
    }));
    
    // Log audit
    await logAudit(req, {
      action: 'DASHBOARD_FRANCHISE_VIEWED',
      entityType: 'Dashboard',
      meta: { 
        dashboardType: 'franchise',
        orgUnitId: req.user?.orgUnitId
      }
    });

    ok(res, {
      org: {
        franchiseCode: franchiseOrgUnit.code,
        centersCount: org.centerscount ? parseInt(org.centerscount.toString()) : 0
      },
      totals: {
        studentsCount: totals.studentscount ? parseInt(totals.studentscount.toString()) : 0,
        activeEnrollmentsCount: totals.activeenrollmentscount ? parseInt(totals.activeenrollmentscount.toString()) : 0
      },
      perCenter: formattedPerCenter
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching franchise dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/dashboard/center
// Role: CENTER_MANAGER or ADMISSIONS
router.get('/center', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    centerDashboardSchema.parse(req.query);

    // Check if user is CENTER_MANAGER or ADMISSIONS
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }
    
    if (!req.user?.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }
    
    // Get center org unit details
    const centerOrgUnit = await getOrgUnitDetails(req.user.orgUnitId);
    
    if (!centerOrgUnit) {
      return fail(res, 404, 'NOT_FOUND', 'Center organization unit not found');
    }
    
    // Get totals for students and enrollments in center
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT s."id") as studentsCount,
        COUNT(CASE WHEN e."status" = 'ONGOING' THEN 1 END) as activeEnrollmentsCount,
        COUNT(CASE WHEN e."status" = 'COMPLETED' THEN 1 END) as completedEnrollmentsCount
      FROM "Student" s
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId"
      WHERE s."orgUnitId" = $1
    `;
    
    const totalsResult: any = await prisma.$queryRawUnsafe(totalsQuery, req.user.orgUnitId);
    const totals = totalsResult[0];
    
    // Get primary course info (assuming first Abacus course is primary)
    const abacusQuery = `
      SELECT 
        c."code" as "primaryCourseCode",
        c."name" as "primaryCourseName",
        COUNT(e."id") as "activeStudentsInPrimaryCourse"
      FROM "AbacusCourse" c
      LEFT JOIN "AbacusEnrollment" e ON c."id" = e."courseId" AND e."status" = 'ONGOING'
      LEFT JOIN "Student" s ON e."studentId" = s."id"
      WHERE s."orgUnitId" = $1
      GROUP BY c."id", c."code", c."name"
      ORDER BY c."id"
      LIMIT 1
    `;
    
    const abacusResult: any = await prisma.$queryRawUnsafe(abacusQuery, req.user.orgUnitId);
    const abacus = abacusResult[0] || {
      primaryCourseCode: null,
      primaryCourseName: null,
      activeStudentsInPrimaryCourse: 0
    };
    
    // Get recent activity (last 7 days)
    const activityQuery = `
      SELECT 
        COUNT(CASE WHEN s."createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as newStudentsLast7Days,
        COUNT(CASE WHEN e."createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as newEnrollmentsLast7Days,
        COUNT(CASE WHEN a."attemptDate" >= NOW() - INTERVAL '7 days' THEN 1 END) as assessmentsLast7Days
      FROM "Student" s
      LEFT JOIN "AbacusEnrollment" e ON s."id" = e."studentId"
      LEFT JOIN "AbacusAssessment" a ON e."id" = a."enrollmentId"
      WHERE s."orgUnitId" = $1
    `;
    
    // Get finance summary for center
    const financeQuery = `
      SELECT 
        COUNT(sfr."id") as "totalStudents",
        COALESCE(SUM(CASE WHEN sfr."status" = 'PENDING' THEN sfr."amount" ELSE 0 END), 0) as "outstandingAmount"
      FROM "StudentFeeRecord" sfr
      WHERE sfr."orgUnitId" = $1
    `;
    
    const activityResult: any = await prisma.$queryRawUnsafe(activityQuery, req.user.orgUnitId);
    const recentActivity = activityResult[0];
    
    // Get finance summary for center
    const financeResult: any = await prisma.$queryRawUnsafe(financeQuery, req.user.orgUnitId);
    const finance = financeResult[0];
    
    // Log audit
    await logAudit(req, {
      action: 'DASHBOARD_CENTER_VIEWED',
      entityType: 'Dashboard',
      meta: { 
        dashboardType: 'center',
        orgUnitId: req.user?.orgUnitId,
        userRole: req.user?.role
      }
    });

    ok(res, {
      org: {
        centerCode: centerOrgUnit.code,
        centerName: centerOrgUnit.name
      },
      totals: {
        studentsCount: totals.studentscount ? parseInt(totals.studentscount.toString()) : 0,
        activeEnrollmentsCount: totals.activeenrollmentscount ? parseInt(totals.activeenrollmentscount.toString()) : 0,
        completedEnrollmentsCount: totals.completedenrollmentscount ? parseInt(totals.completedenrollmentscount.toString()) : 0
      },
      abacus: {
        primaryCourseCode: abacus.primarycoursecode,
        primaryCourseName: abacus.primarycoursename,
        activeStudentsInPrimaryCourse: abacus.activestudentsinprimarycourse ? parseInt(abacus.activestudentsinprimarycourse.toString()) : 0
      },
      recentActivity: {
        newStudentsLast7Days: recentActivity.newstudentslast7days ? parseInt(recentActivity.newstudentslast7days.toString()) : 0,
        newEnrollmentsLast7Days: recentActivity.newenrollmentslast7days ? parseInt(recentActivity.newenrollmentslast7days.toString()) : 0,
        assessmentsLast7Days: recentActivity.assessmentslast7days ? parseInt(recentActivity.assessmentslast7days.toString()) : 0
      },
      finance: {
        totalStudents: finance.totalstudents ? parseInt(finance.totalstudents.toString()) : 0,
        outstandingAmount: finance.outstandingamount ? parseInt(finance.outstandingamount.toString()) : 0
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching center dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/dashboard/teacher
// Role: TEACHER only
router.get('/teacher', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    // Validate query parameters
    teacherDashboardSchema.parse(req.query);

    // Check if user is TEACHER
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    // Get totals for teacher's students and enrollments based on assignments
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT tsa."studentId") as myStudentsCount,
        COUNT(ae."id") as myActiveEnrollmentsCount
      FROM "TeacherStudentAssignment" tsa
      LEFT JOIN "AbacusEnrollment" ae ON tsa."enrollmentId" = ae."id" OR (tsa."enrollmentId" IS NULL AND ae."studentId" = tsa."studentId")
      WHERE tsa."teacherUserId" = $1 AND (ae."status" = 'ONGOING' OR ae."status" IS NULL)
    `;

    const totalsResult: any = await prisma.$queryRawUnsafe(totalsQuery, req.user.id);
    const totals = totalsResult[0];

    // Get progress stats based on assignments
    const progressQuery = `
      SELECT 
        COALESCE(ROUND(AVG(aa."scorePercent"), 2), 0) as averageScorePercent,
        COUNT(CASE WHEN aa."passed" = true THEN 1 END) as passedAssessmentsCount,
        COUNT(CASE WHEN aa."passed" = false THEN 1 END) as failedAssessmentsCount
      FROM "TeacherStudentAssignment" tsa
      JOIN "AbacusEnrollment" ae ON tsa."enrollmentId" = ae."id" OR (tsa."enrollmentId" IS NULL AND ae."studentId" = tsa."studentId")
      JOIN "AbacusAssessment" aa ON ae."id" = aa."enrollmentId"
      WHERE tsa."teacherUserId" = $1
    `;

    const progressResult: any = await prisma.$queryRawUnsafe(progressQuery, req.user.id);
    const progress = progressResult[0];

    // Get recent assessments (last 10) based on assignments
    const recentAssessmentsQuery = `
      SELECT 
        s."firstName" || ' ' || COALESCE(s."lastName", '') as "studentName",
        al."name" as "levelName",
        aa."scorePercent",
        aa."passed",
        aa."attemptDate"
      FROM "TeacherStudentAssignment" tsa
      JOIN "Student" s ON tsa."studentId" = s."id"
      JOIN "AbacusEnrollment" ae ON tsa."enrollmentId" = ae."id" OR (tsa."enrollmentId" IS NULL AND ae."studentId" = tsa."studentId")
      JOIN "AbacusAssessment" aa ON ae."id" = aa."enrollmentId"
      JOIN "AbacusLevel" al ON aa."levelId" = al."id"
      WHERE tsa."teacherUserId" = $1
      ORDER BY aa."attemptDate" DESC
      LIMIT 10
    `;

    const recentAssessments: any = await prisma.$queryRawUnsafe(recentAssessmentsQuery, req.user.id);

    // Log audit
    await logAudit(req, {
      action: 'DASHBOARD_TEACHER_VIEWED',
      entityType: 'Dashboard',
      meta: { 
        dashboardType: 'teacher',
        userId: req.user?.id
      }
    });

    ok(res, {
      totals: {
        myStudentsCount: totals.mystudentscount ? parseInt(totals.mystudentscount.toString()) : 0,
        myActiveEnrollmentsCount: totals.myactiveenrollmentscount ? parseInt(totals.myactiveenrollmentscount.toString()) : 0
      },
      progress: {
        averageScorePercent: progress.averagescorepercent ? parseFloat(progress.averagescorepercent.toString()) : 0,
        passedAssessmentsCount: progress.passedassessmentscount ? parseInt(progress.passedassessmentscount.toString()) : 0,
        failedAssessmentsCount: progress.failedassessmentscount ? parseInt(progress.failedassessmentscount.toString()) : 0
      },
      recentAssessments
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error fetching teacher dashboard:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;