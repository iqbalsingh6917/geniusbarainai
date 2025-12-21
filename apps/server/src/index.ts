import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config';
import prisma from './prismaClient';
import logger from './utils/logger';
import { authRequired, superadminOnly } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware, requestTimingMiddleware } from './middleware/requestLogging';

// Import routes
import authRoutes from './routes/auth';
import abacusCoursesRoutes from './routes/abacusCourses';
import abacusLevelsRoutes from './routes/superadminAbacusLevels';
import abacusWorksheetsRoutes from './routes/abacusWorksheets';
import abacusStudentsRoutes from './routes/abacusStudents';
import abacusEnrollmentsRoutes from './routes/abacusEnrollments';
import teacherAbacusRoutes from './routes/teacherAbacus';
import dashboardRoutes from './routes/dashboard';
import financeRoutes from './routes/finance';
import orgManagementRoutes from './routes/orgManagement';
import teacherAssignmentsRoutes from './routes/teacherAssignments';
import abacusScheduleRoutes from './routes/abacusSchedule';
import attendanceRoutes from './routes/attendance';
import superadminOrgRoutes from './routes/superadminOrg';
import superadminUsersRoutes from './routes/superadminUsers';
import reportsRoutes from './routes/reports';
import studentDashboardRoutes from './routes/studentDashboard';
import studentSelfRoutes from './routes/studentSelf';
import worksheetAssignmentsRoutes from './routes/worksheetAssignments';
import worksheetQuestionsRoutes from './routes/worksheetQuestions';
import teacherWorksheetAttemptsRoutes from './routes/teacherWorksheetAttempts';
import teacherWorksheetReviewRoutes from './routes/teacherWorksheetReview';
import licensingRoutes from './routes/licensing';
import licensingSeatRoutes from './routes/licensing.routes';
import auditRoutes from './routes/audit';
import superadminDashboardRoutes from './routes/superadminDashboard.routes';
import superadminOverviewRoutes from './routes/superadminOverview.routes';
import activityRoutes from './routes/activity';
import licenseOrdersRoutes from './routes/licenseOrders';
import licensingAllocationsRoutes from './routes/licensingAllocations';
import commercialHistoryRoutes from './routes/commercialHistory';
import superadminSalesRoutes from './routes/superadminSales';
import certificateRoutes from './routes/certificates.routes';
import analyticsRoutes from './routes/analytics.routes';
import leadAnalyticsRoutes from './routes/leadAnalytics';
import licensingSummaryRoutes from './routes/licensingSummary.routes';
import moduleAttemptsRoutes from './routes/moduleAttempts.routes';
import worksheetAttemptsRoutes from './routes/worksheetAttempts.routes';
import examAttemptsRoutes from './routes/examAttempts.routes';
import teacherDashboardRoutes from './routes/teacherDashboard.routes';
import centerDashboardRoutes from './routes/centerDashboard.routes';
import examQuestionsRoutes from './routes/examQuestions.routes';
import examDeliveryRoutes from './routes/examDelivery.routes';
import teacherExamReviewRoutes from './routes/teacherExamReview.routes';
import assessmentAnalyticsRoutes from './routes/assessmentAnalytics.routes';
import abacusExamsRoutes from './routes/abacusExams';
import orgDashboardRoutes from './routes/orgDashboard.routes';
import salesLeadsRoutes from './routes/salesLeads.routes';
import healthRoutes from './routes/health.routes';

