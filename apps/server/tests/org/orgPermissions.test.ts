import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, afterAll, expect } from 'vitest';
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

describe('Org permissions', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('non-superadmin cannot list org units (assign-manager actions)', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOTX', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const center = await prisma.orgUnit.create({ data: { code: 'CE_X', name: 'Center', type: 'CENTER', parentId: root.id } });
    const centerUser = await prisma.user.create({
      data: { username: 'ce_org', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: center.id },
    });

    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });
    await request(app).get('/api/org/units').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('center user cannot assign org unit manager', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOTY', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const center = await prisma.orgUnit.create({ data: { code: 'CE_Y', name: 'Center Y', type: 'CENTER', parentId: root.id } });
    const centerUser = await prisma.user.create({
      data: { username: 'ce_assign', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: center.id },
    });

    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });
    await request(app)
      .post(`/api/org/units/${center.id}/assign-manager`)
      .set('Authorization', `Bearer ${token}`)
      .send({ managerUserId: centerUser.id })
      .expect(403);
  });
});
