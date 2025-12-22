import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '@lms/db';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { createApp } from '../../src';

const app = createApp();

const makeToken = (user: { id: number; role: string; orgUnitId?: number | null }) => {
  const secret = process.env.JWT_SECRET || 'testsecret123456';
  return jwt.sign(
    {
      userId: user.id,
      username: user.role.toLowerCase(),
      role: user.role,
      orgUnitId: user.orgUnitId ?? null,
    },
    secret,
  );
};

async function resetDb() {
  await prisma.settlement.deleteMany({});
  await prisma.paymentTransaction.deleteMany({});
  await prisma.studentFeeRecord.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.abacusCourse.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Settlement preview', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocks preview for org units outside BP scope', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const bp1 = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const bp2 = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER', parentId: bp2.id } });

    const bpUser = await prisma.user.create({
      data: { username: 'bp-prev', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: bp1.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    await request(app)
      .post('/api/finance/settlements/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orgUnitId: center2.id,
        periodStart: new Date('2025-01-01').toISOString(),
        periodEnd: new Date('2025-01-31').toISOString(),
      })
      .expect(403);
  });

  it('computes settlement preview totals for center scope', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const course = await prisma.abacusCourse.create({
      data: { code: `COURSE-${Date.now()}`, name: 'Course', variant: 'REGULAR' },
    });
    const student = await prisma.student.create({
      data: { code: `STU-${Date.now()}`, firstName: 'Stu', status: 'ACTIVE', orgUnitId: center.id },
    });
    const enrollment = await prisma.abacusEnrollment.create({
      data: { studentId: student.id, courseId: course.id, status: 'ONGOING', orgUnitId: center.id },
    });

    const centerUser = await prisma.user.create({
      data: { username: 'ce-prev', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: center.id },
    });
    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });

    const periodStart = new Date('2025-02-01T00:00:00.000Z');
    const periodEnd = new Date('2025-02-28T23:59:59.999Z');

    await prisma.paymentTransaction.createMany({
      data: [
        { orgUnitId: center.id, amount: 150, type: 'CREDIT', createdAt: new Date('2025-02-10T10:00:00.000Z') },
        { orgUnitId: center.id, amount: 300, type: 'CREDIT', createdAt: new Date('2025-01-10T10:00:00.000Z') },
      ],
    });

    await prisma.studentFeeRecord.createMany({
      data: [
        {
          studentId: student.id,
          enrollmentId: enrollment.id,
          orgUnitId: center.id,
          amount: 500,
          status: 'PENDING',
          createdAt: new Date('2025-02-05T10:00:00.000Z'),
        },
        {
          studentId: student.id,
          enrollmentId: enrollment.id,
          orgUnitId: center.id,
          amount: 200,
          status: 'PAID',
          createdAt: new Date('2025-01-05T10:00:00.000Z'),
        },
      ],
    });

    const res = await request(app)
      .post('/api/finance/settlements/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: center.id, periodStart, periodEnd })
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.grossCollected).toBe(150);
    expect(data.netCollected).toBe(150);
    expect(data.revenueSharePercent).toBe(0);
    expect(data.breakdown.duesRaised).toBe(500);
    expect(data.breakdown.outstandingAmount).toBeGreaterThan(0);
  });
});
