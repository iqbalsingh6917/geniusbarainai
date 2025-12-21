import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import {
  AttemptQuestionsResponse,
  startWorksheetAttempt,
  getWorksheetAttemptQuestions,
  submitWorksheetAttempt,
  WorksheetQuestion,
  WorksheetMeta,
} from '../api/studentWorksheetsClient';

type AnswerState = {
  numericAns?: string;
  textAns?: string;
  optionIds?: Set<number>;
};

const questionTypeLabel = (q: WorksheetQuestion) => {
  const type = q.questionType?.toUpperCase?.() || '';
  if (type === 'MCQ') return 'Multiple choice';
  if (type === 'NUMERIC') return 'Numeric';
  if (type === 'TEXT') return 'Text';
  return type || 'Question';
};

const StudentWorksheetPlayer: React.FC = () => {
  const { worksheetId: worksheetIdParam, attemptId: attemptIdParam } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  type SubmitQuestionSummary = {
    questionId: number;
    orderIndex: number;
    prompt: string;
    correctAnswer: string | null;
    answerGiven: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<string>('IN_PROGRESS');
  const [worksheet, setWorksheet] = useState<WorksheetMeta | null>(null);
  const [questions, setQuestions] = useState<WorksheetQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [submittedSummary, setSubmittedSummary] = useState<{
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
    questions: SubmitQuestionSummary[];
  } | null>(null);

  const isSubmitted = attemptStatus !== 'IN_PROGRESS';

  const loadFromStart = async (wid: number) => {
    const res = await startWorksheetAttempt(wid);
    setAttemptId(res.attempt.id);
    setAttemptStatus(res.attempt.status);
    setWorksheet(res.worksheet);
    setQuestions(res.questions || []);
    setSubmittedSummary(null);
    const initial: Record<number, AnswerState> = {};
    setAnswers(initial);
  };

  const loadFromAttempt = async (aid: number) => {
    const res: AttemptQuestionsResponse = await getWorksheetAttemptQuestions(aid);
    setAttemptId(res.attemptId);
    setWorksheet((prev) => prev ?? { id: res.worksheetId, title: 'Worksheet' });
    setQuestions(res.questions || []);
    setAttemptStatus('IN_PROGRESS'); // submit endpoint will flip to COMPLETED later
    setSubmittedSummary(null);

    const initial: Record<number, AnswerState> = {};
    (res.answers || []).forEach((ans) => {
      initial[ans.questionId] = {
        numericAns:
          ans.numericAns !== null && ans.numericAns !== undefined ? String(ans.numericAns) : undefined,
        textAns: ans.textAns ?? ans.answerGiven ?? '',
        optionIds: new Set(ans.optionIds || []),
      };
    });
    setAnswers(initial);
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        if (attemptIdParam) {
          const aid = Number(attemptIdParam);
          if (!aid) throw new Error('Invalid attempt id');
          await loadFromAttempt(aid);
        } else if (worksheetIdParam) {
          const wid = Number(worksheetIdParam);
          if (!wid) throw new Error('Invalid worksheet id');
          await loadFromStart(wid);
        } else {
          throw new Error('No worksheet or attempt specified');
        }
      } catch (err: any) {
        console.error('Failed to load worksheet player', err);
        setError(err?.message || 'Unable to load worksheet');
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetIdParam, attemptIdParam]);

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

  const handleNumericChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), numericAns: value },
    }));
  };

  const handleTextChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), textAns: value },
    }));
  };

  const buildSubmitPayload = () => {
    return questions.map((q) => {
      const ans = answers[q.id] || {};
      const optionIds = Array.from(ans.optionIds ?? []);
      const numericVal = ans.numericAns !== undefined ? Number(ans.numericAns) : undefined;
      const numericAns =
        numericVal !== undefined && !Number.isNaN(numericVal) ? numericVal : undefined;
      const textAns = ans.textAns;
      const answerGiven =
        textAns && textAns.length > 0
          ? textAns
          : numericAns !== undefined
            ? String(numericAns)
            : optionIds.length > 0
              ? optionIds.join(',')
              : ans.numericAns || '';

      return {
        questionId: q.id,
        numericAns,
        textAns,
        optionIds,
        answerGiven,
      };
    });
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    for (const q of questions) {
      const ans = answers[q.id];
      if (q.questionType === 'MCQ') {
        const selected = Array.from(ans?.optionIds ?? []);
        if (selected.length === 0) {
          showToast('Please select at least one option for each question', 'error');
          return;
        }
      }
      if (q.questionType === 'NUMERIC') {
        const val = ans?.numericAns;
        if (val === undefined || val === '') {
          showToast('Please answer all numeric questions before submitting', 'error');
          return;
        }
        if (Number.isNaN(Number(val))) {
          showToast('Please enter valid numbers for numeric questions', 'error');
          return;
        }
      }
      if (q.questionType === 'TEXT') {
        const val = ans?.textAns ?? '';
        if (val.trim().length === 0) {
          showToast('Please fill text answers before submitting', 'error');
          return;
        }
      }
    }
    try {
      setSubmitting(true);
      const payload = { answers: buildSubmitPayload() };
      const res = await submitWorksheetAttempt(attemptId, payload);
      setAttemptStatus(res.attempt.status);
      setSubmittedSummary({
        totalScore: res.totalScore,
        maxScore: res.maxScore,
        percentage: res.percentage,
        questions: res.questions,
      });
      showToast('Worksheet submitted', 'success');
    } catch (err: any) {
      console.error('Failed to submit worksheet', err);
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Could not submit worksheet';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalScore = submittedSummary?.totalScore ?? null;
  const maxScore = submittedSummary?.maxScore ?? null;
  const percentage = submittedSummary?.percentage ?? null;

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
            Worksheet player
          </div>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            {error || 'Worksheet not found.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/worksheets')}>
            Back to worksheets
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
            {worksheet?.title || 'Worksheet'}
          </h1>
          <div className="muted">
            {worksheet?.courseName || worksheet?.courseCode
              ? `${worksheet?.courseName || ''} ${worksheet?.courseCode ? `(${worksheet?.courseCode})` : ''}`
              : ''}
          </div>
        </div>
        <div className="muted">
          Attempt #{attemptId} - {attemptStatus.replace('_', ' ')}
        </div>
      </div>

      {submittedSummary && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="card-header">
            <div className="card-title">Score</div>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Total</div>
              <div>
                {totalScore ?? '-'} / {maxScore ?? '-'}
              </div>
            </div>
            <div className="stat-card">
              <div className="muted">Percentage</div>
              <div>{percentage !== null && percentage !== undefined ? `${percentage}%` : '-'}</div>
            </div>
          </div>
        </div>
      )}
      {isSubmitted && submittedSummary && (
        <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>
          Attempt submitted. Score: {totalScore ?? '-'} / {maxScore ?? '-'}{' '}
          {percentage !== null && percentage !== undefined ? `(${percentage}%)` : ''}
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
              aria-label="Submit worksheet attempt"
            >
              {submitting ? 'Submitting...' : 'Submit worksheet'}
            </button>
          )}
        </div>
        {questions.length === 0 ? (
          <div className="muted">No questions found. Please contact your teacher if this persists.</div>
        ) : (
          <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {questions.map((q) => {
              const ans = answers[q.id] || {};
              const summary = submittedSummary?.questions.find((s) => s.questionId === q.id);
              const optionIds = Array.from(ans.optionIds ?? []);
              return (
                <div key={q.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">
                        Q{q.orderIndex}: {q.prompt}
                      </div>
                      <div className="muted">
                        {questionTypeLabel(q)} - Marks: {q.maxMarks ?? 0}
                      </div>
                    </div>
                    {isSubmitted && summary && (
                      <span className={summary.isCorrect ? 'badge badge-success' : 'badge badge-danger'}>
                        {summary.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    )}
                  </div>

                  {q.imageUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img src={q.imageUrl} alt="Question visual" style={{ maxWidth: '100%' }} />
                    </div>
                  )}

                  {q.questionType === 'MCQ' ? (
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
                  ) : q.questionType === 'NUMERIC' ? (
                    <input
                      type="number"
                      className="form-control"
                      value={ans.numericAns ?? ''}
                      disabled={isSubmitted}
                      onChange={(e) => handleNumericChange(q.id, e.target.value)}
                      placeholder="Enter numeric answer"
                    />
                  ) : (
                    <textarea
                      className="form-control"
                      rows={2}
                      value={ans.textAns ?? ''}
                      disabled={isSubmitted}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      placeholder="Enter your answer"
                    />
                  )}

                  {isSubmitted && summary && (
                    <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span>Submitted: {summary.answerGiven || '-'}</span>
                      <span>Correct: {summary.correctAnswer || '-'}</span>
                      <span>
                        Marks: {summary.marksAwarded} / {summary.maxMarks}
                      </span>
                    </div>
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
              aria-label="Submit worksheet attempt"
            >
              {submitting ? 'Submitting...' : 'Submit worksheet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentWorksheetPlayer;



