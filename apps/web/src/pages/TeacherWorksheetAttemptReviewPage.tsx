import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  fetchWorksheetAttemptReview,
  updateWorksheetFeedback,
  overrideWorksheetScore,
  TeacherWorksheetAttemptReview,
} from '../api/teacherWorksheetsClient';
import { useToast } from '../contexts/ToastContext';

const TeacherWorksheetAttemptReviewPage: React.FC = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<TeacherWorksheetAttemptReview | null>(null);

  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackScore, setFeedbackScore] = useState<string>('');
  const [overrideScoreValue, setOverrideScoreValue] = useState<string>('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  const totalScore = review?.attempt.totalScore ?? null;
  const maxScore = review?.attempt.maxScore ?? null;
  const percent =
    totalScore !== null && maxScore !== null && maxScore > 0
      ? Math.round((Number(totalScore) / Number(maxScore)) * 100)
      : null;
  const passLabel = percent !== null ? (percent >= 50 ? 'Passed' : 'Failed') : null;
  useEffect(() => {
    async function load() {
      try {
        if (!attemptId) throw new Error('Invalid attempt id');
        setLoading(true);
        const res = await fetchWorksheetAttemptReview(Number(attemptId));
        setReview(res);
        setFeedbackComment(res.attempt.teacherComment || '');
        const baseScore =
          res.attempt.teacherAdjustedScore !== null && res.attempt.teacherAdjustedScore !== undefined
            ? res.attempt.teacherAdjustedScore
            : res.attempt.totalScore ?? undefined;
        setFeedbackScore(baseScore !== undefined && baseScore !== null ? String(baseScore) : '');
        setOverrideScoreValue(baseScore !== undefined && baseScore !== null ? String(baseScore) : '');
        setError(null);
      } catch (err: any) {
        console.error('Failed to load worksheet review', err);
        setError(err?.message || 'Failed to load worksheet review');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [attemptId]);

  const handleSaveFeedback = async () => {
    if (!review) return;
    const parsedScore =
      feedbackScore === '' ? undefined : Number.isNaN(Number(feedbackScore)) ? undefined : Number(feedbackScore);
    try {
      setSavingFeedback(true);
      const updated = await updateWorksheetFeedback(review.attempt.id, {
        teacherComment: feedbackComment,
        teacherAdjustedScore: parsedScore,
      });
      setReview((prev) =>
        prev
          ? {
              ...prev,
              attempt: { ...prev.attempt, ...updated },
            }
          : prev
      );
      showToast('Feedback saved', 'success');
    } catch (err: any) {
      console.error('Failed to save feedback', err);
      showToast(err?.message || 'Could not save feedback', 'error');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleOverrideScore = async () => {
    if (!review) return;
    const parsed = Number(overrideScoreValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      showToast('Invalid score', 'error');
      return;
    }
    try {
      setSavingOverride(true);
      const updated = await overrideWorksheetScore(review.attempt.id, parsed);
      setReview((prev) =>
        prev
          ? {
              ...prev,
              attempt: { ...prev.attempt, ...updated },
            }
          : prev
      );
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

  if (error || !review) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.25rem' }}>
            Worksheet review
          </div>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            {error || 'Attempt not found.'}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/teacher/worksheet-attempts')}
          >
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
            {review.worksheet.title}
          </h1>
          <div className="muted">
            Student: {review.student.name} {review.student.code ? `(${review.student.code})` : ''}
          </div>
        </div>
        <div className="muted">
          Status: {review.attempt.status} · Score:{' '}
          {review.attempt.totalScore !== null && review.attempt.maxScore !== null
            ? `${review.attempt.totalScore} / ${review.attempt.maxScore}`
            : '-'}
          {passLabel ? ` · ${passLabel}` : ''}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div className="card-title">Feedback</div>
        </div>
        <div className="muted" style={{ marginBottom: '0.35rem' }}>
          Auto score: {review.attempt.totalScore ?? '-'}{' '}
          {review.attempt.maxScore ? `/ ${review.attempt.maxScore}` : ''}{' '}
          {review.attempt.teacherAdjustedScore !== null && review.attempt.teacherAdjustedScore !== undefined
            ? `· Adjusted: ${review.attempt.teacherAdjustedScore}`
            : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label className="muted">Teacher comment</label>
          <textarea
            className="form-control"
            rows={3}
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
          />
          <label className="muted">Adjusted score (optional)</label>
          <input
            type="number"
            className="form-control"
            style={{ maxWidth: '200px' }}
            value={feedbackScore}
            onChange={(e) => setFeedbackScore(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSaveFeedback} disabled={savingFeedback}>
            {savingFeedback ? 'Saving...' : 'Save feedback'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div className="card-title">Override score</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            className="form-control"
            style={{ maxWidth: '200px' }}
            value={overrideScoreValue}
            onChange={(e) => setOverrideScoreValue(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleOverrideScore} disabled={savingOverride}>
            {savingOverride ? 'Saving...' : 'Override'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Questions</div>
        </div>
        {review.questions.length === 0 ? (
          <div className="muted">No questions available. The attempt may not be fully submitted.</div>
        ) : (
          <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {review.questions.map((q) => (
              <div key={q.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                <div className="card-header">
                  <div className="card-title">
                    Q{q.orderIndex}: {q.prompt}
                  </div>
                  <span className={q.isCorrect ? 'badge badge-success' : 'badge badge-danger'}>
                    {q.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Student answer: {q.answerGiven || 'No answer'}</span>
                  <span>Correct answer: {q.correctAnswer || '-'}</span>
                  <span>
                    Marks: {q.marksAwarded ?? 0} / {q.maxMarks}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherWorksheetAttemptReviewPage;
