import { apiClient } from '../utils/apiClient';

export type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';
export type LeadSource = 'CAMPAIGN' | 'REFERRAL' | 'WALK_IN' | 'WHATSAPP' | 'OTHER' | 'ONLINE' | 'SCHOOL';
export type LeadAssistTier = 'HOT' | 'WARM' | 'COLD';
export type LeadFollowUpFilter = 'overdue' | 'due_today' | 'due_next_7_days' | 'none';

export interface LeadSummary {
  totalLeads: number;
  byStage: Record<LeadStage | string, number>;
  bySource: Record<string, number>;
}

export interface LeadMetricsSummary {
  totalLeads: number;
  byStage: Record<LeadStage | string, number>;
  overdueFollowUps?: number;
  overdueCount: number;
  dueTodayCount: number;
  dueNext7DaysCount: number;
  unassignedOverdueCount: number;
}

export interface LeadListItem {
  id: number;
  firstName: string;
  lastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  city?: string | null;
  source?: LeadSource | null;
  stage?: LeadStage | null;
  orgUnitId?: number | null;
  createdAt: string;
  updatedAt: string;
  assignedToUserId?: number | null;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  lostReason?: string | null;
}

export interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  limit?: number;
  offset?: number;
}

export type LeadPayload = {
  name?: string;
  firstName: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  email?: string;
  phone?: string;
  city?: string;
  source?: LeadSource;
  stage?: LeadStage;
  orgUnitId?: number;
  notes?: string;
  assignedToUserId?: number;
  nextFollowUpAt?: string;
  lostReason?: string;
};

export interface LeadActivity {
  id: number;
  actorUserId?: number | null;
  fromStage?: LeadStage | null;
  toStage?: LeadStage | null;
  note?: string | null;
  createdAt: string;
}

export interface LeadDetail extends LeadListItem {
  activities?: LeadActivity[];
}

export interface LeadAssistResult {
  score: number;
  tier: LeadAssistTier;
  reasons: string[];
  nextAction: string;
  suggestedMessage: string;
}

export interface LeadAssistSummaryItem {
  id: number;
  stage?: LeadStage | null;
  nextFollowUpAt?: string | null;
  score: number;
  tier: LeadAssistTier;
  topReason?: string | null;
  reasons?: string[];
}

export type LeadListFilters = {
  stage?: LeadStage;
  assignedTo?: 'me' | 'unassigned' | number;
  q?: string;
  from?: string;
  to?: string;
  followUp?: LeadFollowUpFilter;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
};

const summaryPathByRole: Record<'bp' | 'franchise' | 'center', string> = {
  bp: '/api/bp/leads/summary',
  franchise: '/api/franchise/leads/summary',
  center: '/api/center/leads/summary',
};

export async function fetchLeadSummary(role: 'bp' | 'franchise' | 'center'): Promise<LeadSummary> {
  const res = await apiClient.get(summaryPathByRole[role]);
  return res;
}

export async function fetchLeadMetricsSummary(filters: Pick<LeadListFilters, 'stage' | 'assignedTo'> = {}): Promise<LeadMetricsSummary> {
  const params = new URLSearchParams();
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.assignedTo !== undefined) params.set('assignedTo', String(filters.assignedTo));
  const query = params.toString();
  const res = await apiClient.get(`/api/leads/metrics/summary${query ? `?${query}` : ''}`);
  return res;
}

export async function listLeads(filters: LeadListFilters = {}): Promise<LeadListResponse> {
  const params = new URLSearchParams();
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.assignedTo !== undefined) params.set('assignedTo', String(filters.assignedTo));
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.followUp) params.set('followUp', filters.followUp);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const res = await apiClient.get(`/api/leads${query ? `?${query}` : ''}`);
  return res;
}

export async function createLead(payload: LeadPayload): Promise<LeadListItem> {
  const res = await apiClient.post('/api/leads', payload);
  return res;
}

export async function updateLead(id: number, payload: Partial<LeadPayload>): Promise<LeadListItem> {
  const res = await apiClient.patch(`/api/leads/${id}`, payload);
  return res;
}

export async function updateLeadStage(
  id: number,
  payload: { stage: LeadStage; note?: string; lostReason?: string }
): Promise<LeadListItem> {
  const res = await apiClient.post(`/api/leads/${id}/stage`, payload);
  return res;
}

export async function fetchLead(id: number): Promise<LeadDetail> {
  const res = await apiClient.get(`/api/leads/${id}`);
  return res;
}

export async function assignLead(id: number, assignedToUserId: number | null): Promise<LeadListItem> {
  const res = await apiClient.post(`/api/leads/${id}/assign`, { assignedToUserId });
  return res;
}

export async function snoozeLead(id: number, days: 1 | 3 | 7): Promise<LeadListItem> {
  const res = await apiClient.post(`/api/leads/${id}/snooze`, { days });
  return res;
}

export async function fetchLeadAssist(id: number): Promise<LeadAssistResult> {
  const res = await apiClient.get(`/api/leads/${id}/assist`);
  return res;
}

export async function listLeadAssistSummary(filters: LeadListFilters = {}): Promise<{
  items: LeadAssistSummaryItem[];
  total: number;
  page: number;
  pageSize: number;
  limit?: number;
  offset?: number;
}> {
  const params = new URLSearchParams();
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.assignedTo !== undefined) params.set('assignedTo', String(filters.assignedTo));
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.followUp) params.set('followUp', filters.followUp);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const res = await apiClient.get(`/api/leads/assist/summary${query ? `?${query}` : ''}`);
  return res;
}

export async function convertLead(id: number, data: { 
  studentData: { 
    firstName: string; 
    lastName?: string; 
    contactEmail?: string; 
    contactPhone?: string; 
    age?: number; 
    parentName?: string; 
    parentContact?: string; 
  }; 
  enrollmentData: { 
    courseId: number; 
    startDate?: string; 
    endDate?: string; 
    currentModuleId?: number; 
    currentLevelId?: number; 
    teacherUserId?: number; 
  }; 
}): Promise<{
  lead: LeadListItem;
  student: any; // Student type would be defined elsewhere
  enrollment: any; // Enrollment type would be defined elsewhere
}> {
  const res = await apiClient.post(`/api/leads/${id}/convert`, data);
  return res;
}
