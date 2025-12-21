import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { apiClient } from '../utils/apiClient';
import { useToast } from '../contexts/ToastContext';

interface WorksheetContext {
  id: number;
  title: string;
  kind?: string;
  level?: { id: number; name: string; order: number } | null;
  module?: { id: number; name: string; index: number } | null;
  course?: { id: number; code: string; name: string } | null;
}

interface AttemptQuestion {
  id: number;
  orderIndex: number;
  prompt: string;
  maxMarks: number;
  correctAnswer?: string | null;
  answerGiven?: string;
  isCorrect?: boolean | null;
  marksAwarded?: number | null;
}

interface AttemptPayload {
  attempt: {
    id: number;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
    startedAt?: string;
    submittedAt?: string | null;
    totalScore?: number | null;
    maxScore?: number | null;
  };
  teacherComment?: string | null;
  teacherAdjustedScore?: number | null;
  reviewedAt?: string | null;
  worksheet: WorksheetContext | null;
  questions: AttemptQuestion[];
  totalScore?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
}

const statusBadgeClass = (status: string) => {
  if (status === 'SUBMITTED' || status === 'GRADED') return 'badge badge-success';
  if (status === 'IN_PROGRESS') return 'badge badge-warning';
  return 'badge badge-neutral';
};

const StudentWorksheetAttemptPage: React.FC = () => {
  const { attemptId } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttempt = async () => {
    if (!attemptId) return;
    try {
      setLoading(true);
      const resp: AttemptPayload = await apiClient.get(
        `/api/student/me/worksheet-attempts/${attemptId}`
      );
      setData({
        ...resp,
        totalScore: resp.totalScore ?? resp.attempt.totalScore ?? null,
        maxScore: resp.maxScore ?? resp.attempt.maxScore ?? null,
      });
      const initialAnswers: Record<number, string> = {};
      resp.questions.forEach((q) => {
        initialAnswers[q.id] = q.answerGiven ?? '';
      });
      setAnswers(initialAnswers);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load attempt', err);
      setError(err?.message || 'Unable to load worksheet attempt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const percentage = useMemo(() => {
    const max = data?.maxScore ?? data?.attempt.maxScore ?? 0;
    const total = data?.totalScore ?? data?.attempt.totalScore ?? 0;
    if (!max || max <= 0) return null;
    return Math.round((total / max) * 100);
  }, [data]);

  const finalScore = useMemo(() => {
    if (!data) return null;
    if (data.teacherAdjustedScore !== null && data.teacherAdjustedScore !== undefined) {
      return data.teacherAdjustedScore;
    }
    return data.totalScore ?? data.attempt.totalScore ?? null;
  }, [data]);

  const buildAnswerPayload = () => {
    if (!data) return [];
    return data.questions.map((q) => ({
      questionId: q.id,
      answerGiven: answers[q.id] ?? '',
    }));
  };

  const handleSave = async () => {
    if (!attemptId || !data) return;
    try {
      setSaving(true);
      const payloadAnswers = buildAnswerPayload();
      await apiClient.post(`/api/student/me/worksheet-attempts/${attemptId}/save`, {
        answers: payloadAnswers,
      });
      showToast('Progress saved', 'success');
    } catch (err: any) {
      console.error('Failed to save answers', err);
      showToast(err?.message || 'Could not save answers', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || !data) return;
    try {
      setSubmitting(true);
      const payloadAnswers = buildAnswerPayload();
      await apiClient.post(`/api/student/me/worksheet-attempts/${attemptId}/save`, {
        answers: payloadAnswers,
      });
      const resp: AttemptPayload = await apiClient.post(
        `/api/student/me/worksheet-attempts/${attemptId}/submit`,
        {}
      );
      setData(resp);
      const updatedAnswers: Record<number, string> = {};
      resp.questions.forEach((q) => {
        updatedAnswers[q.id] = q.answerGiven ?? '';
      });
      setAnswers(updatedAnswers);
      showToast('Worksheet submitted', 'success');
    } catch (err: any) {
      console.error('Failed to submit attempt', err);
      showToast(err?.message || 'Could not submit worksheet', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center' }}>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.25rem' }}>
            Worksheet attempt
          </div>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            {error || 'Attempt not found.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/worksheets')}>
            Back to worksheets
          </button>
        </div>
      </div>
    );
  }

  const isSubmitted = data.attempt.status !== 'IN_PROGRESS';

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.2rem' }}>
            {data.worksheet?.title || 'Worksheet Attempt'}
          </h1>
          <div className="muted">
            {data.worksheet?.course?.name || data.worksheet?.course?.code || ''}
            {data.worksheet?.module
              ? ` - Module ${data.worksheet.module.index}: ${data.worksheet.module.name}`
              : ''}
            {data.worksheet?.level ? ` - Level ${data.worksheet.level.order}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={statusBadgeClass(data.attempt.status)}>{data.attempt.status}</span>
          {data.reviewedAt && <span className="badge badge-success">Reviewed</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/worksheets')}>
            Back
          </button>
        </div>
      </div>

      {isSubmitted && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Score</div>
              <div>
                {finalScore ?? 0} / {data.maxScore ?? data.attempt.maxScore ?? 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="muted">Percentage</div>
              <div>{percentage !== null ? `${percentage}%` : '-'}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Submitted</div>
              <div>
                {data.attempt.submittedAt
                  ? new Date(data.attempt.submittedAt).toLocaleString()
                  : '-'}
              </div>
            </div>
            <div className="stat-card">
              <div className="muted">Teacher review</div>
              <div>{data.reviewedAt ? new Date(data.reviewedAt).toLocaleString() : 'Pending'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {isSubmitted && (
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <div className="card-header">
              <div className="card-title">Teacher feedback</div>
            </div>
            <div className="muted">
              {data.teacherComment ? data.teacherComment : 'No teacher comments yet.'}
            </div>
            {data.teacherAdjustedScore !== null && data.teacherAdjustedScore !== undefined && (
              <div className="muted" style={{ marginTop: '0.35rem' }}>
                Adjusted score: {data.teacherAdjustedScore}
              </div>
            )}
            <div className="muted" style={{ marginTop: '0.35rem' }}>
              Improvement tips: Focus on careful reading, double-check calculations, and pace yourself.
            </div>
          </div>
        )}
        <div className="card-header">
          <div className="card-title">Questions</div>
          {!isSubmitted && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save progress'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit worksheet'}
              </button>
            </div>
          )}
        </div>

        {data.questions.length === 0 ? (
          <div className="muted">No questions found for this worksheet.</div>
        ) : (
          <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.questions.map((question) => {
              const currentAnswer = answers[question.id] ?? '';
              const isCorrect = question.isCorrect;
              return (
                <div key={question.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">
                        Q{question.orderIndex}: {question.prompt}
                      </div>
                      <div className="muted">Marks: {question.maxMarks}</div>
                    </div>
                    {isSubmitted && (
                      <span
                        className={isCorrect ? 'badge badge-success' : 'badge badge-danger'}
                      >
                        {isCorrect ? 'Correct' : 'Wrong'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={currentAnswer}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
                      disabled={isSubmitted}
                      placeholder="Enter your numeric answer"
                    />
                    {isSubmitted && (
                      <div className="muted" style={{ display: 'flex', gap: '0.75rem' }}>
                        <span>Correct answer: {question.correctAnswer ?? '-'}</span>
                        <span>
                          Marks: {question.marksAwarded ?? 0} / {question.maxMarks}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isSubmitted && data.questions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save progress'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit worksheet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentWorksheetAttemptPage;
