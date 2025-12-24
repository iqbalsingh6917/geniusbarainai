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
  await prisma.staffOrgUnitAssignment.deleteMany({});
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

  it('prevents duplicate draft creation for the same period', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-dup', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const payload = {
      orgUnitId: center.id,
      periodStart: '2025-04-01',
      periodEnd: '2025-04-30',
    };

    await request(app).post('/api/finance/settlements').set('Authorization', `Bearer ${token}`).send(payload).expect(201);

    await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409);
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

  it('allows head coordinator to list settlements within assigned centers', async () => {
    const saRoot = await prisma.orgUnit.create({ data: { code: 'SA_ROOT', name: 'SA Root', type: 'SUPERADMIN_ROOT' } });
    const center = await prisma.orgUnit.create({ 
      data: { code: 'CE1', name: 'Center', type: 'CENTER', parentId: saRoot.id } 
    });
    const headCoordinator = await prisma.user.create({
      data: { username: 'hc-user', passwordHash: 'x', role: 'HEAD_COORDINATOR', orgUnitId: center.id },
    });
    await prisma.staffOrgUnitAssignment.create({
      data: { userId: headCoordinator.id, orgUnitId: center.id, roleType: 'HEAD_COORDINATOR' },
    });
    const token = makeToken({ id: headCoordinator.id, role: headCoordinator.role, orgUnitId: center.id });

    await prisma.settlement.create({
      data: {
        orgUnitId: center.id,
        periodStart: new Date('2025-03-01T00:00:00.000Z'),
        periodEnd: new Date('2025-03-31T23:59:59.999Z'),
        grossCollected: 1000,
        netPayable: 1000,
        revenueSharePercent: 10,
        status: 'DRAFT',
      },
    });

    const res = await request(app)
      .get('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].orgUnitId).toBe(center.id);
  });

  it('blocks coordinator from settlements list', async () => {
    const saRoot = await prisma.orgUnit.create({ data: { code: 'SA_ROOT', name: 'SA Root', type: 'SUPERADMIN_ROOT' } });
    const center = await prisma.orgUnit.create({ 
      data: { code: 'CE1', name: 'Center', type: 'CENTER', parentId: saRoot.id } 
    });
    const coordinator = await prisma.user.create({
      data: { username: 'co-user', passwordHash: 'x', role: 'COORDINATOR', orgUnitId: center.id },
    });
    await prisma.staffOrgUnitAssignment.create({
      data: { userId: coordinator.id, orgUnitId: center.id, roleType: 'COORDINATOR' },
    });
    const token = makeToken({ id: coordinator.id, role: coordinator.role, orgUnitId: coordinator.orgUnitId });

    const res = await request(app)
      .get('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.error).toBe('Forbidden: missing permission canViewPayments');
  });

  it('filters settlements by payment status', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-payfilter', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    await prisma.settlement.createMany({
      data: [
        {
          orgUnitId: center.id,
          periodStart: new Date('2025-07-01'),
          periodEnd: new Date('2025-07-31'),
          grossCollected: 100,
          refunds: 0,
          adjustments: 0,
          netCollected: 100,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'FINALIZED',
          paymentStatus: 'PAID',
          paidAt: new Date('2025-08-01T10:00:00.000Z'),
        },
        {
          orgUnitId: center.id,
          periodStart: new Date('2025-08-01'),
          periodEnd: new Date('2025-08-31'),
          grossCollected: 200,
          refunds: 0,
          adjustments: 0,
          netCollected: 200,
          revenueSharePercent: 0,
          revenueShareAmount: 0,
          netPayable: 0,
          status: 'FINALIZED',
          paymentStatus: 'UNPAID',
        },
      ],
    });

    const res = await request(app)
      .get('/api/finance/settlements?paymentStatus=PAID')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.total).toBe(1);
    expect(data.items[0].paymentStatus).toBe('PAID');
  });

  it('finalizes a draft by recomputing totals and locking status', async () => {
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

    await prisma.studentFeeRecord.create({
      data: {
        studentId: student.id,
        enrollmentId: enrollment.id,
        orgUnitId: center.id,
        amount: 400,
        status: 'PENDING',
        createdAt: new Date('2025-05-02T10:00:00.000Z'),
      },
    });

    await prisma.paymentTransaction.create({
      data: { orgUnitId: center.id, amount: 100, type: 'CREDIT', createdAt: new Date('2025-05-05T10:00:00.000Z') },
    });

    const centerUser = await prisma.user.create({
      data: { username: 'ce-final', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: center.id },
    });
    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });

    const createRes = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orgUnitId: center.id,
        periodStart: '2025-05-01',
        periodEnd: '2025-05-31',
        revenueSharePercent: 10,
      })
      .expect(201);

    const created = createRes.body.data ?? createRes.body;
    expect(created.status).toBe('DRAFT');

    await prisma.paymentTransaction.create({
      data: { orgUnitId: center.id, amount: 50, type: 'CREDIT', createdAt: new Date('2025-05-20T10:00:00.000Z') },
    });

    const finalizeRes = await request(app)
      .post(`/api/finance/settlements/${created.id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const finalized = finalizeRes.body.data ?? finalizeRes.body;
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.grossCollected).toBe(150);
    expect(finalized.revenueShareAmount).toBe(15);
    expect(finalized.finalizedByUserId).toBe(centerUser.id);

    await request(app)
      .post(`/api/finance/settlements/${created.id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('blocks marking paid for draft settlements', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-paid-draft', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const createRes = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: center.id, periodStart: '2025-09-01', periodEnd: '2025-09-30' })
      .expect(201);

    const created = createRes.body.data ?? createRes.body;

    await request(app)
      .post(`/api/finance/settlements/${created.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentRef: 'TXN-001' })
      .expect(409);
  });

  it('marks a finalized settlement as paid and blocks duplicate payments', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-paid', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const createRes = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: center.id, periodStart: '2025-10-01', periodEnd: '2025-10-31' })
      .expect(201);

    const created = createRes.body.data ?? createRes.body;

    await request(app)
      .post(`/api/finance/settlements/${created.id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const paidRes = await request(app)
      .post(`/api/finance/settlements/${created.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentRef: 'TXN-PAID-1' })
      .expect(200);

    const paid = paidRes.body.data ?? paidRes.body;
    expect(paid.paymentStatus).toBe('PAID');
    expect(paid.paidByUserId).toBe(admin.id);
    expect(paid.paymentRef).toBe('TXN-PAID-1');
    expect(paid.paidAt).toBeTruthy();

    await request(app)
      .post(`/api/finance/settlements/${created.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('blocks mark-paid outside org scope', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const bp1 = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const bp2 = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER', parentId: bp2.id } });

    const superadmin = await prisma.user.create({
      data: { username: 'sa-paid', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: root.id },
    });
    const superToken = makeToken({ id: superadmin.id, role: superadmin.role, orgUnitId: superadmin.orgUnitId });

    const createRes = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ orgUnitId: center2.id, periodStart: '2025-11-01', periodEnd: '2025-11-30' })
      .expect(201);

    const created = createRes.body.data ?? createRes.body;

    await request(app)
      .post(`/api/finance/settlements/${created.id}/finalize`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const bpUser = await prisma.user.create({
      data: { username: 'bp-paid', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: bp1.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    await request(app)
      .post(`/api/finance/settlements/${created.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('blocks finalizing when an overlapping settlement is already finalized', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const admin = await prisma.user.create({
      data: { username: 'sa-overlap', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const first = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: center.id, periodStart: '2025-06-01', periodEnd: '2025-06-30' })
      .expect(201);

    const firstSettlement = first.body.data ?? first.body;

    await request(app)
      .post(`/api/finance/settlements/${firstSettlement.id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const second = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: center.id, periodStart: '2025-06-15', periodEnd: '2025-07-15' })
      .expect(201);

    const secondSettlement = second.body.data ?? second.body;

    await request(app)
      .post(`/api/finance/settlements/${secondSettlement.id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
