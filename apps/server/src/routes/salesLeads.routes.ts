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
    requireRole(['CENTER_MANAGER', 'COORDINATOR']),
    summaryHandler('LEAD_SUMMARY_VIEWED_CENTER'),
  );

router.get(
  '/leads/metrics/summary',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);
      const orgUnitFilter = req.query.orgUnitId ? Number(req.query.orgUnitId) : undefined;

      if (orgUnitFilter && !allowedOrgUnits.includes(orgUnitFilter)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const stageResult = parseStageFilter(req.query.stage as string | undefined);
      if (stageResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', stageResult.error);
      }

      const assignedResult = parseAssignedTo(req.query.assignedTo as string | undefined, req.user?.id);
      if (assignedResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', assignedResult.error);
      }

      const summary = await getLeadMetricsSummary({
        orgUnitIds: allowedOrgUnits,
        orgUnitId: orgUnitFilter,
        stage: stageResult.value,
        assignedToUserId: assignedResult.value,
      });
      await logAudit(req, {
        action: 'LEAD_METRICS_VIEWED',
        entityType: 'Lead',
        meta: { orgUnitId: orgUnitFilter ?? orgUnitId ?? null },
      });
      ok(res, summary);
    } catch (err) {
      console.error('Error fetching lead metrics summary', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to load lead metrics');
    }
  },
);

router.get(
  '/leads/assist/summary',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);
      const { limit, offset, page, pageSize } = parsePagination(req.query);

      const stageResult = parseStageFilter(req.query.stage as string | undefined);
      if (stageResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', stageResult.error);
      }

      const assignedResult = parseAssignedTo(req.query.assignedTo as string | undefined, req.user?.id);
      if (assignedResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', assignedResult.error);
      }

      const followUpResult = parseFollowUpFilter(req.query.followUp as string | undefined);
      if (followUpResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', followUpResult.error);
      }

      const orgUnitFilter = req.query.orgUnitId ? Number(req.query.orgUnitId) : undefined;
      if (orgUnitFilter && !allowedOrgUnits.includes(orgUnitFilter)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
      const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
      const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
      const fromParsed = parseOptionalDate(fromRaw);
      const toParsed = parseOptionalDate(toRaw);

      if (fromParsed.error || toParsed.error) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date range');
      }

      const now = new Date();
      const data = await listLeadsForAssist({
        orgUnitIds: allowedOrgUnits,
        orgUnitId: orgUnitFilter,
        limit,
        offset,
        stage: stageResult.value,
        assignedToUserId: assignedResult.value,
        search,
        from: fromParsed.value ?? undefined,
        to: toParsed.value ?? undefined,
        followUp: followUpResult.value,
        now,
      });

      const items = data.items.map(toAssistSummary);

      ok(res, {
        items,
        total: data.total,
        page,
        pageSize,
        limit,
        offset,
      });
    } catch (err) {
      console.error('Error fetching lead assist summary', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to load lead assist summary');
    }
  },
);

router.get(
  '/leads/:id/assist',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          stage: true,
          nextFollowUpAt: true,
          assignedToUserId: true,
          updatedAt: true,
          createdAt: true,
          orgUnitId: true,
        },
      });

      if (!lead || !(await ensureOrgAccess(allowedOrgUnits, lead.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      const assist = computeLeadAssist({
        stage: lead.stage,
        nextFollowUpAt: lead.nextFollowUpAt,
        assignedToUserId: lead.assignedToUserId,
        updatedAt: lead.updatedAt,
        createdAt: lead.createdAt,
      });

      ok(res, assist);
    } catch (err) {
      console.error('Error fetching lead assist', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to load lead assist');
    }
  },
);

router.get(
  '/leads',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);
      const { limit, offset, page, pageSize } = parsePagination(req.query);

      const stageResult = parseStageFilter(req.query.stage as string | undefined);
      if (stageResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', stageResult.error);
      }

      const assignedResult = parseAssignedTo(req.query.assignedTo as string | undefined, req.user?.id);
      if (assignedResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', assignedResult.error);
      }

      const followUpResult = parseFollowUpFilter(req.query.followUp as string | undefined);
      if (followUpResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', followUpResult.error);
      }

      const orgUnitFilter = req.query.orgUnitId ? Number(req.query.orgUnitId) : undefined;
      if (orgUnitFilter && !allowedOrgUnits.includes(orgUnitFilter)) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
      const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
      const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
      const fromParsed = parseOptionalDate(fromRaw);
      const toParsed = parseOptionalDate(toRaw);

      if (fromParsed.error || toParsed.error) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid date range');
      }

      const now = new Date();
      const data = await listLeads({
        orgUnitIds: allowedOrgUnits,
        orgUnitId: orgUnitFilter,
        limit,
        offset,
        stage: stageResult.value,
        assignedToUserId: assignedResult.value,
        search,
        from: fromParsed.value ?? undefined,
        to: toParsed.value ?? undefined,
        followUp: followUpResult.value,
        now,
      });

      ok(res, { ...data, page, pageSize, limit, offset });
    } catch (err) {
      console.error('Error listing leads', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to list leads');
    }
  },
);

