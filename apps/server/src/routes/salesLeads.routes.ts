import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';

const STAGES = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'] as const;
const SOURCES = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER'] as const;
type Stage = (typeof STAGES)[number];

const leadPayloadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  stage: z.enum(STAGES).default('NEW'),
  source: z.enum(SOURCES).default('OTHER'),
  orgUnitId: z.number().int().optional(),
  notes: z.string().optional(),
  assignedToUserId: z.number().int().optional(),
});

const leadUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  stage: z.enum(STAGES).optional(),
  source: z.enum(SOURCES).optional(),
  orgUnitId: z.number().int().optional(),
  notes: z.string().optional(),
  assignedToUserId: z.number().int().optional(),
});

const stageTransitionSchema = z.object({
  stage: z.enum(STAGES),
  note: z.string().optional(),
});

const router = Router();

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

async function listLeads(orgUnitIds: number[], page: number, pageSize: number) {
  const where = orgUnitIds.length ? { orgUnitId: { in: orgUnitIds } } : {};
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        contactEmail: true,
        contactPhone: true,
        source: true,
        stage: true,
        orgUnitId: true,
        createdAt: true,
        updatedAt: true,
        assignedToUserId: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, page, pageSize };
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

const summaryHandler = (role: 'BUSINESS_PARTNER' | 'FRANCHISE' | 'CENTER_MANAGER', auditAction: string) =>
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(role, orgUnitId);
      const summary = await getLeadSummary(allowedOrgUnits);

      await logAudit(req, {
        action: auditAction,
        entityType: 'Lead',
        meta: { role, orgUnitId, allowedOrgUnitsCount: allowedOrgUnits.length },
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
  summaryHandler('BUSINESS_PARTNER', 'LEAD_SUMMARY_VIEWED_BP'),
);

router.get(
  '/franchise/leads/summary',
  requireAuth,
  requireRole(['FRANCHISE']),
  summaryHandler('FRANCHISE', 'LEAD_SUMMARY_VIEWED_FRANCHISE'),
);

router.get(
  '/center/leads/summary',
  requireAuth,
  requireRole(['CENTER_MANAGER']),
  summaryHandler('CENTER_MANAGER', 'LEAD_SUMMARY_VIEWED_CENTER'),
);

router.get(
  '/leads',
  requireAuth,
  requireRole(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER']),
  async (req: any, res: any) => {
    try {
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId);
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

      const data = await listLeads(allowedOrgUnits, page, pageSize);
      ok(res, data);
    } catch (err) {
      console.error('Error listing leads', err);
      fail(res, 500, 'INTERNAL_ERROR', 'Unable to list leads');
    }
  },
);

router.post(
  '/leads',
  requireAuth,
  requireRole(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER']),
  async (req: any, res: any) => {
    try {
      const parsed = leadPayloadSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId);
      const targetOrgUnitId = parsed.orgUnitId ?? orgUnitId;

      if (!targetOrgUnitId || !(await ensureOrgAccess(allowedOrgUnits, targetOrgUnitId))) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const now = new Date();
      const created = await prisma.lead.create({
        data: {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          contactEmail: parsed.contactEmail,
          contactPhone: parsed.contactPhone,
          stage: parsed.stage,
          source: parsed.source,
          orgUnitId: targetOrgUnitId,
          createdByUserId: req.user?.id,
          assignedToUserId: parsed.assignedToUserId ?? null,
          notes: parsed.notes,
          lastStageChangedAt: now,
          lastStageChangedBy: req.user?.id ?? null,
        },
      });

      await logStageChange(created.id, req.user?.id, null, parsed.stage);

      await logAudit(req, {
        action: 'LEAD_CREATED',
        entityType: 'Lead',
        entityId: created.id,
        meta: { orgUnitId: targetOrgUnitId, stage: parsed.stage, source: parsed.source },
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
  requireRole(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');

      const parsed = leadUpdateSchema.parse(req.body);
      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId);

      const existing = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      if (parsed.orgUnitId && !(await ensureOrgAccess(allowedOrgUnits, parsed.orgUnitId))) {
        return fail(res, 403, 'ACCESS_DENIED', 'Org unit not allowed');
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          firstName: parsed.firstName ?? existing.firstName,
          lastName: parsed.lastName ?? existing.lastName,
          contactEmail: parsed.contactEmail ?? existing.contactEmail,
          contactPhone: parsed.contactPhone ?? existing.contactPhone,
          stage: parsed.stage ?? existing.stage,
          source: parsed.source ?? existing.source,
          orgUnitId: parsed.orgUnitId ?? existing.orgUnitId,
          notes: parsed.notes ?? existing.notes,
          assignedToUserId: parsed.assignedToUserId ?? existing.assignedToUserId,
          lastStageChangedAt: parsed.stage && parsed.stage !== existing.stage ? new Date() : existing.lastStageChangedAt,
          lastStageChangedBy: parsed.stage && parsed.stage !== existing.stage ? req.user?.id ?? null : existing.lastStageChangedBy,
        },
      });

      if (parsed.stage && parsed.stage !== existing.stage) {
        await logStageChange(updated.id, req.user?.id, existing.stage as Stage, parsed.stage);
      }

      await logAudit(req, {
        action: parsed.stage && parsed.stage !== existing.stage ? 'LEAD_STAGE_CHANGED' : 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: updated.id,
        meta: { prevStage: existing.stage, newStage: updated.stage },
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

router.patch(
  '/leads/:id/stage',
  requireAuth,
  requireRole(['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER']),
  async (req: any, res: any) => {
    try {
      const leadId = Number(req.params.id);
      if (!leadId) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
      const parsed = stageTransitionSchema.parse(req.body);

      const orgUnitId = req.user?.orgUnitId ?? undefined;
      const allowedOrgUnits = await getAllowedOrgUnitsForUser(req.user.role, orgUnitId);

      const existing = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!existing || !(await ensureOrgAccess(allowedOrgUnits, existing.orgUnitId ?? undefined))) {
        return fail(res, 404, 'NOT_FOUND', 'Lead not found');
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          stage: parsed.stage,
          lastStageChangedAt: new Date(),
          lastStageChangedBy: req.user?.id ?? null,
        },
      });

      await logStageChange(updated.id, req.user?.id, existing.stage as Stage, parsed.stage, parsed.note);

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
  },
);

export default router;
