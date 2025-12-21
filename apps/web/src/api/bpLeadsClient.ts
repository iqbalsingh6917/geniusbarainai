import { apiClient } from '../utils/apiClient';

export type LeadStageKey = 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';

export interface LeadSummaryResponse {
  totalLeads: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
}

export interface LeadListItem {
  id: number;
  firstName: string;
  lastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  orgUnitId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchBpLeadSummary(): Promise<LeadSummaryResponse> {
  const res = await apiClient.get('/api/bp/leads/summary');
  return res;
}

export async function listLeads(page = 1, pageSize = 20): Promise<LeadListResponse> {
  const res = await apiClient.get(`/api/leads?page=${page}&pageSize=${pageSize}`);
  return res;
}

export async function createLead(payload: {
  firstName: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage?: LeadStageKey;
  orgUnitId?: number;
}): Promise<LeadListItem> {
  const res = await apiClient.post('/api/leads', payload);
  return res;
}

export async function updateLead(id: number, payload: Partial<{
  firstName: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage?: LeadStageKey;
  orgUnitId?: number;
}>): Promise<LeadListItem> {
  const res = await apiClient.patch(`/api/leads/${id}`, payload);
  return res;
}
