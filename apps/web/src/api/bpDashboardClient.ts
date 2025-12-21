import { apiClient } from '../utils/apiClient';

export interface OrgDashboardSummary {
  totals: {
    students: number;
    enrollmentsOngoing: number;
    enrollmentsCompleted: number;
  };
  finance: {
    paymentsTotal: number;
    duesPending: number;
  };
  assessments: {
    examAttempts: number;
    worksheetAttempts: number;
    avgExamScorePercent: number | null;
    avgWorksheetScorePercent: number | null;
  };
}

export async function fetchBpDashboard(): Promise<OrgDashboardSummary> {
  const res = await apiClient.get('/api/bp/dashboard/overview');
  return res;
}
