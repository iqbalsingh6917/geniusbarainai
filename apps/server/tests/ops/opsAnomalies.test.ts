import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { prisma } from '@lms/db';
import { createApp } from '../../src';
import { computeOpsAnomalies } from '../../src/services/opsAnomalyService';

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
  await prisma.orgUnit.deleteMany({});
  await prisma.abacusCourse.deleteMany({});
}

async function seedOrgTree() {
  const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
  const bp1 = await prisma.orgUnit.create({
    data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id },
  });
  const fr1 = await prisma.orgUnit.create({
    data: { code: 'FR1', name: 'FR1', type: 'FRANCHISE', parentId: bp1.id },
  });
  const center1 = await prisma.orgUnit.create({
    data: { code: 'CE1', name: 'CE1', type: 'CENTER', parentId: fr1.id },
  });

  const bp2 = await prisma.orgUnit.create({
    data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id },
  });
  const fr2 = await prisma.orgUnit.create({
    data: { code: 'FR2', name: 'FR2', type: 'FRANCHISE', parentId: bp2.id },
  });
  const center2 = await prisma.orgUnit.create({
    data: { code: 'CE2', name: 'CE2', type: 'CENTER', parentId: fr2.id },
  });

  return { root, bp1, fr1, center1, bp2, fr2, center2 };
}

async function seedUsers(orgs: Awaited<ReturnType<typeof seedOrgTree>>) {
  const superadmin = await prisma.user.create({
    data: { username: 'sa_ops', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: orgs.root.id },
  });
  const bpUser = await prisma.user.create({
    data: { username: 'bp_ops', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: orgs.bp1.id },
  });
  return { superadmin, bpUser };
}

describe('Ops anomalies', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('scopes summary to BP subtree', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);

    await prisma.paymentTransaction.createMany({
      data: [
        { orgUnitId: orgs.center1.id, amount: 1000, type: 'CREDIT', method: 'CASH' },
        { orgUnitId: orgs.center2.id, amount: 2000, type: 'CREDIT', method: 'CASH' },
      ],
    });

    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const res = await request(app)
      .get('/api/ops/anomalies/summary?window=30')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.totals.collectionsCurrent).toBe(1000);
  });

  it('computes rule-based anomalies deterministically', () => {
    const anomalies = computeOpsAnomalies(
      {
        collectionsCurrent: 50,
        collectionsPrevious: 200,
        outstandingNow: 300,
        outstandingPrevious: 100,
        overdueCountNow: 12,
        overdueCountPrevious: 5,
        transactionsCount: 0,
        enrollmentsCount: 0,
      },
      30,
    );

    const codes = anomalies.map((a) => a.code);
    expect(codes).toContain('COLLECTION_DROP');
    expect(codes).toContain('DUE_SPIKE');
    expect(codes).toContain('PAYMENT_OVERDUE_CLUSTER');
    expect(codes).toContain('ZERO_ACTIVITY');

    const collectionDrop = anomalies.find((a) => a.code === 'COLLECTION_DROP');
    expect(collectionDrop?.severity).toBe('CRITICAL');
  });

  it('applies pagination defaults for by-unit endpoint', async () => {
    const orgs = await seedOrgTree();
    const { superadmin } = await seedUsers(orgs);

    const centersData = Array.from({ length: 25 }).map((_, idx) => ({
      code: `CE${idx + 10}`,
      name: `Center ${idx + 10}`,
      type: 'CENTER',
      parentId: orgs.root.id,
    }));

    await prisma.orgUnit.createMany({ data: centersData });

    const token = makeToken({ id: superadmin.id, role: superadmin.role, orgUnitId: superadmin.orgUnitId });
    const res = await request(app)
      .get('/api/ops/anomalies/by-unit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
    expect(data.total).toBe(27);
    expect(data.items.length).toBe(20);
  });
});
