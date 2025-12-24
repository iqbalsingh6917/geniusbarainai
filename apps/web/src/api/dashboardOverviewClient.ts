import { apiClient } from '../utils/apiClient';

export interface LeadFunnelStats {
  totalLeads: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
}

export interface LeadConversionRate {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  contactPhone?: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  convertedToStudentId?: number;
  nextFollowUpAt?: string;
}

export interface CenterLeaderboardItem {
  centerCode: string;
  centerName: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface CenterOverview {
  leadFunnel: LeadFunnelStats;
  leadConversionRate: LeadConversionRate;
  followUpsDueToday: Lead[];
  convertedLeads: Lead[];
}

export interface FranchiseOverview {
  leadFunnel: LeadFunnelStats;
  leadConversionRate: LeadConversionRate;
  stalledLeads: Lead[];
  centerLeaderboard: CenterLeaderboardItem[];
}

export interface BpOverview {
  leadFunnel: LeadFunnelStats;
  leadConversionRate: LeadConversionRate;
}

export async function fetchCenterOverview(): Promise<CenterOverview> {
  const res = await apiClient.get('/api/dashboard/center/overview');
  return res;
}

export async function fetchFranchiseOverview(): Promise<FranchiseOverview> {
  const res = await apiClient.get('/api/dashboard/franchise/overview');
  return res;
}

export async function fetchBpOverview(): Promise<BpOverview> {
  const res = await apiClient.get('/api/dashboard/bp/overview');
  return res;
}