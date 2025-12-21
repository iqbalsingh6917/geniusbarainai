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
  await prisma.paymentTransaction.deleteMany({});
  await prisma.studentFeeRecord.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.examAnswer.deleteMany({});
  await prisma.examAttempt.deleteMany({});
  await prisma.examQuestion.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.studentWorksheetAnswer.deleteMany({});
  await prisma.studentWorksheetAttempt.deleteMany({});
  await prisma.worksheetOption.deleteMany({});
  await prisma.worksheetQuestion.deleteMany({});
  await prisma.abacusWorksheet.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Superadmin assessments analytics summary', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns a stable summary shape with numeric defaults', async () => {
    const org = await prisma.orgUnit.create({ data: { code: 'SA_ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const superadmin = await prisma.user.create({
      data: { username: 'sa-reports', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: org.id },
    });
    const token = makeToken({ id: superadmin.id, role: superadmin.role, orgUnitId: org.id });

    const res = await request(app)
      .get('/api/superadmin/analytics/assessments/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.exam).toBeDefined();
    expect(typeof data.exam.totalAttempts).toBe('number');
    expect(typeof data.exam.completedAttempts).toBe('number');
    expect(data.worksheet).toBeDefined();
    expect(typeof data.worksheet.totalAttempts).toBe('number');
    expect(typeof data.worksheet.completedAttempts).toBe('number');
  });
});
