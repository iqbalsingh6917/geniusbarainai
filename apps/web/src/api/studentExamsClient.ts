import { apiClient } from '../utils/apiClient';

export interface StudentExamQuestion {
  id: number;
  order: number;
  type: 'MCQ' | 'NUMERIC' | string;
  text: string;
  imageUrl?: string | null;
  options: { id: number; text: string }[];
}

export interface StudentExamAttemptQuestionsResponse {
  attemptId: number;
  examId: number;
  questions: StudentExamQuestion[];
}

export interface SubmitExamPayload {
  answers: {
    questionId: number;
    numericAns?: number;
    optionIds?: number[];
  }[];
}

export interface SubmitExamResult {
  attemptId: number;
  examId: number;
  score: number;
  maxScore: number;
  percentage: number | null;
}

export async function startExamAttempt(examId: number): Promise<{ id: number }> {
  const res = await apiClient.post(`/api/student/exams/${examId}/start-attempt`, {});
  return res;
}

export async function fetchExamAttemptQuestions(
  attemptId: number
): Promise<StudentExamAttemptQuestionsResponse> {
  const res = await apiClient.get(`/api/student/exams/attempts/${attemptId}/questions`);
  return res;
}

export async function submitExamAttempt(
  attemptId: number,
  payload: SubmitExamPayload
): Promise<SubmitExamResult> {
  const res = await apiClient.post(`/api/student/exams/attempts/${attemptId}/submit`, payload);
  return res;
}
