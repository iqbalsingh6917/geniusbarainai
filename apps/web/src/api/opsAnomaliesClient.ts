import { apiClient } from '../utils/apiClient';

export type OpsAnomalySeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type OpsAnomaly = {
  code: string;
  severity: OpsAnomalySeverity;
  title: string;
  description: string;
  evidence: Record<string, number | string>;
  suggestedAction: string;
};

export type OpsAnomalySummary = {
  anomalies: OpsAnomaly[];
  totals: {
    collectionsCurrent: number;
    outstanding: number;
    overdueCount: number;
  };
  windowDays: number;
};

export async function fetchOpsAnomalySummary(windowDays = 30): Promise<OpsAnomalySummary> {
  const params = new URLSearchParams();
  params.set('window', String(windowDays));
  const res = await apiClient.get(`/api/ops/anomalies/summary?${params.toString()}`);
  return res;
}
