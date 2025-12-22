import { apiClient } from '../utils/apiClient';

export type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';
export type LeadSource = 'CAMPAIGN' | 'REFERRAL' | 'WALK_IN' | 'WHATSAPP' | 'OTHER' | 'ONLINE' | 'SCHOOL';

export interface LeadSummary {
  totalLeads: number;
  byStage: Record<LeadStage | string, number>;
  bySource: Record<string, number>;
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

export type LeadListFilters = {
  stage?: LeadStage;
  assignedTo?: 'me' | 'unassigned' | number;
  q?: string;
  from?: string;
  to?: string;
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

export async function listLeads(filters: LeadListFilters = {}): Promise<LeadListResponse> {
  const params = new URLSearchParams();
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.assignedTo !== undefined) params.set('assignedTo', String(filters.assignedTo));
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
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