router.get(
  '/leads/:id',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
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
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              actorUserId: true,
              fromStage: true,
              toStage: true,
              note: true,
              createdAt: true,
            },
          },
        },
      });

      if (!lead || !(await ensureOrgAccess(allowedOrgUnits, lead.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      await logAudit(req, {
        action: 'LEAD_VIEWED',
        entityType: 'Lead',
        entityId: lead.id,
      });

      ok(res, lead);
    } catch (err) {
      console.error('Error fetching lead', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to load lead');
    }
  },
);

router.post(
  '/leads/:id/assign',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const parsed = assignmentSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      const existing = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      const assignee = await validateAssignee(parsed.assignedToUserId, allowedOrgUnits);
      if (assignee.error) {
        const status = assignee.error === 'ASSIGNEE_OUT_OF_SCOPE' ? 403 : 400;
        return fail(res, status, assignee.error, 'Assigned user not allowed');
      }

      if (assignee.value === existing.assignedToUserId) {
        return ok(res, existing);
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { assignedToUserId: assignee.value ?? null },
      });

      await logAudit(req, {
        action: assignee.value ? 'LEAD_ASSIGNED' : 'LEAD_UNASSIGNED',
        entityType: 'Lead',
        entityId: updated.id,
        meta: {
          prevAssignedToUserId: existing.assignedToUserId ?? null,
          newAssignedToUserId: updated.assignedToUserId ?? null,
        },
      });

      ok(res, updated);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid assignment payload', err.errors);
      }
      console.error('Error assigning lead', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to assign lead');
    }
  },
);

router.post(
  '/leads/:id/snooze',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const parsed = snoozeSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      const existing = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      if (existing.stage === 'CONVERTED' || existing.stage === 'LOST') {
        return fail(res, 400, 'LEAD_NOT_SNOOZABLE', 'Cannot snooze enrolled or lost leads');
      }

      const now = new Date();
      const base = existing.nextFollowUpAt && existing.nextFollowUpAt > now ? existing.nextFollowUpAt : now;
      const nextFollowUpAt = addDays(base, parsed.days);

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { nextFollowUpAt },
      });

      await logAudit(req, {
        action: 'LEAD_FOLLOWUP_SNOOZED',
        entityType: 'Lead',
        entityId: updated.id,
        meta: {
          prevNextFollowUpAt: existing.nextFollowUpAt?.toISOString() ?? null,
          nextFollowUpAt: nextFollowUpAt.toISOString(),
          days: parsed.days,
        },
      });

      ok(res, updated);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid snooze payload', err.errors);
      }
      console.error('Error snoozing lead follow-up', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to snooze follow-up');
    }
  },
);

router.post(
  '/leads',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const parsed = leadPayloadSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);
      const targetOrgUnitId = parsed.orgUnitId ?? orgUnitId;

      if (!targetOrgUnitId || !(await ensureOrgAccess(allowedOrgUnits, targetOrgUnitId))) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const normalizedStage = normalizeStage(parsed.stage);
      if (normalizedStage === 'LOST' && !parsed.lostReason) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Lost reason is required when stage is LOST');
      }

      const followUpResult = parseOptionalDate(parsed.nextFollowUpAt ?? undefined);
      if (followUpResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid nextFollowUpAt value');
      }

      const { firstName, lastName } = resolveName(parsed);
      const { contactEmail, contactPhone } = resolveContact(parsed);
      const assignee = await validateAssignee(parsed.assignedToUserId, allowedOrgUnits);
      if (assignee.error) {
        const status = assignee.error === 'ASSIGNEE_OUT_OF_SCOPE' ? 403 : 400;
        return fail(res, status, assignee.error, 'Assigned user not allowed');
      }

      const now = new Date();
      const created = await prisma.lead.create({
        data: {
          firstName,
          lastName,
          contactEmail,
          contactPhone,
          city: parsed.city ?? null,
          stage: normalizedStage,
          source: parsed.source,
          orgUnitId: targetOrgUnitId,
          createdByUserId: req.user?.id,
          assignedToUserId: assignee.value ?? null,
          notes: parsed.notes ?? null,
          lostReason: normalizedStage === 'LOST' ? parsed.lostReason ?? null : null,
          nextFollowUpAt: followUpResult.value ?? null,
          lastStageChangedAt: now,
          lastStageChangedBy: req.user?.id ?? null,
        },
      });

      await logStageChange(created.id, req.user?.id, null, normalizedStage);

      try {
        // Commission is issued on lead creation to keep a deterministic, idempotent trigger.
        if (targetOrgUnitId) {
          await createCommissionRecord({
            orgUnitId: targetOrgUnitId,
            type: 'LEAD',
            entityType: 'LEAD',
            entityId: created.id,
            meta: { stage: normalizedStage, source: parsed.source, createdByUserId: req.user?.id ?? null },
          });
        }
      } catch (err) {
        console.error('Failed to create lead commission record', err);
      }

      await logAudit(req, {
        action: 'LEAD_CREATED',
        entityType: 'Lead',
        entityId: created.id,
        meta: { orgUnitId: targetOrgUnitId, stage: normalizedStage, source: parsed.source, assignedToUserId: assignee.value ?? null },
      });

      ok(res, created, 201);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead payload', err.errors);
      }
      console.error('Error creating lead', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to create lead');
    }
  },
);

