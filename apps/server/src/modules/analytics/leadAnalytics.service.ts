import { prisma } from '@lms/db';
import { getAllowedOrgUnitsForUser } from '../../services/orgScopeEngine';

const KNOWN_STAGES = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'] as const;
const KNOWN_SOURCES = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER', 'ONLINE', 'SCHOOL'] as const;

export type LeadFunnelStats = {
  totalLeads: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
};

interface LeadAnalyticsParams {
  bpOrgUnitId: number;
  from?: Date;
  to?: Date;
}

interface LeadFunnelByScopeParams {
  allowedOrgUnits: number[];
  from?: Date;
  to?: Date;
}

export async function getLeadFunnelForBusinessPartner(
  params: LeadAnalyticsParams
): Promise<LeadFunnelStats> {
  const { bpOrgUnitId, from, to } = params;

  const where: any = {
    orgUnitId: bpOrgUnitId,
  };

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      stage: true,
      source: true,
    },
  });

  const byStage: Record<string, number> = {};
  KNOWN_STAGES.forEach((s) => (byStage[s] = 0));

  const bySource: Record<string, number> = {};
  KNOWN_SOURCES.forEach((s) => (bySource[s] = 0));

  for (const lead of leads) {
    const stageKey = (lead.stage || 'NEW').toUpperCase();
    if (KNOWN_STAGES.includes(stageKey as any)) {
      byStage[stageKey] += 1;
    } else {
      byStage.OTHER_STAGE = (byStage.OTHER_STAGE || 0) + 1;
    }
    const sourceKey = (lead.source || 'OTHER').toUpperCase();
    const normalizedSource = KNOWN_SOURCES.includes(sourceKey as any) ? sourceKey : 'OTHER';
    bySource[normalizedSource] = (bySource[normalizedSource] || 0) + 1;
  }

  return {
    totalLeads: leads.length,
    byStage,
    bySource,
  };
}

export async function getLeadFunnelForScope(
  params: LeadFunnelByScopeParams
): Promise<LeadFunnelStats> {
  const { allowedOrgUnits, from, to } = params;

  const where: any = {
    orgUnitId: {
      in: allowedOrgUnits,
    },
  };

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      stage: true,
      source: true,
    },
  });

  const byStage: Record<string, number> = {};
  KNOWN_STAGES.forEach((s) => (byStage[s] = 0));

  const bySource: Record<string, number> = {};
  KNOWN_SOURCES.forEach((s) => (bySource[s] = 0));

  for (const lead of leads) {
    const stageKey = (lead.stage || 'NEW').toUpperCase();
    if (KNOWN_STAGES.includes(stageKey as any)) {
      byStage[stageKey] += 1;
    } else {
      byStage.OTHER_STAGE = (byStage.OTHER_STAGE || 0) + 1;
    }
    const sourceKey = (lead.source || 'OTHER').toUpperCase();
    const normalizedSource = KNOWN_SOURCES.includes(sourceKey as any) ? sourceKey : 'OTHER';
    bySource[normalizedSource] = (bySource[normalizedSource] || 0) + 1;
  }

  return {
    totalLeads: leads.length,
    byStage,
    bySource,
  };
}

export async function getStalledLeadsForScope(allowedOrgUnits: number[], daysThreshold: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  return await prisma.lead.findMany({
    where: {
      orgUnitId: {
        in: allowedOrgUnits,
      },
      updatedAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contactPhone: true,
      stage: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'asc',
    },
    take: 50, // Limit to 50 records
  });
}

export async function getConvertedLeadsForScope(allowedOrgUnits: number[], from?: Date, to?: Date) {
  const where: any = {
    orgUnitId: {
      in: allowedOrgUnits,
    },
    stage: 'CONVERTED',
  };

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  return await prisma.lead.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contactPhone: true,
      createdAt: true,
      convertedToStudentId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getFollowUpsDueTodayForScope(allowedOrgUnits: number[]) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.lead.findMany({
    where: {
      orgUnitId: {
        in: allowedOrgUnits,
      },
      nextFollowUpAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contactPhone: true,
      nextFollowUpAt: true,
      stage: true,
    },
    orderBy: {
      nextFollowUpAt: 'asc',
    },
  });
}

export async function getLeadConversionRateForScope(allowedOrgUnits: number[]) {
  const leads = await prisma.lead.findMany({
    where: {
      orgUnitId: {
        in: allowedOrgUnits,
      },
    },
    select: {
      stage: true,
    },
  });

  const totalLeads = leads.length;
  const convertedLeads = leads.filter(lead => lead.stage === 'CONVERTED').length;
  
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  
  return {
    totalLeads,
    convertedLeads,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
  };
}