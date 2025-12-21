import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  fetchExamAttemptDetail,
  overrideExamAttemptScore,
  TeacherExamAttemptDetail,
} from '../api/teacherExamsClient';
import { useToast } from '../contexts/ToastContext';

const TeacherExamAttemptDetailPage: React.FC = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<TeacherExamAttemptDetail | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState(false);

  const adjustedScore = (attempt as any)?.teacherAdjustedScore ?? null;

  useEffect(() => {
    async function load() {
      try {
        if (!attemptId) throw new Error('Invalid attempt id');
        setLoading(true);
        const res = await fetchExamAttemptDetail(Number(attemptId));
        setAttempt(res);
        setOverrideValue(res.score !== null && res.score !== undefined ? String(res.score) : '');
        setError(null);
      } catch (err: any) {
        console.error('Failed to load exam attempt detail', err);
        setError(err?.message || 'Failed to load exam attempt');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [attemptId]);

  const percent = useMemo(() => {
    if (!attempt) return null;
    if (!attempt.maxScore || attempt.score === null || attempt.score === undefined) return null;
    return Math.round((attempt.score / attempt.maxScore) * 100);
  }, [attempt]);

  const passLabel = useMemo(() => {
    if (percent === null) return null;
    return percent >= 50 ? 'Passed' : 'Failed';
  }, [percent]);

  const correctOptionText = (question: any) => {
    if (!question?.options) return '';
    return question.options.filter((o: any) => o.isCorrect).map((o: any) => o.text).join(', ');
  };

  const selectedOptionText = (question: any, optionIds: number[]) => {
    if (!question?.options) return '';
    const selected = question.options.filter((o: any) => optionIds.includes(o.id));
    return selected.map((o: any) => o.text).join(', ');
  };

  const handleOverride = async () => {
    if (!attempt) return;
    const parsed = Number(overrideValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      showToast('Invalid score value', 'error');
      return;
    }
    try {
      setSavingOverride(true);
      const updated = await overrideExamAttemptScore(attempt.id, parsed);
      setAttempt((prev) => (prev ? { ...prev, ...updated } : updated));
      showToast('Score overridden', 'success');
    } catch (err: any) {
      console.error('Failed to override score', err);
      showToast(err?.message || 'Could not override score', 'error');
    } finally {
      setSavingOverride(false);
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

  if (error || !attempt) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.25rem' }}>
            Exam attempt
          </div>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            {error || 'Attempt not found.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/teacher/exams/attempts')}>
            Back to attempts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.2rem' }}>
            {attempt.exam.title}
          </h1>
          <div className="muted">
            {attempt.exam.courseCode} - Student: {attempt.student.firstName} {attempt.student.lastName || ''}
          </div>
        </div>
        <div className="muted">
          Status: {attempt.status} - Submitted:{' '}
          {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-'}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="muted">Score</div>
            <div>
              {attempt.score ?? '-'} / {attempt.maxScore ?? '-'}
            </div>
          </div>
          <div className="stat-card">
            <div className="muted">Percentage</div>
            <div>{percent !== null ? `${percent}%` : '-'}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Result</div>
            <div>{passLabel ?? '-'}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Started</div>
            <div>{attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : '-'}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Submitted</div>
            <div>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div className="card-title">Override score</div>
        </div>
        {adjustedScore !== null && (
          <div className="muted" style={{ marginBottom: '0.35rem' }}>
            Auto score: {attempt?.score ?? '-'} {attempt?.maxScore ? `/ ${attempt.maxScore}` : ''} -
            Adjusted by teacher: {adjustedScore}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            className="form-control"
            style={{ maxWidth: '160px' }}
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleOverride} disabled={savingOverride}>
            {savingOverride ? 'Saving...' : 'Save override'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Answers</div>
        </div>
        {attempt.answers.length === 0 ? (
          <div className="muted">No answers recorded. The attempt may not have been submitted.</div>
        ) : (
          <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {attempt.answers.map((ans, idx) => {
              const q = ans.question;
              const correctText = correctOptionText(q);
              const selectedText = selectedOptionText(q, ans.optionIds || []);
              return (
                <div key={ans.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                  <div className="card-header">
                    <div className="card-title">
                      Q{q.order ?? idx + 1}: {q.text}
                    </div>
                    <div className="muted">{q.type === 'MCQ' ? 'Multiple choice' : 'Numeric'}</div>
                  </div>
                  {q.imageUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img src={q.imageUrl} alt="Exam question" style={{ maxWidth: '100%' }} />
                    </div>
                  )}
                  <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {q.type === 'MCQ' ? (
                      <>
                        <span>Selected: {selectedText || 'No answer'}</span>
                        <span>Correct: {correctText || '-'}</span>
                      </>
                    ) : (
                      <>
                        <span>Student answer: {ans.numericAns !== null ? ans.numericAns : 'No answer'}</span>
                        <span>Expected: {correctText || '-'}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherExamAttemptDetailPage;

