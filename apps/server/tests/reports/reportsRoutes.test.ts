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
  await prisma.studentFeeRecord.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Reports routes & healthcheck', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns health ok', async () => {
    await request(app).get('/api/health').expect(200).expect(({ body }) => {
      expect(body.status).toBe('ok');
    });
  });

  it('superadmin can fetch students report', async () => {
    const org = await prisma.orgUnit.create({ data: { code: 'ORG-RPT', name: 'Org', type: 'CENTER' } });
    await prisma.student.create({
      data: { code: 'STU-RPT', firstName: 'Rep', status: 'ACTIVE', orgUnitId: org.id },
    });
    const superadmin = await prisma.user.create({
      data: { username: 'sa-reports-route', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: org.id },
    });
    const token = makeToken({ id: superadmin.id, role: superadmin.role, orgUnitId: org.id });

    const res = await request(app)
      .get('/api/reports/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toHaveProperty('code');
  });
});
