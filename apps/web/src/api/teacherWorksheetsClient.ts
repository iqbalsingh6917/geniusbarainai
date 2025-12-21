import { apiClient } from '../utils/apiClient';

export interface TeacherWorksheetQuestionReview {
  id: number;
  orderIndex: number;
  prompt: string;
  correctAnswer: string;
  answerGiven: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  maxMarks: number;
}

export interface TeacherWorksheetAttemptReview {
  attempt: {
    id: number;
    status: string;
    totalScore: number | null;
    maxScore: number | null;
    autoGraded: boolean;
    teacherComment: string | null;
    teacherAdjustedScore: number | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  };
  worksheet: {
    id: number;
    title: string;
    [key: string]: any;
  };
  student: {
    id: number;
    code: string | null;
    name: string;
  };
  assignment: any;
  questions: TeacherWorksheetQuestionReview[];
}

export async function fetchWorksheetAttemptReview(
  attemptId: number
): Promise<TeacherWorksheetAttemptReview> {
  const res = await apiClient.get(`/api/teacher/worksheets/review/attempts/${attemptId}`);
  return res;
}

export async function updateWorksheetFeedback(
  attemptId: number,
  payload: { teacherComment?: string; teacherAdjustedScore?: number }
) {
  const res = await apiClient.put(
    `/api/teacher/worksheets/review/attempts/${attemptId}/feedback`,
    payload
  );
  return res;
}

export async function overrideWorksheetScore(attemptId: number, score: number) {
  const res = await apiClient.post(
    `/api/teacher/worksheets/review/attempts/${attemptId}/override-score`,
    { score }
  );
  return res;
}
