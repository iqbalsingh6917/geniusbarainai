import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isCenterManager, isAdmissions, isTeacher, isSuperadmin } from '../constants/roles';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

// Apply auth middleware to all routes
router.use(authRequired);

// Zod schema for creating/updating schedule
const ScheduleSchema = z.object({
  courseCode: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  teacherUserId: z.number().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/schedule/center
// Roles: CENTER_MANAGER, ADMISSIONS, TEACHER, SUPERADMIN
router.get('/center', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role) && 
        !isTeacher(req.user.role) && !isSuperadmin(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Insufficient permissions.');
    }

    // Get orgUnitId - either from query param (SUPERADMIN only) or user's orgUnitId
    let orgUnitId: number;
    if (isSuperadmin(req.user.role) && req.query.orgUnitId) {
      orgUnitId = parseInt(req.query.orgUnitId as string);
    } else if (req.user.orgUnitId) {
      orgUnitId = req.user.orgUnitId;
    } else {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Build query conditions
    const whereConditions: any = {
      orgUnitId: orgUnitId,
    };

    // For TEACHER with teacherOnly=true, filter by teacherUserId
    if (isTeacher(req.user.role) && req.query.teacherOnly === 'true') {
      whereConditions.teacherUserId = req.user.id;
    }

    // Fetch schedules
    const schedules = await prisma.abacusClassSchedule.findMany({
      where: whereConditions,
      include: {
        teacher: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });

    // Join with course names
    const courseCodes = [...new Set(schedules.map(s => s.courseCode))];
    const courses = await prisma.abacusCourse.findMany({
      where: {
        code: {
          in: courseCodes
        }
      }
    });

    const courseMap = new Map(courses.map(course => [course.code, course.name]));

    // Format response
    const result = schedules.map(schedule => ({
      id: schedule.id,
      courseCode: schedule.courseCode,
      courseName: courseMap.get(schedule.courseCode) || null,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      teacherUserId: schedule.teacherUserId,
      teacherName: schedule.teacher?.username || null,
      room: schedule.room,
      notes: schedule.notes,
      isActive: schedule.isActive
    }));

    // Log audit
    await logAudit(req, {
      action: 'SCHEDULE_CENTER_VIEWED',
      entityType: 'AbacusClassSchedule',
      meta: { 
        orgUnitId,
        userRole: req.user?.role,
        resultsCount: result.length
      }
    });

    ok(res, result);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/schedule
// Roles: CENTER_MANAGER, ADMISSIONS
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Validate request body
    const parsed = ScheduleSchema.parse(req.body);

    // Validate that orgUnitId is a CENTER
    const orgUnit = await prisma.orgUnit.findUnique({
      where: { id: req.user.orgUnitId }
    });

    if (!orgUnit || orgUnit.type !== 'CENTER') {
      return fail(res, 400, 'VALIDATION_ERROR', 'User must belong to a CENTER org unit');
    }

    // If teacherUserId is provided, validate it
    if (parsed.teacherUserId) {
      const teacher = await prisma.user.findUnique({
        where: { 
          id: parsed.teacherUserId,
          role: 'TEACHER',
          orgUnitId: req.user.orgUnitId
        }
      });

      if (!teacher) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid teacherUserId: must be a TEACHER in the same center');
      }
    }

    // Create schedule
    const schedule = await prisma.abacusClassSchedule.create({
      data: {
        orgUnitId: req.user.orgUnitId,
        courseCode: parsed.courseCode,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        teacherUserId: parsed.teacherUserId,
        room: parsed.room,
        notes: parsed.notes,
        isActive: true
      }
    });

    // Log audit
    await logAudit(req, {
      action: 'SCHEDULE_CREATED',
      entityType: 'AbacusClassSchedule',
      entityId: schedule.id,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        courseCode: schedule.courseCode,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      }
    });

    ok(res, schedule, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    
    console.error('Error creating schedule:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /api/schedule/:id
// Roles: CENTER_MANAGER, ADMISSIONS
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    const scheduleId = parseInt(req.params.id);
    if (isNaN(scheduleId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid schedule ID');
    }

    // Validate request body
    const parsed = ScheduleSchema.parse(req.body);

    // Check if schedule exists and belongs to user's center
    const existingSchedule = await prisma.abacusClassSchedule.findUnique({
      where: { 
        id: scheduleId,
        orgUnitId: req.user.orgUnitId
      }
    });

    if (!existingSchedule) {
      return fail(res, 404, 'NOT_FOUND', 'Schedule not found or access denied');
    }

    // If teacherUserId is provided, validate it
    if (parsed.teacherUserId) {
      const teacher = await prisma.user.findUnique({
        where: { 
          id: parsed.teacherUserId,
          role: 'TEACHER',
          orgUnitId: req.user.orgUnitId
        }
      });

      if (!teacher) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid teacherUserId: must be a TEACHER in the same center');
      }
    }

    // Update schedule
    const updatedSchedule = await prisma.abacusClassSchedule.update({
      where: { 
        id: scheduleId,
        orgUnitId: req.user.orgUnitId
      },
      data: {
        courseCode: parsed.courseCode,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        teacherUserId: parsed.teacherUserId,
        room: parsed.room,
        notes: parsed.notes
      }
    });

    // Log audit
    await logAudit(req, {
      action: 'SCHEDULE_UPDATED',
      entityType: 'AbacusClassSchedule',
      entityId: updatedSchedule.id,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        courseCode: updatedSchedule.courseCode,
        dayOfWeek: updatedSchedule.dayOfWeek,
        startTime: updatedSchedule.startTime,
        endTime: updatedSchedule.endTime
      }
    });

    ok(res, updatedSchedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    
    console.error('Error updating schedule:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /api/schedule/:id
// Roles: CENTER_MANAGER, ADMISSIONS
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || (!isCenterManager(req.user.role) && !isAdmissions(req.user.role))) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Center Manager or Admissions role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    const scheduleId = parseInt(req.params.id);
    if (isNaN(scheduleId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid schedule ID');
    }

    // Check if schedule exists and belongs to user's center
    const existingSchedule = await prisma.abacusClassSchedule.findUnique({
      where: { 
        id: scheduleId,
        orgUnitId: req.user.orgUnitId
      }
    });

    if (!existingSchedule) {
      return fail(res, 404, 'NOT_FOUND', 'Schedule not found or access denied');
    }

    // Delete schedule
    await prisma.abacusClassSchedule.delete({
      where: { 
        id: scheduleId,
        orgUnitId: req.user.orgUnitId
      }
    });

    // Log audit
    await logAudit(req, {
      action: 'SCHEDULE_DELETED',
      entityType: 'AbacusClassSchedule',
      entityId: scheduleId,
      meta: { 
        orgUnitId: req.user?.orgUnitId,
        scheduleId: scheduleId
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /api/schedule/teacher
// Role: TEACHER
router.get('/teacher', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has appropriate role
    if (!req.user || !isTeacher(req.user.role)) {
      return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Teacher role required.');
    }

    if (!req.user.orgUnitId) {
      return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
    }

    // Fetch schedules for this teacher
    const schedules = await prisma.abacusClassSchedule.findMany({
      where: {
        orgUnitId: req.user.orgUnitId,
        teacherUserId: req.user.id,
        isActive: true
      },
      include: {
        teacher: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });

    // Join with course names
    const courseCodes = [...new Set(schedules.map(s => s.courseCode))];
    const courses = await prisma.abacusCourse.findMany({
      where: {
        code: {
          in: courseCodes
        }
      }
    });

    const courseMap = new Map(courses.map(course => [course.code, course.name]));

    // Format response
    const result = schedules.map(schedule => ({
      id: schedule.id,
      courseCode: schedule.courseCode,
      courseName: courseMap.get(schedule.courseCode) || null,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      teacherUserId: schedule.teacherUserId,
      teacherName: schedule.teacher?.username || null,
      room: schedule.room,
      notes: schedule.notes,
      isActive: schedule.isActive
    }));

    ok(res, result);
  } catch (error) {
    console.error('Error fetching teacher schedules:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;