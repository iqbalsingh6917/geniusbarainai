import { apiClient } from '../utils/apiClient';

// Types for coordinator data
export type CoordinatorCenter = {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  parentName: string | null;
};

export type CoordinatorTeacher = {
  id: number;
  username: string;
  orgUnitId: number;
  centerName: string;
};

export type CoordinatorStudent = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  orgUnitId: number;
  centerName: string;
  enrollmentCount: number;
};

export type CoordinatorAttendanceSummary = {
  centerName: string;
  totalStudents: number;
  recentAttendanceCount: number;
};

export type CoordinatorProgressSummary = {
  centerName: string;
  totalStudents: number;
  avgProgressPercent: number;
};

// API functions for coordinator workflows
export const fetchCoordinatorCenters = async (): Promise<CoordinatorCenter[]> => {
  const response = await apiClient.get('/api/coordinator/centers');
  return response.data;
};

export const fetchCoordinatorTeachers = async (): Promise<CoordinatorTeacher[]> => {
  const response = await apiClient.get('/api/coordinator/teachers');
  return response.data;
};

export const fetchCoordinatorStudents = async (): Promise<CoordinatorStudent[]> => {
  const response = await apiClient.get('/api/coordinator/students');
  return response.data;
};

export const fetchCoordinatorAttendanceSummary = async (): Promise<CoordinatorAttendanceSummary[]> => {
  const response = await apiClient.get('/api/coordinator/attendance-summary');
  return response.data;
};

export const fetchCoordinatorProgressSummary = async (): Promise<CoordinatorProgressSummary[]> => {
  const response = await apiClient.get('/api/coordinator/progress-summary');
  return response.data;
};

// Functions for flagging issues
export interface FlagAttendanceIssueParams {
  studentId: number;
  date: string;
  issueType: string;
  description: string;
}

export interface FlagProgressIssueParams {
  studentId: number;
  enrollmentId: number;
  issueType: string;
  description: string;
}

export const flagAttendanceIssue = async (params: FlagAttendanceIssueParams): Promise<void> => {
  await apiClient.post('/api/coordinator/flag-attendance-issue', params);
};

export const flagProgressIssue = async (params: FlagProgressIssueParams): Promise<void> => {
  await apiClient.post('/api/coordinator/flag-progress-issue', params);
};
