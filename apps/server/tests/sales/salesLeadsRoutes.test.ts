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
  const superadmin = await prisma.user.create({
    data: { username: 'sa_leads', passwordHash: 'x', role: 'SUPERADMIN', orgUnitId: orgs.root.id },
  });
  const bpUser = await prisma.user.create({
    data: { username: 'bp_leads', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: orgs.bp.id },
  });
  const frUser = await prisma.user.create({
    data: { username: 'fr_leads', passwordHash: 'x', role: 'FRANCHISE', orgUnitId: orgs.franchise.id },
  });
  const centerUser = await prisma.user.create({
    data: { username: 'ce_leads', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: orgs.center.id },
  });
  const otherBpUser = await prisma.user.create({
    data: { username: 'bp_other', passwordHash: 'x', role: 'BUSINESS_PARTNER', orgUnitId: orgs.otherBp.id },
  });
  return { superadmin, bpUser, frUser, centerUser, otherBpUser };
}

describe('Sales leads routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('BP can create lead scoped to their org', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });

    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Lead One' })
      .expect(201);

    const data = res.body.data ?? res.body;
    expect(data.firstName).toBe('Lead One');
    expect(data.stage).toBe('NEW');
    expect(data.orgUnitId).toBe(orgs.bp.id);
  });

  it('lists leads only within scoped org units for BP/FRANCHISE/CENTER', async () => {
    const orgs = await seedOrgTree();
    const { bpUser, frUser, centerUser, otherBpUser } = await seedUsers(orgs);
    await prisma.lead.createMany({
      data: [
        { firstName: 'BP Lead', stage: 'NEW', orgUnitId: orgs.bp.id },
        { firstName: 'FR Lead', stage: 'NEW', orgUnitId: orgs.franchise.id },
        { firstName: 'Center Lead', stage: 'NEW', orgUnitId: orgs.center.id },
        { firstName: 'Other Lead', stage: 'NEW', orgUnitId: orgs.otherBp.id },
      ],
    });

    const bpToken = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const frToken = makeToken({ id: frUser.id, role: frUser.role, orgUnitId: frUser.orgUnitId });
    const ceToken = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });
    const otherBpToken = makeToken({ id: otherBpUser.id, role: otherBpUser.role, orgUnitId: otherBpUser.orgUnitId });

    const bpRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${bpToken}`).expect(200);
    const bpItems = bpRes.body.data?.items ?? bpRes.body.items ?? [];
    expect(bpItems.length).toBe(3); // bp + franchise + center

    const frRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${frToken}`).expect(200);
    const frItems = frRes.body.data?.items ?? frRes.body.items ?? [];
    expect(frItems.length).toBe(2); // franchise + center

    const ceRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${ceToken}`).expect(200);
    const ceItems = ceRes.body.data?.items ?? ceRes.body.items ?? [];
    expect(ceItems.length).toBe(1); // only center

    const otherRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${otherBpToken}`).expect(200);
    const otherItems = otherRes.body.data?.items ?? otherRes.body.items ?? [];
    expect(otherItems.length).toBe(1); // only other BP
  });

  it('updates stage and creates LeadActivity', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const lead = await prisma.lead.create({
      data: { firstName: 'Stage Lead', stage: 'NEW', orgUnitId: orgs.bp.id },
    });

    const res = await request(app)
      .patch(`/api/leads/${lead.id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'CONTACTED' })
      .expect(200);

    const updated = res.body.data ?? res.body;
    expect(updated.stage).toBe('CONTACTED');

    const activities = await prisma.leadActivity.findMany({ where: { leadId: lead.id } });
    expect(activities.length).toBe(1);
    expect(activities[0].fromStage).toBe('NEW');
    expect(activities[0].toStage).toBe('CONTACTED');
    expect(activities[0].actorUserId).toBe(bpUser.id);
  });

  it('summary returns counts per stage', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    await prisma.lead.createMany({
      data: [
        { firstName: 'L1', stage: 'NEW', orgUnitId: orgs.bp.id },
        { firstName: 'L2', stage: 'NEW', orgUnitId: orgs.bp.id },
        { firstName: 'L3', stage: 'CONTACTED', orgUnitId: orgs.bp.id },
        { firstName: 'L4', stage: 'CONVERTED', orgUnitId: orgs.bp.id },
      ],
    });

    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const res = await request(app)
      .get('/api/bp/leads/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.byStage.NEW).toBe(2);
    expect(data.byStage.CONTACTED).toBe(1);
    expect(data.byStage.CONVERTED).toBe(1);
    expect(data.totalLeads).toBe(4);
  });

  it('center cannot read or update leads outside its org scope', async () => {
    const orgs = await seedOrgTree();
    const { centerUser, otherBpUser } = await seedUsers(orgs);
    const outsideLead = await prisma.lead.create({
      data: { firstName: 'Other', stage: 'NEW', orgUnitId: orgs.otherBp.id },
    });
    const centerLead = await prisma.lead.create({
      data: { firstName: 'Mine', stage: 'NEW', orgUnitId: orgs.center.id },
    });

    const ceToken = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });

    const listRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${ceToken}`).expect(200);
    const items = listRes.body.data?.items ?? listRes.body.items ?? [];
    expect(items.find((l: any) => l.id === centerLead.id)).toBeTruthy();
    expect(items.find((l: any) => l.id === outsideLead.id)).toBeFalsy();

    await request(app)
      .patch(`/api/leads/${outsideLead.id}`)
      .set('Authorization', `Bearer ${ceToken}`)
      .send({ stage: 'CONTACTED' })
      .expect(404);

    // sanity: owner can update
    const otherToken = makeToken({ id: otherBpUser.id, role: otherBpUser.role, orgUnitId: otherBpUser.orgUnitId });
    await request(app)
      .patch(`/api/leads/${outsideLead.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ stage: 'CONTACTED' })
      .expect(200);
  });

  it('franchise cannot see sibling franchise leads', async () => {
    const orgs = await seedOrgTree();
    const { frUser } = await seedUsers(orgs);
    const siblingFr = await prisma.orgUnit.create({
      data: { code: 'FR2', name: 'FR2', type: 'FRANCHISE', parentId: orgs.bp.id },
    });
    const siblingCenter = await prisma.orgUnit.create({
      data: { code: 'CE2', name: 'CE2', type: 'CENTER', parentId: siblingFr.id },
    });

    await prisma.lead.createMany({
      data: [
        { firstName: 'Main FR', stage: 'NEW', orgUnitId: orgs.franchise.id },
        { firstName: 'Main Center', stage: 'NEW', orgUnitId: orgs.center.id },
        { firstName: 'Sibling FR', stage: 'NEW', orgUnitId: siblingFr.id },
        { firstName: 'Sibling Center', stage: 'NEW', orgUnitId: siblingCenter.id },
      ],
    });

    const frToken = makeToken({ id: frUser.id, role: frUser.role, orgUnitId: frUser.orgUnitId });
    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${frToken}`).expect(200);
    const items = res.body.data?.items ?? res.body.items ?? [];
    expect(items.find((l: any) => l.orgUnitId === siblingFr.id)).toBeFalsy();
    expect(items.find((l: any) => l.orgUnitId === siblingCenter.id)).toBeFalsy();
  });

  it('teacher is forbidden from lead endpoints', async () => {
    const orgs = await seedOrgTree();
    const teacher = await prisma.user.create({
      data: { username: 'teacher_leads', passwordHash: 'x', role: 'TEACHER', orgUnitId: orgs.center.id },
    });
    const token = makeToken({ id: teacher.id, role: teacher.role, orgUnitId: teacher.orgUnitId });
    await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('validates stage transitions and lost reason', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const lead = await prisma.lead.create({
      data: { firstName: 'Stage Check', stage: 'NEW', orgUnitId: orgs.bp.id },
    });

    await request(app)
      .post(`/api/leads/${lead.id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'TRIAL_DONE' })
      .expect(400);

    await request(app)
      .post(`/api/leads/${lead.id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'LOST' })
      .expect(400);

    const res = await request(app)
      .post(`/api/leads/${lead.id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'LOST', lostReason: 'No response' })
      .expect(200);

    const updated = res.body.data ?? res.body;
    expect(updated.stage).toBe('LOST');
    expect(updated.lostReason).toBe('No response');
  });

  it('applies pagination defaults', async () => {
    const orgs = await seedOrgTree();
    const { bpUser } = await seedUsers(orgs);
    await prisma.lead.createMany({
      data: [
        { firstName: 'Lead 1', stage: 'NEW', orgUnitId: orgs.bp.id },
        { firstName: 'Lead 2', stage: 'NEW', orgUnitId: orgs.bp.id },
      ],
    });

    const token = makeToken({ id: bpUser.id, role: bpUser.role, orgUnitId: bpUser.orgUnitId });
    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`).expect(200);
    const data = res.body.data ?? res.body;
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
  });
});