router.patch(
  '/leads/:id',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const parsed = leadUpdateSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      const existing = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      if (parsed.orgUnitId && !(await ensureOrgAccess(allowedOrgUnits, parsed.orgUnitId))) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const normalizedStage = parsed.stage ? normalizeStage(parsed.stage) : undefined;
      if (normalizedStage && !isValidTransition(existing.stage as Stage, normalizedStage)) {
        return fail(res, 400, 'INVALID_STAGE_TRANSITION', 'Invalid stage transition');
      }

      if (normalizedStage === 'LOST' && !parsed.lostReason) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Lost reason is required when stage is LOST');
      }

      const followUpResult = parsed.nextFollowUpAt !== undefined ? parseOptionalDate(parsed.nextFollowUpAt) : { value: undefined };
      if (followUpResult.error) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid nextFollowUpAt value');
      }

      const assignee = await validateAssignee(parsed.assignedToUserId, allowedOrgUnits);
      if (assignee.error) {
        const status = assignee.error === 'ASSIGNEE_OUT_OF_SCOPE' ? 403 : 400;
        return fail(res, status, assignee.error, 'Assigned user not allowed');
      }

      const { contactEmail, contactPhone } = resolveContact(parsed);
      const nextFirstName = parsed.firstName ?? parsed.name ?? existing.firstName;
      const nextLastName = parsed.lastName !== undefined ? parsed.lastName : existing.lastName;
      const nextAssignedToUserId = assignee.value !== undefined ? assignee.value : existing.assignedToUserId;
      const stageChanged = normalizedStage && normalizedStage !== existing.stage;
      const nextStage = normalizedStage ?? (existing.stage as Stage);
      const nextFollowUpAt = followUpResult.value !== undefined ? followUpResult.value : existing.nextFollowUpAt;
      const nextLostReason =
        normalizedStage === 'LOST'
          ? parsed.lostReason ?? existing.lostReason ?? null
          : parsed.lostReason !== undefined
            ? parsed.lostReason
            : existing.lostReason ?? null;

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          firstName: nextFirstName,
          lastName: nextLastName,
          contactEmail: contactEmail ?? existing.contactEmail,
          contactPhone: contactPhone ?? existing.contactPhone,
          city: parsed.city !== undefined ? parsed.city : existing.city,
          stage: nextStage,
          source: parsed.source ?? existing.source,
          orgUnitId: parsed.orgUnitId ?? existing.orgUnitId,
          notes: parsed.notes ?? existing.notes,
          assignedToUserId: nextAssignedToUserId ?? null,
          lostReason: nextLostReason,
          nextFollowUpAt: nextFollowUpAt ?? null,
          lastStageChangedAt: stageChanged ? new Date() : existing.lastStageChangedAt,
          lastStageChangedBy: stageChanged ? req.user?.id ?? null : existing.lastStageChangedBy,
        },
      });

      if (stageChanged) {
        const note = nextStage === 'CONVERTED' ? ENROLLED_NOTE : undefined;
        await logStageChange(updated.id, req.user?.id, existing.stage as Stage, nextStage, note);
      }

      const updatedFields = Object.entries(parsed)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);

      await logAudit(req, {
        action: stageChanged ? 'LEAD_STAGE_CHANGED' : 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: updated.id,
        meta: {
          prevStage: existing.stage,
          newStage: updated.stage,
          prevAssignedToUserId: existing.assignedToUserId ?? null,
          newAssignedToUserId: updated.assignedToUserId ?? null,
          updatedFields,
        },
      });

      ok(res, updated);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead payload', err.errors);
      }
      console.error('Error updating lead', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to update lead');
    }
  },
);

