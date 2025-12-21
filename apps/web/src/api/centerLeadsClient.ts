import { apiClient } from '../utils/apiClient';
import { LeadSummaryResponse } from './bpLeadsClient';

export async function fetchCenterLeadSummary(): Promise<LeadSummaryResponse> {
  const res = await apiClient.get('/api/center/leads/summary');
  return res;
}
