import { apiClient } from '../utils/apiClient';
import { LeadSummaryResponse } from './bpLeadsClient';

export async function fetchFranchiseLeadSummary(): Promise<LeadSummaryResponse> {
  const res = await apiClient.get('/api/franchise/leads/summary');
  return res;
}
