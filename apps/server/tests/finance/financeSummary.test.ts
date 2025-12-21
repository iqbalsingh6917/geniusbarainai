import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '@lms/db';
import { describe, it, beforeEach, expect } from 'vitest';
import { createApp } from '../../src';

const app = createApp();

const makeToken = (user: { id: number; username?: string; role: string; orgUnitId?: number | null }) => {
  const secret = process.env.JWT_SECRET || 'testsecret123456';
  return jwt.sign(
    {
      userId: user.id,
      username: user.username ?? user.role.toLowerCase(),
      role: user.role,
      orgUnitId: user.orgUnitId ?? null,
    },
    secret,
  );
};

async function resetDb() {
  await prisma.paymentTransaction.deleteMany({});
  await prisma.studentFeeRecord.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.abacusCourse.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Finance summaries', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('org dashboard counts pending dues correctly', async () => {
    const org = await prisma.orgUnit.create({ data: { code: 'BP-FIN', name: 'BP FIN', type: 'BUSINESS_PARTNER' } });
    const course = await prisma.abacusCourse.create({
      data: { code: `COURSE-${Date.now()}`, name: 'Course', variant: 'REGULAR' },
    });
    const student = await prisma.student.create({
      data: { code: `STU-${Date.now()}`, firstName: 'Stu', status: 'ACTIVE', orgUnitId: org.id },
    });
    const enrollment = await prisma.abacusEnrollment.create({
      data: { studentId: student.id, courseId: course.id, status: 'ONGOING', orgUnitId: org.id },
    });
    const bpUser = await prisma.user.create({
      data: { username: 'bp-fin', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: org.id },
    });
    const token = makeToken({ id: bpUser.id, role: 'BUSINESS_PARTNER', orgUnitId: org.id });

    await prisma.studentFeeRecord.createMany({
      data: [
        { studentId: student.id, enrollmentId: enrollment.id, orgUnitId: org.id, amount: 100, status: 'PENDING' },
        { studentId: student.id, enrollmentId: enrollment.id, orgUnitId: org.id, amount: 200, status: 'PAID' },
      ],
    });
    await prisma.paymentTransaction.create({
      data: { orgUnitId: org.id, amount: 150, type: 'CREDIT' },
    });

    const res = await request(app)
      .get('/api/bp/dashboard/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.finance.duesPending).toBe(100);
    expect(data.finance.paymentsTotal).toBe(150);
  });

  it('rejects negative payment transaction amounts', async () => {
    const org = await prisma.orgUnit.create({ data: { code: 'CE-NEG', name: 'Center', type: 'CENTER' } });
    const superadmin = await prisma.user.create({
      data: { username: 'sa-neg', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: org.id },
    });
    const token = makeToken({ id: superadmin.id, role: 'SUPERADMIN', orgUnitId: org.id });

    const res = await request(app)
      .post('/api/finance/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgUnitId: org.id, amount: -10 })
      .expect(400);

    expect(res.body.error.code || res.body.error).toBeDefined();
  });
});