const stageTransitionHandler = async (req: any, res: any) => {
  try {
    const leadId = Number(req.params.id);
    if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
    const parsed = stageTransitionSchema.parse(req.body);

    const orgUnitId = req.user?.orgUnitId ?? undefined;
    const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

    const existing = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
      return fail(res, 404, 'NOT_FOUND', 'Lead not found');
    }

    const nextStage = normalizeStage(parsed.stage);
    if (!isValidTransition(existing.stage as Stage, nextStage)) {
      return fail(res, 400, 'INVALID_STAGE_TRANSITION', 'Invalid stage transition');
    }

    if (nextStage === 'LOST' && !parsed.lostReason) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Lost reason is required when stage is LOST');
    }

    const stageChanged = nextStage !== existing.stage;
    const updateData: any = {};

    if (stageChanged) {
      updateData.stage = nextStage;
      updateData.lastStageChangedAt = new Date();
      updateData.lastStageChangedBy = req.user?.id ?? null;
      if (nextStage === 'LOST') {
        updateData.lostReason = parsed.lostReason ?? existing.lostReason ?? null;
      }
    } else if (nextStage === 'LOST' && parsed.lostReason) {
      updateData.lostReason = parsed.lostReason;
    }

    if (Object.keys(updateData).length === 0) {
      return ok(res, existing);
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    if (stageChanged) {
      const note = parsed.note ?? (nextStage === 'CONVERTED' ? ENROLLED_NOTE : undefined);
      await logStageChange(updated.id, req.user?.id, existing.stage as Stage, nextStage, note);
    }

    await logAudit(req, {
      action: 'LEAD_STAGE_CHANGED',
      entityType: 'Lead',
      entityId: updated.id,
      meta: { prevStage: existing.stage, newStage: updated.stage },
    });

    ok(res, updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead payload', err.errors);
    }
    console.error('Error updating lead stage', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to update lead stage');
  }
};

router.post(
  '/leads/:id/stage',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  stageTransitionHandler,
);

router.patch(
  '/leads/:id/stage',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  stageTransitionHandler,
);

// POST /api/leads/:id/convert
// Convert a lead to a student/enrollment
router.post(
  '/leads/:id/convert',
  requireAuth,
  requireRole(['SUPERADMIN', 'BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'COORDINATOR']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const { studentData, enrollmentData } = req.body;
      
      // Validate the request body
      if (!studentData || !enrollmentData) {
        return fail(res, 400, 'VALIDATION_ERROR', 'studentData and enrollmentData are required');
      }

      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId, req.user.id);

      // Find the lead
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || !(await ensureOrgAccess(allowedOrgUnits, lead.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      // Check if lead is already converted
      if (lead.stage === 'CONVERTED') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Lead is already converted');
      }

      // Validate student data
      if (!studentData.firstName) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Student firstName is required');
      }

      // Validate enrollment data
      if (!enrollmentData.courseId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Course ID is required for enrollment');
      }

      // Create student from lead data
      const student = await prisma.student.create({
        data: {
          code: `STU${Date.now()}`, // Generate student code
          firstName: studentData.firstName,
          lastName: studentData.lastName || lead.lastName || '',
          contactEmail: studentData.contactEmail || lead.contactEmail || null,
          contactPhone: studentData.contactPhone || lead.contactPhone || null,
          orgUnitId: lead.orgUnitId,
          status: 'ACTIVE',
          age: studentData.age || null,
          parentName: studentData.parentName || null,
        },
      });

      // Create enrollment
      const enrollment = await prisma.abacusEnrollment.create({
        data: {
          studentId: student.id,
          courseId: enrollmentData.courseId,
          orgUnitId: lead.orgUnitId,
          status: 'ONGOING',
          startDate: new Date(enrollmentData.startDate || new Date()),
          endDate: enrollmentData.endDate ? new Date(enrollmentData.endDate) : null,
          currentModuleId: enrollmentData.currentModuleId || null,
          currentLevelId: enrollmentData.currentLevelId || null,
        },
      });

      // Update lead stage to CONVERTED
      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          stage: 'CONVERTED',
          convertedToStudentId: student.id, // Link the lead to the student
        },
      });

      const fullLead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Log the stage change
      await logStageChange(updatedLead.id, req.user?.id, lead.stage as Stage, 'CONVERTED', 'Lead converted to student enrollment');

      // Log audit
      await logAudit(req, {
        action: 'LEAD_CONVERTED',
        entityType: 'Lead',
        entityId: updatedLead.id,
        meta: { 
          studentId: student.id,
          enrollmentId: enrollment.id,
          orgUnitId: lead.orgUnitId 
        },
      });

      ok(res, {
        lead: fullLead,
        student,
        enrollment,
      });
    } catch (err: any) {
      console.error('Error converting lead', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to convert lead');
    }
  },
);

export default router;
