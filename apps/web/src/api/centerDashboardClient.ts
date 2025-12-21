import { apiClient } from '../utils/apiClient';
import { OrgDashboardSummary } from './bpDashboardClient';

export async function fetchCenterDashboard(): Promise<OrgDashboardSummary> {
  const res = await apiClient.get('/api/center/dashboard/overview');
  return res;
}
