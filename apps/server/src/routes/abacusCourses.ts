import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest, superadminOnly } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

// Apply middleware to all routes in this router
router.use(authRequired);

const allowedRoles = new Set([
  'SUPERADMIN',
  'BUSINESS_PARTNER',
  'FRANCHISE',
  'CENTER_MANAGER',
  'ADMISSIONS',
  'TEACHER',
]);

const courseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  variant: z.string().min(1),
  description: z.string().optional().nullable(),
});

const updateCourseSchema = courseSchema.partial();

const moduleSchema = z.object({
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  skillFocus: z.string().optional().nullable(),
});

const updateModuleSchema = moduleSchema.partial();

// GET /superadmin/abacus/courses
// Return all AbacusCourse rows with their modules (include modules order by index)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !allowedRoles.has(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }
    // First get courses with modules
    const courses = await prisma.abacusCourse.findMany({
      include: {
        modules: {
          orderBy: {
            index: 'asc',
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    
    // For each course and module, get the level count
    const coursesWithLevelCounts = await Promise.all(courses.map(async (course) => {
      const modulesWithLevelCounts = await Promise.all(course.modules.map(async (module: any) => {
        // Use Prisma's $queryRaw to bypass the type checking issue
        const levelCountResult: any = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AbacusLevel" WHERE "moduleId" = ${module.id}`;
        const levelCount = parseInt(levelCountResult[0].count);
        
        return {
          ...module,
          levelCount,
        };
      }));
      
      return {
        ...course,
        modules: modulesWithLevelCounts,
      };
    }));
    
    // Convert BigInt values to numbers for JSON serialization
    const serializedCourses = coursesWithLevelCounts.map((course: any) => {
      const serializedCourse: any = {};
      for (const [key, value] of Object.entries(course)) {
        if (key === 'modules') {
          serializedCourse[key] = (value as any[]).map((module: any) => {
            const serializedModule: any = {};
            for (const [moduleKey, moduleValue] of Object.entries(module)) {
              if (typeof moduleValue === 'bigint') {
                serializedModule[moduleKey] = Number(moduleValue);
              } else {
                serializedModule[moduleKey] = moduleValue;
              }
            }
            return serializedModule;
          });
        } else if (typeof value === 'bigint') {
          serializedCourse[key] = Number(value);
        } else {
          serializedCourse[key] = value;
        }
      }
      return serializedCourse;
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_COURSES_VIEWED',
      entityType: 'AbacusCourse',
      meta: { coursesCount: serializedCourses.length }
    });

    ok(res, serializedCourses);
  } catch (err) {
    console.error('Error fetching abacus courses:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/abacus/courses
router.post('/', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const payload = courseSchema.parse(req.body);

    const course = await prisma.abacusCourse.create({
      data: {
        code: payload.code,
        name: payload.name,
        variant: payload.variant,
        description: payload.description ?? null,
      },
    });

    await logAudit(req, {
      action: 'ABACUS_COURSE_CREATED',
      entityType: 'AbacusCourse',
      entityId: course.id.toString(),
      meta: { code: course.code },
    });

    ok(res, course, 201);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid course payload', err.errors);
    }
    console.error('Error creating course:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PATCH /superadmin/abacus/courses/:id
router.patch('/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    if (!courseId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid course ID');
    }

    const payload = updateCourseSchema.parse(req.body);

    const existing = await prisma.abacusCourse.findUnique({ where: { id: courseId } });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'Course not found');
    }

    const updated = await prisma.abacusCourse.update({
      where: { id: courseId },
      data: {
        code: payload.code ?? existing.code,
        name: payload.name ?? existing.name,
        variant: payload.variant ?? existing.variant,
        description: typeof payload.description === 'undefined' ? existing.description : payload.description ?? null,
      },
    });

    await logAudit(req, {
      action: 'ABACUS_COURSE_UPDATED',
      entityType: 'AbacusCourse',
      entityId: updated.id.toString(),
      meta: { code: updated.code },
    });

    ok(res, updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid course payload', err.errors);
    }
    console.error('Error updating course:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/abacus/courses/:courseId/modules
router.post('/:courseId/modules', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid course ID');
    }

    const payload = moduleSchema.parse(req.body);

    const course = await prisma.abacusCourse.findUnique({ where: { id: courseId } });
    if (!course) {
      return fail(res, 404, 'NOT_FOUND', 'Course not found');
    }

    const module = await prisma.abacusModule.create({
      data: {
        courseId,
        index: payload.index,
        title: payload.title,
        summary: payload.summary ?? null,
        skillFocus: payload.skillFocus ?? null,
      },
    });

    await logAudit(req, {
      action: 'ABACUS_MODULE_CREATED',
      entityType: 'AbacusModule',
      entityId: module.id.toString(),
      meta: { courseId },
    });

    ok(res, module, 201);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid module payload', err.errors);
    }
    console.error('Error creating module:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PATCH /superadmin/abacus/modules/:moduleId
router.patch('/modules/:moduleId', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const moduleId = Number(req.params.moduleId);
    if (!moduleId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid module ID');
    }

    const payload = updateModuleSchema.parse(req.body);

    const existing = await prisma.abacusModule.findUnique({ where: { id: moduleId } });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'Module not found');
    }

    const updated = await prisma.abacusModule.update({
      where: { id: moduleId },
      data: {
        index: payload.index ?? existing.index,
        title: payload.title ?? existing.title,
        summary: typeof payload.summary === 'undefined' ? existing.summary : payload.summary ?? null,
        skillFocus: typeof payload.skillFocus === 'undefined' ? existing.skillFocus : payload.skillFocus ?? null,
      },
    });

    await logAudit(req, {
      action: 'ABACUS_MODULE_UPDATED',
      entityType: 'AbacusModule',
      entityId: updated.id.toString(),
      meta: { courseId: updated.courseId },
    });

    ok(res, updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid module payload', err.errors);
    }
    console.error('Error updating module:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/abacus/courses/:id/modules
// Return all modules for a specific course
router.get('/:id/modules', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !allowedRoles.has(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied');
    }
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid course ID');
    }
    
    // Check if course exists
    const course = await prisma.abacusCourse.findUnique({
      where: { id: courseId },
    });
    
    if (!course) {
      return fail(res, 404, 'NOT_FOUND', 'Course not found');
    }
    
    // Get modules for this course
    const modules = await prisma.abacusModule.findMany({
      where: { courseId: courseId },
      orderBy: { index: 'asc' },
    });

    // Log audit
    await logAudit(req, {
      action: 'ABACUS_COURSE_MODULES_VIEWED',
      entityType: 'AbacusModule',
      meta: { courseId, modulesCount: modules.length }
    });

    ok(res, modules);
  } catch (err) {
    console.error('Error fetching modules:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
