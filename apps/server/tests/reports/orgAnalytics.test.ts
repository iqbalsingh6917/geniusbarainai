import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { prisma } from '@lms/db';
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
  await prisma.examAttempt.deleteMany({});
  await prisma.studentWorksheetAttempt.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.abacusCourse.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Org dashboard analytics scoping', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns only scoped org data for BP dashboard', async () => {
    const orgA = await prisma.orgUnit.create({ data: { code: 'BP-A', name: 'BP A', type: 'BUSINESS_PARTNER' } });
    const orgB = await prisma.orgUnit.create({ data: { code: 'BP-B', name: 'BP B', type: 'BUSINESS_PARTNER' } });
    const course = await prisma.abacusCourse.create({
      data: { code: 'COURSE-ORG', name: 'Course', variant: 'REGULAR' },
    });

    // Org A data
    const studentA = await prisma.student.create({
      data: { code: 'STU-A', firstName: 'A', status: 'ACTIVE', orgUnitId: orgA.id },
    });
    const enrollmentA = await prisma.abacusEnrollment.create({
      data: { studentId: studentA.id, courseId: course.id, status: 'ONGOING', orgUnitId: orgA.id },
    });
    await prisma.studentFeeRecord.create({
      data: { studentId: studentA.id, enrollmentId: enrollmentA.id, orgUnitId: orgA.id, amount: 100, status: 'PENDING' },
    });
    await prisma.paymentTransaction.create({ data: { orgUnitId: orgA.id, amount: 150, type: 'CREDIT' } });

    // Org B data (should be excluded)
    const studentB = await prisma.student.create({
      data: { code: 'STU-B', firstName: 'B', status: 'ACTIVE', orgUnitId: orgB.id },
    });
    const enrollmentB = await prisma.abacusEnrollment.create({
      data: { studentId: studentB.id, courseId: course.id, status: 'ONGOING', orgUnitId: orgB.id },
    });
    await prisma.studentFeeRecord.create({
      data: { studentId: studentB.id, enrollmentId: enrollmentB.id, orgUnitId: orgB.id, amount: 200, status: 'PENDING' },
    });
    await prisma.paymentTransaction.create({ data: { orgUnitId: orgB.id, amount: 300, type: 'CREDIT' } });

    const bpUser = await prisma.user.create({
      data: { username: 'bp-scope', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: orgA.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: orgA.id });

    const res = await request(app)
      .get('/api/bp/dashboard/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.totals.students).toBe(1);
    expect(data.totals.enrollmentsOngoing).toBe(1);
    expect(data.finance.duesPending).toBe(100);
    expect(data.finance.paymentsTotal).toBe(150);
  });
});
