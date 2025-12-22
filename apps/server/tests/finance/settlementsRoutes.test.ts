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

describe('Settlements (draft)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft settlement by recomputing totals', async () => {
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

    await prisma.paymentTransaction.createMany({
      data: [
        { orgUnitId: center.id, amount: 200, type: 'CREDIT', createdAt: new Date('2025-03-05T10:00:00.000Z') },
        { orgUnitId: center.id, amount: 150, type: 'CREDIT', createdAt: new Date('2025-03-10T10:00:00.000Z') },
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
          createdAt: new Date('2025-03-02T10:00:00.000Z'),
        },
      ],
    });

    const centerUser = await prisma.user.create({
      data: { username: 'ce-settle', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: center.id },
    });
    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });

    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orgUnitId: center.id,
        periodStart: new Date('2025-03-01T00:00:00.000Z').toISOString(),
        periodEnd: new Date('2025-03-31T23:59:59.999Z').toISOString(),
        revenueSharePercent: 10,
        grossCollected: 9999,
      })
      .expect(201);

    const data = res.body.data ?? res.body;
    expect(data.grossCollected).toBe(350);
    expect(data.revenueSharePercent).toBe(10);
    expect(data.revenueShareAmount).toBe(35);
    expect(data.netPayable).toBe(35);
    expect(data.status).toBe('DRAFT');
  });

  it('blocks draft creation outside BP scope', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const bp1 = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const bp2 = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER', parentId: bp2.id } });

    const bpUser = await prisma.user.create({
      data: { username: 'bp-settle', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: bp1.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orgUnitId: center2.id,
        periodStart: new Date('2025-01-01').toISOString(),
        periodEnd: new Date('2025-01-31').toISOString(),
      })
      .expect(403);
  });

  it('applies pagination defaults for settlements list', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-settle', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    await prisma.settlement.createMany({
      data: [
        {
          orgUnitId: center.id,
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          grossCollected: 100,
          refunds: 0,
          adjustments: 0,
          netCollected: 100,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'DRAFT',
        },
        {
          orgUnitId: center.id,
          periodStart: new Date('2025-02-01'),
          periodEnd: new Date('2025-02-28'),
          grossCollected: 200,
          refunds: 0,
          adjustments: 0,
          netCollected: 200,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'DRAFT',
        },
      ],
    });

    const res = await request(app)
      .get('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
    expect(data.total).toBe(2);
    expect(data.items.length).toBe(2);
  });

  it('scopes settlement list to BP subtree', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const bp1 = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const bp2 = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const center1 = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center1', type: 'CENTER', parentId: bp1.id } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER', parentId: bp2.id } });

    await prisma.settlement.createMany({
      data: [
        {
          orgUnitId: center1.id,
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          grossCollected: 100,
          refunds: 0,
          adjustments: 0,
          netCollected: 100,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'DRAFT',
        },
        {
          orgUnitId: center2.id,
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          grossCollected: 100,
          refunds: 0,
          adjustments: 0,
          netCollected: 100,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'DRAFT',
        },
      ],
    });

    const bpUser = await prisma.user.create({
      data: { username: 'bp-list', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: bp1.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    const res = await request(app)
      .get('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.total).toBe(1);
    expect(data.items.length).toBe(1);
    expect(data.items[0].orgUnitId).toBe(center1.id);
  });
});
