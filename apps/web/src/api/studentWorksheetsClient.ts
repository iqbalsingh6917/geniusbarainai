import { apiClient } from '../utils/apiClient';

export interface WorksheetOption {
  id: number;
  text: string;
}

export interface WorksheetQuestion {
  id: number;
  orderIndex: number;
  questionType: string;
  prompt: string;
  imageUrl?: string | null;
  maxMarks?: number | null;
  options?: WorksheetOption[];
}

export interface WorksheetMeta {
  id: number;
  title: string;
  courseCode?: string;
  courseName?: string;
}

export interface StartAttemptResponse {
  attempt: {
    id: number;
    status: string;
    startedAt?: string | null;
  };
  worksheet: WorksheetMeta;
  questions: WorksheetQuestion[];
}

export interface AttemptQuestionsResponse {
  attemptId: number;
  worksheetId: number;
  questions: WorksheetQuestion[];
  answers: {
    questionId: number;
    answerGiven?: string | null;
    numericAns?: number | null;
    textAns?: string | null;
    optionIds?: number[];
  }[];
}

export interface SubmitAttemptPayload {
  answers: {
    questionId: number;
    numericAns?: number;
    textAns?: string;
    optionIds?: number[];
    answerGiven?: string;
  }[];
}

export interface SubmitAttemptResponse {
  attempt: {
    id: number;
    status: string;
    submittedAt?: string | null;
    totalScore?: number | null;
    maxScore?: number | null;
  };
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  questions: Array<{
    questionId: number;
    orderIndex: number;
    prompt: string;
    correctAnswer: string | null;
    answerGiven: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  }>;
}

export async function startWorksheetAttempt(worksheetId: number): Promise<StartAttemptResponse> {
  const res = await apiClient.post(`/api/student/worksheets/${worksheetId}/start-attempt`, {});
  return res;
}

export async function getWorksheetAttemptQuestions(
  attemptId: number
): Promise<AttemptQuestionsResponse> {
  const res = await apiClient.get(`/api/student/worksheets/attempts/${attemptId}/questions`);
  return res;
}

export async function submitWorksheetAttempt(
  attemptId: number,
  payload: SubmitAttemptPayload
): Promise<SubmitAttemptResponse> {
  const res = await apiClient.post(`/api/student/worksheets/attempts/${attemptId}/submit`, payload);
  return res;
}
