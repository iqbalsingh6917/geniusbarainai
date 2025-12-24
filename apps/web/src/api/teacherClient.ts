import { apiClient } from '../utils/apiClient';

// Types for teacher data
export interface TeacherWorksheet {
  id: number;
  title: string;
  kind: string;
  difficultyBand: string | null;
  questionCount: number | null;
  levelName: string;
  levelOrder: number;
  moduleTitle: string;
  moduleIndex: number;
  courseCode: string;
  courseName: string;
  assignedCount: number;
  completedCount: number;
}

export interface TeacherExam {
  id: number;
  title: string;
  description: string | null;
  durationMins: number | null;
  maxScore: number | null;
  passingScore: number | null;
  assignedCount: number;
  submittedCount: number;
}

export interface TeacherSubmission {
  id: number;
  type: string;
  studentName: string;
  studentCode: string | null;
  title: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  teacherAdjustedScore: number | null;
  teacherComment: string | null;
  reviewedAt: string | null;
}

export interface GradeSubmissionPayload {
  score: number;
  maxScore?: number;
  remarks?: string;
}

// API functions for teacher tooling
export const fetchTeacherWorksheets = async (): Promise<TeacherWorksheet[]> => {
  const response = await apiClient.get('/api/teacher/worksheets');
  return response.data;
};

export const fetchTeacherExams = async (): Promise<TeacherExam[]> => {
  const response = await apiClient.get('/api/teacher/exams');
  return response.data;
};

export const fetchTeacherSubmissions = async (
  type?: 'worksheet' | 'exam' | 'all',
  status?: 'pending' | 'graded' | 'all'
): Promise<TeacherSubmission[]> => {
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  
  const response = await apiClient.get(`/api/teacher/submissions?${params.toString()}`);
  return response.data;
};

export const gradeSubmission = async (
  submissionId: number,
  payload: GradeSubmissionPayload
): Promise<{ message: string; submission: any; type: string }> => {
  const response = await apiClient.post(`/api/teacher/submissions/${submissionId}/grade`, payload);
  return response.data;
};