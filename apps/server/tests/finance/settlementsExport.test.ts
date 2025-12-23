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

describe('Settlements CSV export', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('exports settlement list as CSV with headers', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    await prisma.settlement.create({
      data: {
        orgUnitId: center.id,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        periodEnd: new Date('2025-01-31T00:00:00.000Z'),
        grossCollected: 100,
        refunds: 0,
        adjustments: 0,
        netCollected: 100,
        revenueSharePercent: 10,
        revenueShareAmount: 10,
        netPayable: 10,
        status: 'DRAFT',
      },
    });

    const admin = await prisma.user.create({
      data: { username: 'sa-export', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const res = await request(app)
      .get('/api/finance/settlements/export.csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('settlements_');
    const lines = res.text.trim().split(/\r?\n/);
    expect(lines[0]).toContain('settlementId');
    expect(lines.length).toBe(2);
  });

  it('applies filters to list export', async () => {
    const center1 = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center1', type: 'CENTER' } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER' } });

    await prisma.settlement.createMany({
      data: [
        {
          orgUnitId: center1.id,
          periodStart: new Date('2025-02-01T00:00:00.000Z'),
          periodEnd: new Date('2025-02-28T00:00:00.000Z'),
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
          periodStart: new Date('2025-03-01T00:00:00.000Z'),
          periodEnd: new Date('2025-03-31T00:00:00.000Z'),
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

    const admin = await prisma.user.create({
      data: { username: 'sa-export-filter', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center1.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const res = await request(app)
      .get(`/api/finance/settlements/export.csv?orgUnitId=${center1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const lines = res.text.trim().split(/\r?\n/);
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain(`,${center1.id},`);
  });

  it('enforces scope for list exports', async () => {
    const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
    const bp1 = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const bp2 = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
    const center2 = await prisma.orgUnit.create({ data: { code: 'CE2', name: 'Center2', type: 'CENTER', parentId: bp2.id } });

    await prisma.settlement.create({
      data: {
        orgUnitId: center2.id,
        periodStart: new Date('2025-04-01T00:00:00.000Z'),
        periodEnd: new Date('2025-04-30T00:00:00.000Z'),
        grossCollected: 100,
        refunds: 0,
        adjustments: 0,
        netCollected: 100,
        revenueSharePercent: 0,
        revenueShareAmount: 0,
        netPayable: 0,
        status: 'DRAFT',
      },
    });

    const bpUser = await prisma.user.create({
      data: { username: 'bp-export', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: bp1.id },
    });
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    await request(app)
      .get(`/api/finance/settlements/export.csv?orgUnitId=${center2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('exports settlement detail with warnings section and proper escaping', async () => {
    const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'Center', type: 'CENTER' } });
    const settlement = await prisma.settlement.create({
      data: {
        orgUnitId: center.id,
        periodStart: new Date('2025-05-01T00:00:00.000Z'),
        periodEnd: new Date('2025-05-31T00:00:00.000Z'),
        grossCollected: 100,
        refunds: 0,
        adjustments: 0,
        netCollected: 100,
        revenueSharePercent: 5,
        revenueShareAmount: 5,
        netPayable: 5,
        status: 'FINALIZED',
        paymentRef: 'INV "A", 2025',
        warnings: [{ code: 'MISSING_REFUNDS', message: 'Refunds data not available' }],
        breakdown: { collectionsCount: 1, duesRaised: 100, outstandingAmount: 50 },
      },
    });

    const admin = await prisma.user.create({
      data: { username: 'sa-export-detail', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: center.id },
    });
    const token = makeToken({ id: admin.id, role: admin.role, orgUnitId: admin.orgUnitId });

    const res = await request(app)
      .get(`/api/finance/settlements/${settlement.id}/export.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-disposition']).toContain('settlement_');
    expect(res.text).toContain('Warnings');
    expect(res.text).toContain('code,message');
    expect(res.text).toContain('MISSING_REFUNDS');
    expect(res.text).toContain('"INV ""A"", 2025"');
  });
});
