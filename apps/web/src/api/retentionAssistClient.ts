import { apiClient } from '../utils/apiClient';

export type RetentionSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type RetentionSignal = {
  code: string;
  severity: RetentionSeverity;
  title: string;
  description: string;
  evidence: Record<string, number | string | null>;
  reasons: string[];
  suggestedAction: string;
  studentId?: number;
  studentName?: string;
  draftMessageTeacherToParent?: string;
  draftMessageTeacherToStudent?: string;
};

export type RetentionSignalsResponse = {
  items: RetentionSignal[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    totalSignals: number;
    bySeverity: Record<RetentionSeverity, number>;
    byCode: Record<string, number>;
  };
};

export type StudentInsight = {
  code: string;
  title: string;
  description: string;
  suggestedAction: string;
};

export type StudentInsightsResponse = {
  windowDays: number;
  insights: StudentInsight[];
};

type AssistParams = {
  window?: number;
  limit?: number;
  offset?: number;
};

const buildParams = (params?: AssistParams) => {
  const search = new URLSearchParams();
  if (params?.window) search.set('window', String(params.window));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.offset) search.set('offset', String(params.offset));
  const query = search.toString();
  return query ? `?${query}` : '';
};

export async function fetchTeacherAssistSignals(params?: AssistParams): Promise<RetentionSignalsResponse> {
  const res = await apiClient.get(`/api/teacher/assist/signals${buildParams(params)}`);
  return res;
}

export async function fetchCenterAssistSignals(params?: AssistParams): Promise<RetentionSignalsResponse> {
  const res = await apiClient.get(`/api/center/assist/signals${buildParams(params)}`);
  return res;
}

export async function fetchStudentAssistSummary(windowDays = 14): Promise<StudentInsightsResponse> {
  const params = new URLSearchParams();
  params.set('window', String(windowDays));
  const res = await apiClient.get(`/api/student/assist/summary?${params.toString()}`);
  return res;
}
