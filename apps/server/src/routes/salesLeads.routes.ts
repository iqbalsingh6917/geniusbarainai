import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { createCommissionRecord } from '../services/commissionService';
import { computeLeadAssist } from '../services/leadAssistService';

const STAGES = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'] as const;
const STAGE_ALIASES = {
  DEMO_SCHEDULED: 'TRIAL_BOOKED',
  DEMO_DONE: 'TRIAL_DONE',
  ENROLLED: 'CONVERTED',
} as const;
const STAGE_INPUTS = [...STAGES, ...Object.keys(STAGE_ALIASES)] as const;
const SOURCES = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER', 'ONLINE', 'SCHOOL'] as const;
const FOLLOW_UP_FILTERS = ['overdue', 'due_today', 'due_next_7_days', 'none'] as const;
type Stage = (typeof STAGES)[number];
type StageInput = (typeof STAGE_INPUTS)[number];
type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];
const ENROLLED_NOTE = 'Marked as enrolled';

const leadPayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    email: z.string().email().optional(),
    contactEmail: z.string().email().optional(),
    phone: z.string().optional(),
    contactPhone: z.string().optional(),
    city: z.string().trim().optional(),
    stage: z.enum(STAGE_INPUTS).default('NEW'),
    source: z.enum(SOURCES).default('OTHER'),
    orgUnitId: z.number().int().optional(),
    notes: z.string().optional(),
    assignedToUserId: z.number().int().nullable().optional(),
    nextFollowUpAt: z.string().optional(),
    lostReason: z.string().optional(),
  })
  .refine((data) => Boolean(data.name || data.firstName), {
    message: 'Name is required',
    path: ['name'],
  });

const leadUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().optional(),
  email: z.string().email().optional(),
  contactEmail: z.string().email().optional(),
  phone: z.string().optional(),
  contactPhone: z.string().optional(),
  city: z.string().trim().optional(),
  stage: z.enum(STAGE_INPUTS).optional(),
  source: z.enum(SOURCES).optional(),
  orgUnitId: z.number().int().optional(),
  notes: z.string().optional(),
  assignedToUserId: z.number().int().nullable().optional(),
  nextFollowUpAt: z.string().optional(),
  lostReason: z.string().optional(),
});

const stageTransitionSchema = z.object({
  stage: z.enum(STAGE_INPUTS),
  note: z.string().optional(),
  lostReason: z.string().optional(),
});

const assignmentSchema = z.object({
  assignedToUserId: z.number().int().nullable(),
});

const snoozeSchema = z.object({
  days: z.preprocess(
    (value) => Number(value),
    z
      .number()
      .int()
      .refine((days) => [1, 3, 7].includes(days), 'Days must be 1, 3, or 7'),
  ),
});

const router = Router();

const VALID_TRANSITIONS: Record<Stage, Stage[]> = {
  NEW: ['CONTACTED'],
  CONTACTED: ['TRIAL_BOOKED'],
  TRIAL_BOOKED: ['TRIAL_DONE'],
  TRIAL_DONE: ['CONVERTED'],
  CONVERTED: [],
  LOST: [],
};

function normalizeStage(stage: StageInput): Stage {
  return (STAGE_ALIASES as Record<string, Stage>)[stage] ?? (stage as Stage);
}

function isValidTransition(fromStage: Stage, toStage: Stage) {
  if (fromStage === toStage) return true;
  if (toStage === 'LOST') return true;
  return VALID_TRANSITIONS[fromStage]?.includes(toStage);
}

