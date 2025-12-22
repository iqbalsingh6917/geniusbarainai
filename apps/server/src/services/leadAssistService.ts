type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';
type LeadSource = 'CAMPAIGN' | 'REFERRAL' | 'WALK_IN' | 'WHATSAPP' | 'OTHER' | 'ONLINE' | 'SCHOOL';

export type LeadAssistTier = 'HOT' | 'WARM' | 'COLD';
export type LeadAssistResult = {
  score: number;
  tier: LeadAssistTier;
  reasons: string[];
  nextAction: string;
  suggestedMessage: string;
};

export type LeadAssistInput = {
  stage: LeadStage | null;
  source?: LeadSource | null;
  assignedToUserId?: number | null;
  nextFollowUpAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  lastStageChangedAt?: Date | string | null;
};

const SCORE_RULES = {
  overdue: {
    oneToTwoDays: 15,
    threeToSevenDays: 25,
    overSevenDays: 35,
  },
  stageWeights: {
    NEW: 10,
    CONTACTED: 15,
    TRIAL_BOOKED: 20,
    TRIAL_DONE: 30,
  },
  unassigned: 10,
  recentUpdate: 10,
  stale: 10,
};

const TIER_THRESHOLDS = {
  HOT: 70,
  WARM: 40,
};

const MAX_REASONS = 6;

const stageReasonMap: Record<Exclude<LeadStage, 'CONVERTED' | 'LOST'>, string> = {
  NEW: 'New lead',
  CONTACTED: 'Contacted lead',
  TRIAL_BOOKED: 'Demo scheduled',
  TRIAL_DONE: 'Demo done but not enrolled',
};

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const diffDays = (from: Date, to: Date) => Math.floor((from.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));

function buildSuggestion(stage: LeadStage, isOverdue: boolean, isAssigned: boolean) {
  let nextAction = 'Follow up';
  let suggestedMessage = 'Follow up to answer any questions and keep the conversation moving.';

  if (stage === 'LOST') {
    nextAction = 'Close as lost';
    suggestedMessage = 'Lead is marked lost. No further action required.';
  } else if (stage === 'CONVERTED') {
    nextAction = 'Follow up';
    suggestedMessage = 'Confirm enrollment details and next steps with the parent.';
  } else if (stage === 'NEW') {
    nextAction = 'Call';
    suggestedMessage = 'Hi, thanks for your interest. When is a good time to talk?';
  } else if (stage === 'CONTACTED') {
    nextAction = isOverdue ? 'Follow up' : 'Schedule demo';
    suggestedMessage = isOverdue
      ? 'Following up on your interest in the program.'
      : 'Would you like to schedule a demo session?';
  } else if (stage === 'TRIAL_BOOKED') {
    nextAction = isOverdue ? 'Follow up' : 'WhatsApp';
    suggestedMessage = isOverdue
      ? 'Checking in about the scheduled demo.'
      : 'Sharing demo details and a quick reminder.';
  } else if (stage === 'TRIAL_DONE') {
    nextAction = 'Follow up';
    suggestedMessage = 'Thank you for attending the demo. Would you like to enroll?';
  }

  if (!isAssigned && stage !== 'LOST' && stage !== 'CONVERTED') {
    suggestedMessage = 'Assign an owner before contacting the lead.';
  }

  return { nextAction, suggestedMessage };
}

export function computeLeadAssist(input: LeadAssistInput, now: Date = new Date()): LeadAssistResult {
  const stage = (input.stage ?? 'NEW') as LeadStage;

  if (stage === 'CONVERTED') {
    return {
      score: 0,
      tier: 'COLD',
      reasons: ['Already enrolled'],
      nextAction: 'Follow up',
      suggestedMessage: 'Confirm enrollment details and next steps with the parent.',
    };
  }

  if (stage === 'LOST') {
    return {
      score: 0,
      tier: 'COLD',
      reasons: ['Marked lost'],
      nextAction: 'Close as lost',
      suggestedMessage: 'Lead is marked lost. No further action required.',
    };
  }

  let score = 0;
  const reasons: string[] = [];

  const stageReason = stageReasonMap[stage as keyof typeof stageReasonMap];
  if (stageReason) {
    score += SCORE_RULES.stageWeights[stage as keyof typeof SCORE_RULES.stageWeights] || 0;
    reasons.push(stageReason);
  }

  const followUpAt = toDate(input.nextFollowUpAt);
  const updatedAt = toDate(input.updatedAt) ?? toDate(input.createdAt);
  const overdueDays = followUpAt ? diffDays(now, followUpAt) : 0;
  const isOverdue = overdueDays > 0;

  if (isOverdue) {
    if (overdueDays <= 2) {
      score += SCORE_RULES.overdue.oneToTwoDays;
    } else if (overdueDays <= 7) {
      score += SCORE_RULES.overdue.threeToSevenDays;
    } else {
      score += SCORE_RULES.overdue.overSevenDays;
    }
    reasons.push(`Follow-up overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`);
  }

  const isAssigned = Boolean(input.assignedToUserId);
  if (!isAssigned) {
    score += SCORE_RULES.unassigned;
    reasons.push('No assigned owner');
  }

  if (updatedAt) {
    const daysSinceUpdate = diffDays(now, updatedAt);
    if (daysSinceUpdate <= 2) {
      score += SCORE_RULES.recentUpdate;
      reasons.push('Updated in last 48h');
    } else if (daysSinceUpdate > 14) {
      score += SCORE_RULES.stale;
      reasons.push('No update in 14+ days');
    }
  }

  score = Math.min(100, score);
  const tier: LeadAssistTier = score >= TIER_THRESHOLDS.HOT ? 'HOT' : score >= TIER_THRESHOLDS.WARM ? 'WARM' : 'COLD';

  const { nextAction, suggestedMessage } = buildSuggestion(stage, isOverdue, isAssigned);
  return {
    score,
    tier,
    reasons: reasons.slice(0, MAX_REASONS),
    nextAction,
    suggestedMessage,
  };
}

export const leadAssistRules = {
  SCORE_RULES,
  TIER_THRESHOLDS,
};
