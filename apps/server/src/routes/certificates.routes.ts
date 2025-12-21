import { Router } from 'express';
import prisma from '../prismaClient';
import { ok, fail } from '../utils/apiResponse';

const router = Router();

router.get('/certificate/:number', async (req, res) => {
  try {
    const rawNumber = String(req.params.number || '').trim();
    if (!rawNumber) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Certificate number is required');
    }

    const normalized = rawNumber.toUpperCase();
    const code = normalized.startsWith('CERT-') ? normalized.replace(/^CERT-/, '') : normalized;

    const student = await prisma.student.findFirst({
      where: { code },
      include: {
        orgUnit: true,
        enrollments: {
          include: {
            course: true,
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!student) {
      return fail(res, 404, 'CERTIFICATE_NOT_FOUND', 'Certificate not found');
    }

    const enrollment = student.enrollments[0] || null;
    const latestAssessment = enrollment
      ? await prisma.abacusAssessment.findFirst({
          where: { enrollmentId: enrollment.id, passed: true },
          orderBy: { attemptDate: 'desc' },
        })
      : null;

    const issuedOn = latestAssessment?.attemptDate ?? enrollment?.startDate ?? student.createdAt;
    const status = latestAssessment ? 'VALID' : 'PENDING';

    return ok(res, {
      certificateNumber: `CERT-${student.code}`,
      status,
      issuedOn,
      student: {
        name: [student.firstName, student.lastName].filter(Boolean).join(' '),
        code: student.code,
        org: student.orgUnit?.name ?? 'Unknown center',
      },
      course: {
        code: enrollment?.course?.code ?? 'ABACUS_L1_REGULAR',
        name: enrollment?.course?.name ?? 'Abacus Level 1 (Regular)',
      },
      meta: {
        lastAssessmentPercent: latestAssessment?.scorePercent ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Certificate verify error', err);
    return fail(res, 500, 'INTERNAL_ERROR', 'Unable to verify certificate');
  }
});

export default router;