function parseOptionalDate(value?: string | null) {
  if (value === undefined) return { value: undefined as Date | null | undefined };
  if (value === null || value === '') return { value: null as Date | null };
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return { error: 'Invalid date' };
  return { value: parsed };
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function buildFollowUpWhere(filter: FollowUpFilter, now: Date) {
  const activeStages = { stage: { notIn: ['CONVERTED', 'LOST'] as Stage[] } };

  if (filter === 'none') {
    return { nextFollowUpAt: null };
  }

  if (filter === 'overdue') {
    return { ...activeStages, nextFollowUpAt: { lt: now } };
  }

  if (filter === 'due_today') {
    return { ...activeStages, nextFollowUpAt: { gte: startOfDay(now), lte: endOfDay(now) } };
  }

  return { ...activeStages, nextFollowUpAt: { gte: now, lte: addDays(now, 7) } };
}

function resolveName(input: { name?: string; firstName?: string; lastName?: string }) {
  const firstName = input.firstName ?? input.name ?? '';
  const lastName = input.lastName ?? undefined;
  return { firstName, lastName };
}

function resolveContact(input: { contactEmail?: string; email?: string; contactPhone?: string; phone?: string }) {
  return {
    contactEmail: input.contactEmail ?? input.email ?? undefined,
    contactPhone: input.contactPhone ?? input.phone ?? undefined,
  };
}

async function ensureOrgAccess(userOrgUnits: number[], targetOrgUnitId?: number) {
  if (!targetOrgUnitId) return true;
  return userOrgUnits.includes(targetOrgUnitId);
}

function stageCountsTemplate() {
  const byStage: Record<Stage, number> = {
    NEW: 0,
    CONTACTED: 0,
    TRIAL_BOOKED: 0,
    TRIAL_DONE: 0,
    CONVERTED: 0,
    LOST: 0,
  };
  return byStage;
}

async function getLeadSummary(orgUnitIds: number[]) {
  const where = orgUnitIds.length ? { orgUnitId: { in: orgUnitIds } } : {};
  const counts: Record<Stage, number> = stageCountsTemplate();

  const grouped = await prisma.lead.groupBy({
    by: ['stage'],
    _count: true,
    where,
  });

  grouped.forEach((g) => {
    const key = (g.stage || '').toUpperCase() as Stage;
    if (STAGES.includes(key)) {
      counts[key] += g._count;
    } else {
      counts.NEW += g._count;
    }
  });

  const totalLeads = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    totalLeads,
    byStage: counts,
    bySource: {}, // placeholder until source analytics added
  };
}

