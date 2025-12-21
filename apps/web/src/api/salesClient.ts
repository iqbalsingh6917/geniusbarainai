import { apiClient } from '../utils/apiClient';

export interface SalesFilter {
  from: string;
  to: string;
  courseCode?: string;
  groupBy?: 'BP' | 'FRANCHISE' | 'CENTER';
}

export interface LeadStageSummary {
  new: number;
  contacted: number;
  trialBooked: number;
  trialDone: number;
  converted: number;
  lost: number;
}

export interface LeadBreakdownRow extends LeadStageSummary {
  orgUnitId: number;
  orgUnitName: string;
  orgUnitType: string;
}

export async function fetchSalesSummary(filter: SalesFilter): Promise<LeadStageSummary> {
  const res = await apiClient.get('/api/superadmin/sales/summary' + buildQuery(filter));
  return res;
}

export async function fetchSalesBreakdown(filter: SalesFilter): Promise<LeadBreakdownRow[]> {
  const res = await apiClient.get('/api/superadmin/sales/breakdown' + buildQuery(filter));
  return res ?? [];
}

function buildQuery(params: Record<string, any>) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  const search = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${search}`;
}
