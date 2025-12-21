import { apiClient } from '../utils/apiClient';

export interface DateRangeFilter {
  from: string;
  to: string;
  courseCode?: string;
}

export interface PerformanceReport {
  leadFunnel: {
    new: number;
    contacted: number;
    trialBooked: number;
    trialDone: number;
    converted: number;
    lost: number;
  };
  enrollments: {
    total: number;
    active: number;
    completed: number;
  };
}

export interface FinanceReport {
  totalCollected: number;
  totalDues: number;
  totalRefunds?: number;
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}

export async function fetchPerformanceReport(filter: DateRangeFilter): Promise<PerformanceReport> {
  const res = await apiClient.get('/api/reports/performance' + buildQuery(filter));
  return res;
}

export async function fetchFinanceReport(filter: DateRangeFilter): Promise<FinanceReport> {
  const res = await apiClient.get('/api/reports/finance' + buildQuery(filter));
  return res;
}

export async function fetchFinanceTimeseries(filter: DateRangeFilter): Promise<TimeseriesPoint[]> {
  const res = await apiClient.get('/api/reports/timeseries' + buildQuery({ ...filter, metric: 'revenue' } as any));
  return res ?? [];
}

function buildQuery(params: Record<string, any>) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  const search = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${search}`;
}