function buildLeadWhere(params: {
  orgUnitIds: number[];
  orgUnitId?: number;
  stage?: Stage;
  assignedToUserId?: number | null;
  search?: string;
  from?: Date;
  to?: Date;
  followUp?: FollowUpFilter;
  now?: Date;
}) {
  const where: any = {};
  const and: any[] = [];

  if (params.orgUnitId) {
    where.orgUnitId = params.orgUnitId;
  } else if (params.orgUnitIds.length) {
    where.orgUnitId = { in: params.orgUnitIds };
  }

  if (params.stage) {
    where.stage = params.stage;
  }

  if (params.assignedToUserId === null) {
    where.assignedToUserId = null;
  } else if (typeof params.assignedToUserId === 'number') {
    where.assignedToUserId = params.assignedToUserId;
  }

  if (params.search) {
    const term = params.search;
    where.OR = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { contactEmail: { contains: term, mode: 'insensitive' } },
      { contactPhone: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (params.from || params.to) {
    where.updatedAt = {};
    if (params.from) where.updatedAt.gte = params.from;
    if (params.to) where.updatedAt.lte = params.to;
  }

  if (params.followUp) {
    const now = params.now ?? new Date();
    and.push(buildFollowUpWhere(params.followUp, now));
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
}

async function getLeadMetricsSummary(params: {
  orgUnitIds: number[];
  orgUnitId?: number;
  stage?: Stage;
  assignedToUserId?: number | null;
}) {
  const baseWhere = buildLeadWhere({
    orgUnitIds: params.orgUnitIds,
    orgUnitId: params.orgUnitId,
    stage: params.stage,
    assignedToUserId: params.assignedToUserId,
  });

  const counts: Record<Stage, number> = stageCountsTemplate();
  const grouped = await prisma.lead.groupBy({
    by: ['stage'],
    _count: true,
    where: baseWhere,
  });

  grouped.forEach((g) => {
    const key = (g.stage || '').toUpperCase() as Stage;
    if (STAGES.includes(key)) {
      counts[key] += g._count;
    } else {
      counts.NEW += g._count;
    }
  });

  const totalLeads = Object.values(counts).reduce((a, b) => a + b, 0);
  const now = new Date();
  const activeStageFilter = { stage: { notIn: ['LOST', 'CONVERTED'] as Stage[] } };

  const overdueWhere = {
    ...baseWhere,
    ...activeStageFilter,
    nextFollowUpAt: { lt: now },
  };
  const dueTodayWhere = {
    ...baseWhere,
    ...activeStageFilter,
    nextFollowUpAt: { gte: startOfDay(now), lte: endOfDay(now) },
  };
  const dueNext7DaysWhere = {
    ...baseWhere,
    ...activeStageFilter,
    nextFollowUpAt: { gte: now, lte: addDays(now, 7) },
  };

  const shouldCountUnassigned =
    baseWhere.assignedToUserId === undefined || baseWhere.assignedToUserId === null;

  const [overdueCount, dueTodayCount, dueNext7DaysCount, unassignedOverdueCount] = await Promise.all([
    prisma.lead.count({ where: overdueWhere }),
    prisma.lead.count({ where: dueTodayWhere }),
    prisma.lead.count({ where: dueNext7DaysWhere }),
    shouldCountUnassigned
      ? prisma.lead.count({
          where: {
            ...baseWhere,
            ...activeStageFilter,
            assignedToUserId: null,
            nextFollowUpAt: { lt: now },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    totalLeads,
    byStage: counts,
    overdueFollowUps: overdueCount,
    overdueCount,
    dueTodayCount,
    dueNext7DaysCount,
    unassignedOverdueCount,
  };
}

async function listLeads(params: {
  orgUnitIds: number[];
  limit: number;
  offset: number;
  stage?: Stage;
  assignedToUserId?: number | null;
  search?: string;
  from?: Date;
  to?: Date;
  orgUnitId?: number;
  followUp?: FollowUpFilter;
  now?: Date;
}) {
  const where = buildLeadWhere(params);

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: params.offset,
      take: params.limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        contactEmail: true,
        contactPhone: true,
        city: true,
        source: true,
        stage: true,
        orgUnitId: true,
        createdAt: true,
        updatedAt: true,
        assignedToUserId: true,
        nextFollowUpAt: true,
        lostReason: true,
        notes: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total };
}

async function listLeadsForAssist(params: {
  orgUnitIds: number[];
  limit: number;
  offset: number;
  stage?: Stage;
  assignedToUserId?: number | null;
  search?: string;
  from?: Date;
  to?: Date;
  orgUnitId?: number;
  followUp?: FollowUpFilter;
  now?: Date;
}) {
  const where = buildLeadWhere(params);
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: params.offset,
      take: params.limit,
      select: {
        id: true,
        stage: true,
        nextFollowUpAt: true,
        assignedToUserId: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total };
}

async function logStageChange(leadId: number, actorUserId: number | undefined, fromStage: Stage | null, toStage: Stage, note?: string) {
  await prisma.leadActivity.create({
    data: {
      leadId,
      actorUserId: actorUserId ?? null,
      fromStage,
      toStage,
      note: note ?? null,
    },
  });
}

function toAssistSummary(lead: {
  id: number;
  stage: Stage | null;
  nextFollowUpAt: Date | null;
  assignedToUserId: number | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  const assist = computeLeadAssist({
    stage: lead.stage,
    nextFollowUpAt: lead.nextFollowUpAt,
    assignedToUserId: lead.assignedToUserId,
    updatedAt: lead.updatedAt,
    createdAt: lead.createdAt,
  });

  return {
    id: lead.id,
    stage: lead.stage,
    nextFollowUpAt: lead.nextFollowUpAt,
    score: assist.score,
    tier: assist.tier,
    topReason: assist.reasons[0] ?? null,
    reasons: assist.reasons.slice(0, 2),
  };
}

function parseStageFilter(stage?: string) {
  if (!stage) return { value: undefined as Stage | undefined };
  const normalized = stage.toUpperCase();
  if (!STAGE_INPUTS.includes(normalized as StageInput)) {
    return { error: 'Invalid stage filter' };
  }
  return { value: normalizeStage(normalized as StageInput) };
}

function parseFollowUpFilter(value?: string) {
  if (!value) return { value: undefined as FollowUpFilter | undefined };
  const normalized = value.toLowerCase();
  if (!FOLLOW_UP_FILTERS.includes(normalized as FollowUpFilter)) {
    return { error: 'Invalid followUp filter' };
  }
  return { value: normalized as FollowUpFilter };
}

function parseAssignedTo(value: string | undefined, userId?: number) {
  if (!value) return { value: undefined as number | null | undefined };
  const normalized = value.toLowerCase();
  if (normalized === 'me') {
    return { value: userId ?? null };
  }
  if (normalized === 'unassigned') {
    return { value: null };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { error: 'Invalid assignedTo filter' };
  }
  return { value: parsed };
}

function parsePagination(query: any) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const rawPage = Number(query.page);
  const rawPageSize = Number(query.pageSize);

  const limitCandidate = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
  const pageSizeCandidate = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : undefined;
  const limit = Math.min(100, Math.max(1, limitCandidate ?? pageSizeCandidate ?? 20));

  const offsetCandidate = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : undefined;
  const pageCandidate = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : undefined;
  const offset = offsetCandidate ?? Math.max(0, ((pageCandidate ?? 1) - 1) * limit);
  const page = Math.floor(offset / limit) + 1;

  return { limit, offset, page, pageSize: limit };
}

async function validateAssignee(assignedToUserId: number | null | undefined, allowedOrgUnits: number[]) {
  if (assignedToUserId === undefined) return { value: undefined as number | null | undefined };
  if (assignedToUserId === null) return { value: null as number | null };

  const user = await prisma.user.findUnique({
    where: { id: assignedToUserId },
    select: { id: true, orgUnitId: true },
  });

  if (!user || !user.orgUnitId) {
    return { error: 'ASSIGNEE_NOT_FOUND' };
  }

  if (!allowedOrgUnits.includes(user.orgUnitId)) {
    return { error: 'ASSIGNEE_OUT_OF_SCOPE' };
  }

  return { value: user.id };
}

const summaryHandler = (auditAction: string) =>
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);
      const summary = await getLeadSummary(allowedOrgUnits);

      await logAudit(req, {
        action: auditAction,
        entityType: 'Lead',
        meta: { role: req.user.role, orgUnitId, allowedOrgUnitsCount: allowedOrgUnits.length },
      });

      ok(res, summary);
    } catch (err) {
      console.error('Error fetching lead summary', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to load lead summary');
    }
  };

router.get(
  '/bp/leads/summary',
  requireAuth,
  requireRole(['BUSINESS_PARTNER']),
  summaryHandler('LEAD_SUMMARY_VIEWED_BP'),
);

router.get(
  '/franchise/leads/summary',
  requireAuth,
  requireRole(['FRANCHISE']),
  summaryHandler('LEAD_SUMMARY_VIEWED_FRANCHISE'),
);

  router.get(
    '/center/leads/summary',
    requireAuth,
    requireRole(['CENTER_MANAGER', 'ADMISSIONS']),
    summaryHandler('LEAD_SUMMARY_VIEWED_CENTER'),
  );

router.get(
  '/leads/metrics/summary',
  requireAuth,
  requireRole(['SUPERADMIN', 'SALES_AGENT', 'ADMISSIONS']),
);

export default router;
