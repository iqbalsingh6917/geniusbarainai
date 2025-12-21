import { apiClient } from '../utils/apiClient';

export type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';
export type LeadSource = 'CAMPAIGN' | 'REFERRAL' | 'WALK_IN' | 'WHATSAPP' | 'OTHER';

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
  source?: LeadSource | null;
  stage?: LeadStage | null;
  orgUnitId?: number | null;
  createdAt: string;
  updatedAt: string;
  assignedToUserId?: number | null;
  notes?: string | null;
}

export interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type LeadPayload = {
  firstName: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  source?: LeadSource;
  stage?: LeadStage;
  orgUnitId?: number;
  notes?: string;
  assignedToUserId?: number;
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

export async function listLeads(page = 1, pageSize = 20): Promise<LeadListResponse> {
  const res = await apiClient.get(`/api/leads?page=${page}&pageSize=${pageSize}`);
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

export async function updateLeadStage(id: number, payload: { stage: LeadStage; note?: string }): Promise<LeadListItem> {
  const res = await apiClient.post(`/api/leads/${id}/stage`, payload);
  return res;
}
