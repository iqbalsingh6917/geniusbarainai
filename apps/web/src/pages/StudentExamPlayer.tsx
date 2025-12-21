import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import {
  fetchExamAttemptQuestions,
  startExamAttempt,
  submitExamAttempt,
  StudentExamQuestion,
  SubmitExamPayload,
  SubmitExamResult,
} from '../api/studentExamsClient';

type AnswerState = {
  numericAns?: string;
  optionIds?: Set<number>;
};

const StudentExamPlayer: React.FC = () => {
  const { examId: examIdParam, attemptId: attemptIdParam } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examId, setExamId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<StudentExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [submittedResult, setSubmittedResult] = useState<SubmitExamResult | null>(null);

  const isSubmitted = submittedResult !== null;

  const initializeAnswers = (qs: StudentExamQuestion[]) => {
    const initial: Record<number, AnswerState> = {};
    qs.forEach((q) => {
      initial[q.id] = { optionIds: new Set<number>() };
    });
    setAnswers(initial);
  };

  const loadByExamId = async (id: number) => {
    const startRes = await startExamAttempt(id);
    const aid = startRes.id;
    const qRes = await fetchExamAttemptQuestions(aid);
    setAttemptId(aid);
    setExamId(qRes.examId);
    setQuestions(qRes.questions || []);
    initializeAnswers(qRes.questions || []);
  };

  const loadByAttemptId = async (id: number) => {
    const qRes = await fetchExamAttemptQuestions(id);
    setAttemptId(qRes.attemptId);
    setExamId(qRes.examId);
    setQuestions(qRes.questions || []);
    initializeAnswers(qRes.questions || []);
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        if (attemptIdParam) {
          const aid = Number(attemptIdParam);
          if (!aid) throw new Error('Invalid attempt id');
          await loadByAttemptId(aid);
        } else if (examIdParam) {
          const eid = Number(examIdParam);
          if (!eid) throw new Error('Invalid exam id');
          await loadByExamId(eid);
        } else {
          throw new Error('No exam or attempt specified');
        }
      } catch (err: any) {
        console.error('Failed to load exam', err);
        setError(err?.message || 'Unable to load exam');
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examIdParam, attemptIdParam]);

  const handleNumericChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || { optionIds: new Set<number>() }), numericAns: value },
    }));
  };

  const handleOptionToggle = (questionId: number, optionId: number) => {
    setAnswers((prev) => {
      const current = prev[questionId]?.optionIds ?? new Set<number>();
      const nextSet = new Set(current);
      if (nextSet.has(optionId)) {
        nextSet.delete(optionId);
      } else {
        nextSet.add(optionId);
      }
      return { ...prev, [questionId]: { ...(prev[questionId] || {}), optionIds: nextSet } };
    });
  };

  const buildSubmitPayload = (): SubmitExamPayload => {
    return {
      answers: questions.map((q) => {
        const ans = answers[q.id] || { optionIds: new Set<number>() };
        const optionIds = Array.from(ans.optionIds ?? []);
        const numericVal =
          ans.numericAns !== undefined && ans.numericAns !== ''
            ? Number(ans.numericAns)
            : undefined;
        const numericAns =
          numericVal !== undefined && !Number.isNaN(numericVal) ? numericVal : undefined;

        return {
          questionId: q.id,
          numericAns,
          optionIds,
        };
      }),
    };
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    // basic client-side validation: ensure each question has some answer and numerics are valid
    for (const q of questions) {
      const ans = answers[q.id];
      if (q.type === 'NUMERIC') {
        const val = ans?.numericAns;
        if (val !== undefined && val !== '') {
          const numVal = Number(val);
          if (Number.isNaN(numVal)) {
            showToast('Please enter a valid number for numeric questions', 'error');
            return;
          }
        } else {
          showToast('Please answer all questions before submitting', 'error');
          return;
        }
      }
      if (q.type === 'MCQ') {
        const selected = Array.from(ans?.optionIds ?? []);
        if (selected.length === 0) {
          showToast('Please select at least one option for each question', 'error');
          return;
        }
      }
    }
    try {
      setSubmitting(true);
      const payload = buildSubmitPayload();
      const res = await submitExamAttempt(attemptId, payload);
      setSubmittedResult(res);
      showToast('Exam submitted', 'success');
    } catch (err: any) {
      console.error('Failed to submit exam', err);
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Could not submit exam';
      showToast(message, 'error');
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

  if (error || !attemptId) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.25rem' }}>
            Exam player
          </div>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            {error || 'Exam not found.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/exams')}>
            Back to exams
          </button>
        </div>
      </div>
    );
  }

  const scoreBlock = submittedResult ? (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div className="card-header">
        <div className="card-title">Score</div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="muted">Total</div>
          <div>
            {submittedResult.score} / {submittedResult.maxScore}
          </div>
        </div>
        <div className="stat-card">
          <div className="muted">Percentage</div>
          <div>
            {submittedResult.percentage !== null && submittedResult.percentage !== undefined
              ? `${submittedResult.percentage}%`
              : '-'}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.2rem' }}>
            Exam Attempt #{attemptId}
          </h1>
          <div className="muted">{examId ? `Exam ID: ${examId}` : ''}</div>
        </div>
        <div className="muted">{isSubmitted ? 'Submitted' : 'In progress'}</div>
      </div>

      {scoreBlock}
      {isSubmitted && submittedResult && (
        <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>
          Attempt submitted. Score: {submittedResult.score} / {submittedResult.maxScore}{' '}
          {submittedResult.percentage !== null && submittedResult.percentage !== undefined
            ? `(${submittedResult.percentage}%)`
            : ''}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">Questions</div>
          {!isSubmitted && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting}
              aria-label="Submit exam attempt"
            >
              {submitting ? 'Submitting...' : 'Submit exam'}
            </button>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="muted">No questions found. Please check with your teacher or try again later.</div>
        ) : (
          <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {questions.map((q) => {
              const ans = answers[q.id] || {};
              const optionIds = Array.from(ans.optionIds ?? []);
              return (
                <div key={q.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">
                        Q{q.order}: {q.text}
                      </div>
                      <div className="muted">
                        {q.type === 'MCQ' ? 'Multiple choice' : 'Numeric'}
                      </div>
                    </div>
                  </div>

                  {q.imageUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img src={q.imageUrl} alt="Exam question" style={{ maxWidth: '100%' }} />
                    </div>
                  )}

                  {q.type === 'MCQ' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(q.options || []).map((opt) => {
                        const checked = optionIds.includes(opt.id);
                        return (
                          <label key={opt.id} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSubmitted}
                              onChange={() => handleOptionToggle(q.id, opt.id)}
                            />
                            <span>{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="number"
                      className="form-control"
                      value={ans.numericAns ?? ''}
                      disabled={isSubmitted}
                      onChange={(e) => handleNumericChange(q.id, e.target.value)}
                      placeholder="Enter numeric answer"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isSubmitted && questions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting}
              aria-label="Submit exam attempt"
            >
              {submitting ? 'Submitting...' : 'Submit exam'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamPlayer;
