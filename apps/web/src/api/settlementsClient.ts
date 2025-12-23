import { apiClient } from '../utils/apiClient';

export type SettlementStatus = 'DRAFT' | 'FINALIZED' | 'PAID';
export type SettlementPaymentStatus = 'UNPAID' | 'PAID';

export type SettlementWarning = {
  code: string;
  message: string;
};

export type SettlementBreakdown = {
  collectionsCount: number;
  duesRaised: number;
  outstandingAmount: number;
};

export type Settlement = {
  id: number;
  orgUnitId: number;
  periodStart: string;
  periodEnd: string;
  grossCollected: number;
  refunds: number;
  adjustments: number;
  netCollected: number;
  revenueSharePercent: number;
  revenueShareAmount: number;
  netPayable: number;
  breakdown?: SettlementBreakdown | null;
  warnings?: SettlementWarning[] | null;
  status: SettlementStatus;
  paymentStatus: SettlementPaymentStatus;
  computedAt: string;
  finalizedAt?: string | null;
  finalizedByUserId?: number | null;
  paidAt?: string | null;
  paidByUserId?: number | null;
  paymentRef?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SettlementPreview = {
  orgUnitId: number;
  periodStart: string;
  periodEnd: string;
  grossCollected: number;
  refunds: number;
  adjustments: number;
  netCollected: number;
  revenueSharePercent: number;
  revenueShareAmount: number;
  netPayable: number;
  warnings: SettlementWarning[];
  breakdown: SettlementBreakdown;
};

export type SettlementListFilters = {
  orgUnitId?: number;
  status?: SettlementStatus;
  paymentStatus?: SettlementPaymentStatus;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  offset?: number;
};

export type SettlementListResponse = {
  items: Settlement[];
  total: number;
  limit: number;
  offset: number;
};

export type SettlementPreviewPayload = {
  orgUnitId: number;
  periodStart: string;
  periodEnd: string;
  revenueSharePercent?: number;
};

export type SettlementCreatePayload = SettlementPreviewPayload;

const buildSettlementQuery = (filters: SettlementListFilters, includePagination = true) => {
  const params = new URLSearchParams();
  if (filters.orgUnitId) params.set('orgUnitId', String(filters.orgUnitId));
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.periodStart) params.set('periodStart', filters.periodStart);
  if (filters.periodEnd) params.set('periodEnd', filters.periodEnd);
  if (includePagination) {
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  }
  return params.toString();
};

export async function previewSettlement(payload: SettlementPreviewPayload): Promise<SettlementPreview> {
  const res = await apiClient.post('/api/finance/settlements/preview', payload);
  return res;
}

export async function createSettlement(payload: SettlementCreatePayload): Promise<Settlement> {
  const res = await apiClient.post('/api/finance/settlements', payload);
  return res;
}

export async function listSettlements(filters: SettlementListFilters = {}): Promise<SettlementListResponse> {
  const query = buildSettlementQuery(filters, true);
  const res = await apiClient.get(`/api/finance/settlements${query ? `?${query}` : ''}`);
  return res;
}

export const buildExportListUrl = (filters: SettlementListFilters = {}) => {
  const query = buildSettlementQuery(filters, false);
  return `/api/finance/settlements/export.csv${query ? `?${query}` : ''}`;
};

export const buildExportDetailUrl = (id: number) => `/api/finance/settlements/${id}/export.csv`;

export async function fetchSettlement(id: number): Promise<Settlement> {
  const res = await apiClient.get(`/api/finance/settlements/${id}`);
  return res;
}

export async function finalizeSettlement(id: number): Promise<Settlement> {
  const res = await apiClient.post(`/api/finance/settlements/${id}/finalize`, {});
  return res;
}

export async function markSettlementPaid(id: number, paymentRef?: string): Promise<Settlement> {
  const res = await apiClient.post(`/api/finance/settlements/${id}/mark-paid`, { paymentRef });
  return res;
}
