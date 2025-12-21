import { prisma } from '@lms/db';

const KNOWN_STAGES = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'] as const;
const KNOWN_SOURCES = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER'] as const;

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
