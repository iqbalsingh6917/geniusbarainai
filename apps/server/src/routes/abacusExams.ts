import { Router } from 'express';
import { prisma } from '@lms/db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const router = Router();

router.get('/', requireAuth, requireRole(['SUPERADMIN']), async (_req, res) => {
  try {
    const exams = await prisma.exam.findMany({ orderBy: { id: 'desc' } });
    ok(res, exams);
  } catch (err) {
    console.error('Failed to list exams', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to fetch exams');
  }
});

router.get('/:id', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return fail(res, 400, 'BAD_REQUEST', 'Invalid exam id');
  }
  try {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      return fail(res, 404, 'NOT_FOUND', 'Exam not found');
    }
    ok(res, exam);
  } catch (err) {
    console.error('Failed to fetch exam', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to fetch exam');
  }
});

router.post('/', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  const { title, courseCode } = req.body || {};
  if (!title || !courseCode) {
    return fail(res, 400, 'BAD_REQUEST', 'title and courseCode are required');
  }
  try {
    const exam = await prisma.exam.create({
      data: { title, courseCode },
    });
    await logAudit(req, {
      action: 'EXAM_CREATED',
      meta: { examId: exam.id, courseCode },
      entityType: 'Exam',
      entityId: exam.id,
    });
    ok(res, exam);
  } catch (err) {
    console.error('Failed to create exam', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to create exam');
  }
});

router.patch('/:id', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return fail(res, 400, 'BAD_REQUEST', 'Invalid exam id');
  }
  const { title, courseCode } = req.body || {};
  if (!title && !courseCode) {
    return fail(res, 400, 'BAD_REQUEST', 'No fields provided to update');
  }
  try {
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(courseCode ? { courseCode } : {}),
      },
    });
    await logAudit(req, {
      action: 'EXAM_UPDATED',
      meta: { examId: exam.id },
      entityType: 'Exam',
      entityId: exam.id,
    });
    ok(res, exam);
  } catch (err) {
    console.error('Failed to update exam', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to update exam');
  }
});

export default router;
