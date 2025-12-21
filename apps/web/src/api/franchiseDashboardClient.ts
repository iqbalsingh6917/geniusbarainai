import { apiClient } from '../utils/apiClient';
import { OrgDashboardSummary } from './bpDashboardClient';

export async function fetchFranchiseDashboard(): Promise<OrgDashboardSummary> {
  const res = await apiClient.get('/api/franchise/dashboard/overview');
  return res;
}
