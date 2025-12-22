import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { prisma } from '@lms/db';
import { createApp } from '../../src';
import { computeLeadAssist } from '../../src/services/leadAssistService';

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
  await prisma.leadActivity.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

async function seedOrgTree() {
  const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
  const bp = await prisma.orgUnit.create({ data: { code: 'BP1', name: 'BP1', type: 'BUSINESS_PARTNER', parentId: root.id } });
  const franchise = await prisma.orgUnit.create({ data: { code: 'FR1', name: 'FR1', type: 'FRANCHISE', parentId: bp.id } });
  const center = await prisma.orgUnit.create({ data: { code: 'CE1', name: 'CE1', type: 'CENTER', parentId: franchise.id } });
  const otherBp = await prisma.orgUnit.create({ data: { code: 'BP2', name: 'BP2', type: 'BUSINESS_PARTNER', parentId: root.id } });
  return { root, bp, franchise, center, otherBp };
}

async function seedUsers(orgs: ReturnType<typeof seedOrgTree>) {
  const bpUser = await prisma.user.create({
    data: { username: 'bp_leads_ai', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: orgs.bp.id },
  });
  const centerUser = await prisma.user.create({
    data: { username: 'ce_leads_ai', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: orgs.center.id },
  });
  return { bpUser, centerUser };
}

describe('Lead assist scoring', () => {
  it('scores overdue demo-done leads with expected reasons', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const followUp = new Date('2025-01-12T10:00:00Z');
    const updatedAt = new Date('2024-12-20T10:00:00Z');

    const result = computeLeadAssist({
      stage: 'TRIAL_DONE',
      nextFollowUpAt: followUp,
      assignedToUserId: null,
      updatedAt,
      createdAt: updatedAt,
    }, now);

    expect(result.tier).toBe('HOT');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons).toContain('Demo done but not enrolled');
    expect(result.reasons.some((r) => r.startsWith('Follow-up overdue by'))).toBeTruthy();
    expect(result.reasons).toContain('No assigned owner');
    expect(result.reasons).toContain('No update in 14+ days');
  });

  it('forces score to 0 for enrolled or lost leads', () => {
    const enrolled = computeLeadAssist({ stage: 'CONVERTED' });
    expect(enrolled.score).toBe(0);
    expect(enrolled.tier).toBe('COLD');
    expect(enrolled.reasons[0]).toBe('Already enrolled');

    const lost = computeLeadAssist({ stage: 'LOST' });
    expect(lost.score).toBe(0);
    expect(lost.tier).toBe('COLD');
    expect(lost.reasons[0]).toBe('Marked lost');
  });
});

describe('Lead assist endpoints', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('denies assist access for out-of-scope leads', async () => {
    const orgs = await seedOrgTree();
    const { centerUser } = await seedUsers(orgs);
    const lead = await prisma.lead.create({
      data: { firstName: 'Outside', stage: 'NEW', orgUnitId: orgs.otherBp.id },
    });
    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });

    await request(app).get(`/api/leads/${lead.id}/assist`).set('Authorization', `Bearer ${token}`).expect(404);
  });

  it('applies pagination defaults for assist summary', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    await prisma.lead.createMany({
      data: [
        { firstName: 'Lead A', stage: 'NEW', orgUnitId: orgs.bp.id },
        { firstName: 'Lead B', stage: 'CONTACTED', orgUnitId: orgs.bp.id },
      ],
    });

    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const res = await request(app).get('/api/leads/assist/summary').set('Authorization', `Bearer ${token}`).expect(200);
    const data = res.body.data ?? res.body;
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
    expect(data.items.length).toBe(2);
  });
});