export function createApp() {
  const app = express();
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const slowQueryThresholdMs = Number(process.env.SLOW_QUERY_THRESHOLD_MS || 200);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(rateLimiter);
  app.use(requestIdMiddleware);
  app.use(requestTimingMiddleware);

  if (!isTestEnv && slowQueryThresholdMs > 0) {
    prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const durationMs = Date.now() - start;
      if (durationMs >= slowQueryThresholdMs) {
        logger.warn('slow_query', {
          model: params.model ?? 'raw',
          action: params.action,
          duration_ms: durationMs,
        });
      }
      return result;
    });
  }

  if (isTestEnv) {
    app.use((req, _res, next) => {
      const testUserHeader = req.headers['x-test-user'];
      if (testUserHeader) {
        try {
          req.user = JSON.parse(String(testUserHeader));
        } catch (e) {
          // ignore parse errors; normal auth applies
        }
      }
      next();
    });
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.maintenanceMode && req.path !== '/health' && !req.path.startsWith('/api/auth')) {
      return res.status(503).json({
        success: false,
        error: { code: 'MAINTENANCE_MODE', message: 'Service is under maintenance. Please try again later.' },
      });
    }
    return next();
  });

  // Health check route
  app.get('/health', (req: Request, res: Response) => {
    prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        res.json({ status: 'ok', db: 'connected' });
      })
      .catch((err) => {
        logger.error('Health DB check failed', { err });
        res.status(500).json({ status: 'error', db: 'error' });
      });
  });

  app.get('/api/admin/status', authRequired, superadminOnly, async (req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        success: true,
        data: {
          appVersion: process.env.npm_package_version || 'unknown',
          nodeEnv: config.nodeEnv,
          db: 'connected',
        },
      });
    } catch (err) {
      logger.error('Admin status DB check failed', { err });
      res.status(500).json({
        success: false,
        error: { code: 'STATUS_ERROR', message: 'Unable to fetch status' },
      });
    }
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/org', orgManagementRoutes);
  app.use('/api/superadmin/org-units', superadminOrgRoutes);
  app.use('/api/superadmin/users', superadminUsersRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/superadmin/abacus/courses', abacusCoursesRoutes);
  app.use('/api/superadmin/abacus-levels', abacusLevelsRoutes);
  app.use('/superadmin/abacus-worksheets', abacusWorksheetsRoutes);
  app.use('/superadmin/abacus/students', abacusStudentsRoutes);
  app.use('/superadmin/abacus/enrollments', abacusEnrollmentsRoutes);
  app.use('/superadmin/abacus/exams', abacusExamsRoutes);
  app.use('/superadmin/abacus/exams', examQuestionsRoutes);
  app.use('/teacher/abacus', teacherAbacusRoutes);
  app.use('/api/teacher-assignments', teacherAssignmentsRoutes);
  app.use('/api/schedule', abacusScheduleRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/student-dashboard', studentDashboardRoutes);
  app.use('/api/student', studentSelfRoutes);
  app.use('/api/worksheet-assignments', worksheetAssignmentsRoutes);
  app.use('/api/worksheets', worksheetQuestionsRoutes);
  app.use('/api/teacher/worksheets', teacherWorksheetAttemptsRoutes);
  app.use('/api/teacher/worksheets/review', teacherWorksheetReviewRoutes);
  app.use('/api', licensingRoutes);
  app.use('/api', licensingSeatRoutes);
  app.use('/api', auditRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', licenseOrdersRoutes);
  app.use('/api/licensing', licensingSummaryRoutes);
  app.use('/api', licensingAllocationsRoutes);
  app.use('/api', commercialHistoryRoutes);
  app.use('/api/superadmin', superadminSalesRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api', leadAnalyticsRoutes);
  app.use('/api', certificateRoutes);
  app.use('/api', superadminDashboardRoutes);
  app.use('/api/dashboard', superadminOverviewRoutes);
  app.use('/api', moduleAttemptsRoutes);
  app.use('/api', worksheetAttemptsRoutes);
  app.use('/api', examAttemptsRoutes);
  app.use('/api', examDeliveryRoutes);
  app.use('/api', teacherExamReviewRoutes);
  app.use('/api', assessmentAnalyticsRoutes);
  app.use('/api', orgDashboardRoutes);
  app.use('/api', salesLeadsRoutes);
  app.use('/api', teacherDashboardRoutes);
  app.use('/api', centerDashboardRoutes);
  app.use('/api', healthRoutes);

  // Global error handler
  app.use(errorHandler);

  return app;
}

const app = createApp();

// Start server only when not running tests
let server: any;
if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    server.close(() => {
      console.log('Server closed');
    });
  });
}

export default app;
