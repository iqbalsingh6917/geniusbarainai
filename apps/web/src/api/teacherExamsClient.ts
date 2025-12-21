import { apiClient } from '../utils/apiClient';

export interface TeacherExamAttemptListItem {
  id: number;
  status?: string | null;
  submittedAt?: string | null;
  startedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  exam: {
    id: number;
    title: string;
    courseCode: string;
  };
  student: {
    id: number;
    firstName: string;
    lastName: string | null;
  };
}

export interface TeacherExamAttemptDetail {
  id: number;
  status: string;
  submittedAt: string | null;
  startedAt: string | null;
  score: number | null;
  maxScore: number | null;
  exam: {
    id: number;
    title: string;
    courseCode: string;
  };
  student: {
    id: number;
    firstName: string;
    lastName: string | null;
  };
  enrollment?: {
    id: number;
    orgUnitId: number | null;
    courseId: number;
  } | null;
  answers: {
    id: number;
    questionId: number;
    numericAns: number | null;
    optionIds: number[];
    question: {
      id: number;
      order: number;
      type: string;
      text: string;
      imageUrl: string | null;
      options: {
        id: number;
        text: string;
        isCorrect: boolean;
      }[];
    };
  }[];
}

export async function listExamAttemptsForTeacher(): Promise<TeacherExamAttemptListItem[]> {
  const res = await apiClient.get('/api/teacher/exams/attempts');
  return res;
}

export async function fetchExamAttemptDetail(id: number): Promise<TeacherExamAttemptDetail> {
  const res = await apiClient.get(`/api/teacher/exams/attempts/${id}`);
  return res;
}

export async function overrideExamAttemptScore(id: number, score: number) {
  const res = await apiClient.post(`/api/teacher/exams/attempts/${id}/override-score`, { score });
  return res;
}
