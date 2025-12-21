import { apiClient } from '../utils/apiClient';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type AgeGroup = 'JUNIOR' | 'REGULAR' | 'SENIOR';

export interface AbacusLevel {
  id: number;
  moduleId: number | null;
  name: string;
  code: string;
  difficulty: Difficulty;
  ageGroup?: AgeGroup | null;
  operations: string[];
  formulas: string[];
  examDurationMin: number;
  maxMarks?: number | null;
  passingPercent: number;
  isActive: boolean;
}

export interface AbacusLevelPayload {
  courseId: number;
  moduleId?: number | null;
  name: string;
  code: string;
  difficulty: Difficulty;
  ageGroup?: AgeGroup;
  operations: string[];
  formulas: string[];
  examDurationMin: number;
  maxMarks?: number;
  passingPercent: number;
  isActive: boolean;
}

export async function fetchAbacusLevels(courseId: number, moduleId?: number) {
  const params: any = { courseId };
  if (moduleId) params.moduleId = moduleId;
  const res = await apiClient.get('/api/superadmin/abacus-levels' + buildQuery(params));
  return res?.data ?? res ?? [];
}

export async function createAbacusLevel(payload: AbacusLevelPayload) {
  const res = await apiClient.post('/api/superadmin/abacus-levels', payload);
  return res;
}

export async function updateAbacusLevel(id: number, payload: Partial<AbacusLevelPayload>) {
  const res = await apiClient.patch(`/api/superadmin/abacus-levels/${id}`, payload);
  return res;
}

function buildQuery(params: Record<string, any>) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null);
  if (!entries.length) return '';
  const search = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${search}`;
}
