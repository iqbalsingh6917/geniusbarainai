import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, afterAll } from 'vitest';
import { prisma } from '@lms/db';
import { createApp } from '../../src';

const app = createApp();

const makeToken = (user: { id: number; role: string; orgUnitId?: number | null }) => {
  const secret = process.env.JWT_SECRET || 'testsecret123456';
  return jwt.sign(
    { userId: user.id, username: user.role.toLowerCase(), role: user.role, orgUnitId: user.orgUnitId ?? null },
    secret,
  );
};

describe('Finance permissions', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('teacher cannot record payment', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOTF', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const center = await prisma.orgUnit.create({ data: { code: 'CE_F', name: 'Center', type: 'CENTER', parentId: root.id } });
    const teacher = await prisma.user.create({
      data: { username: 'teacher_fin', passwordHash: 'x', role: 'TEACHER', orgUnitId: center.id },
    });

    const token = makeToken({ id: teacher.id, role: teacher.role, orgUnitId: teacher.orgUnitId });
    await request(app)
      .post('/api/finance/center/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500, method: 'CASH' })
      .expect(403);
  });
});
