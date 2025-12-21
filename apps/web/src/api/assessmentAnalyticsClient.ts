import { apiClient } from '../utils/apiClient';

export interface AssessmentBucketSummary {
  totalAttempts: number;
  completedAttempts: number;
  avgScorePercent: number | null;
  passRatePercent: number | null;
}

export interface AssessmentAnalyticsSummary {
  exam: AssessmentBucketSummary;
  worksheet: AssessmentBucketSummary;
}

export async function fetchSuperadminAssessmentSummary() {
  const res = await apiClient.get('/api/superadmin/analytics/assessments/summary');
  return res?.data ?? res;
}

export async function fetchTeacherAssessmentSummary() {
  const res = await apiClient.get('/api/teacher/analytics/assessments/summary');
  return res?.data ?? res;
}
