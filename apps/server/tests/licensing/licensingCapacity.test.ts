import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '@lms/db';
import { describe, it, beforeEach, expect } from 'vitest';
import { createApp } from '../../src';
import { incrementLicenseSeat } from '../../src/services/licensingService';

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
  await prisma.licenseAllocation.deleteMany({});
  await prisma.courseLicense.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

describe('Licensing capacity and validity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('prevents allocating seats beyond parent capacity', async () => {
    const parent = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER' } });
    const child = await prisma.orgUnit.create({ data: { code: 'FR1', name: 'FR1', type: 'FRANCHISE', parentId: parent.id } });
    const bpUser = await prisma.user.create({
      data: { username: 'bp1', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: parent.id },
    });
    const token = makeToken({ id: bpUser.id, role: 'BUSINESS_PARTNER', orgUnitId: parent.id });
    await prisma.courseLicense.create({
      data: { orgUnitId: parent.id, courseCode: 'ABACUS_L1', totalSeats: 2, usedSeats: 0 },
    });

    // allocate all seats
    await request(app)
      .post('/api/seat-allocations')
      .set('Authorization', `Bearer ${token}`)
      .send({ parentOrgUnitId: parent.id, childOrgUnitId: child.id, courseCode: 'ABACUS_L1', seats: 2 })
      .expect(201);

    // attempt to over-allocate
    const res = await request(app)
      .post('/api/seat-allocations')
      .set('Authorization', `Bearer ${token}`)
      .send({ parentOrgUnitId: parent.id, childOrgUnitId: child.id, courseCode: 'ABACUS_L1', seats: 1 })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('rejects allocation when license is expired', async () => {
    const parent = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER' } });
    const child = await prisma.orgUnit.create({ data: { code: 'FR2', name: 'FR2', type: 'FRANCHISE', parentId: parent.id } });
    const bpUser = await prisma.user.create({
      data: { username: 'bp2', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: parent.id },
    });
    const token = makeToken({ id: bpUser.id, role: 'BUSINESS_PARTNER', orgUnitId: parent.id });
    await prisma.courseLicense.create({
      data: {
        orgUnitId: parent.id,
        courseCode: 'ABACUS_L1',
        totalSeats: 5,
        usedSeats: 0,
        validTo: new Date('2000-01-01'),
      },
    });

    const res = await request(app)
      .post('/api/seat-allocations')
      .set('Authorization', `Bearer ${token}`)
      .send({ parentOrgUnitId: parent.id, childOrgUnitId: child.id, courseCode: 'ABACUS_L1', seats: 1 })
      .expect(400);

    expect(res.body.error).toBe('NO_ACTIVE_LICENSE');
  });

  it('incrementLicenseSeat fails when no active license', async () => {
    await expect(incrementLicenseSeat(9999, 'ABACUS_L1')).rejects.toThrow();
  });
});
