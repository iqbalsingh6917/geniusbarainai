import { apiClient } from '../utils/apiClient';

export interface AbacusCourse {
  id: number;
  code: string;
  name: string;
  variant: string;
  description?: string | null;
  modules?: AbacusModule[];
}

export interface AbacusModule {
  id: number;
  courseId: number;
  index: number;
  title: string;
  summary?: string | null;
  skillFocus?: string | null;
  levelCount?: number;
}

export interface AbacusCoursePayload {
  code: string;
  name: string;
  variant: string;
  description?: string | null;
}

export interface AbacusModulePayload {
  index: number;
  title: string;
  summary?: string | null;
  skillFocus?: string | null;
}

export async function listCourses(): Promise<AbacusCourse[]> {
  const res = await apiClient.get('/superadmin/abacus/courses');
  return res ?? [];
}

export async function listModules(courseId: number): Promise<AbacusModule[]> {
  const res = await apiClient.get(`/superadmin/abacus/courses/${courseId}/modules`);
  return res ?? [];
}

export async function createCourse(payload: AbacusCoursePayload): Promise<AbacusCourse> {
  const res = await apiClient.post('/superadmin/abacus/courses', payload);
  return res;
}

export async function updateCourse(id: number, payload: Partial<AbacusCoursePayload>): Promise<AbacusCourse> {
  const res = await apiClient.patch(`/superadmin/abacus/courses/${id}`, payload);
  return res;
}

export async function createModule(courseId: number, payload: AbacusModulePayload): Promise<AbacusModule> {
  const res = await apiClient.post(`/superadmin/abacus/courses/${courseId}/modules`, payload);
  return res;
}

export async function updateModule(moduleId: number, payload: Partial<AbacusModulePayload>): Promise<AbacusModule> {
  const res = await apiClient.patch(`/superadmin/abacus/courses/modules/${moduleId}`, payload);
  return res;
}
