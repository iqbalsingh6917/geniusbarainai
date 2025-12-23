import { apiClient } from '../utils/apiClient';

export type OrgUnitType = 'SUPERADMIN_ROOT' | 'BUSINESS_PARTNER' | 'FRANCHISE' | 'CENTER';
export type OrgUnitStatus = 'ACTIVE' | 'INACTIVE';

export interface OrgUnit {
  id: number;
  name: string;
  code: string;
  type: OrgUnitType;
  parentId: number | null;
  isActive: boolean;
}

export interface OrgUnitFilter {
  type?: OrgUnitType;
  parentId?: number;
}

export async function fetchOrgUnits(filter: OrgUnitFilter = {}): Promise<OrgUnit[]> {
  const params: any = {};
  if (filter.type) params.type = filter.type;
  if (typeof filter.parentId === 'number') params.parentId = filter.parentId;

  const res = await apiClient.get('/api/superadmin/org-units' + buildQuery(params));
  return res?.data ?? res ?? [];
}

export async function fetchScopedOrgUnits(): Promise<OrgUnit[]> {
  const res = await apiClient.get('/api/org/units/scoped');
  return res?.data ?? res ?? [];
}

function buildQuery(params: Record<string, any>) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null);
  if (!entries.length) return '';
  const search = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${search}`;
}

export interface OrgUnitPayload {
  name: string;
  code: string;
  type: OrgUnitType;
  parentId?: number | null;
  status: OrgUnitStatus;
}

export async function createOrgUnit(payload: OrgUnitPayload): Promise<OrgUnit> {
  const res = await apiClient.post('/api/superadmin/org-units', payload);
  return res;
}

export async function updateOrgUnit(id: number, payload: Partial<OrgUnitPayload>): Promise<OrgUnit> {
  const res = await apiClient.put(`/api/superadmin/org-units/${id}`, payload);
  return res;
}
