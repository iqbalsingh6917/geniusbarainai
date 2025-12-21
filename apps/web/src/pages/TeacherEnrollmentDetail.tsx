import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';

type ModuleAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type WorksheetAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type ExamAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface ModuleAttemptInfo {
  status: ModuleAttemptStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  moduleIndex: number;
}

interface ModuleItem {
  moduleId: number;
  moduleName: string;
  moduleIndex: number;
}

interface WorksheetAttemptInfo {
  id: number;
  worksheetId: number;
  worksheetTitle?: string;
  status: WorksheetAttemptStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
}

interface ExamAttemptInfo {
  id: number;
  examId: number;
  examTitle?: string;
  status: ExamAttemptStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
}

interface EnrollmentDetails {
  enrollmentId: number;
  studentName?: string;
  courseCode: string;
  courseName: string;
  progressPercent?: number;
}

const TeacherEnrollmentDetail: React.FC = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [attempts, setAttempts] = useState<Record<number, ModuleAttemptInfo>>({});
  const [worksheetAttempts, setWorksheetAttempts] = useState<WorksheetAttemptInfo[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttemptInfo[]>([]);
  const [worksheetGradeDrafts, setWorksheetGradeDrafts] = useState<
    Record<number, { score: string; maxScore: string; feedback: string }>
  >({});
  const [examGradeDrafts, setExamGradeDrafts] = useState<Record<number, { score: string; maxScore: string; feedback: string }>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingKey, setGradingKey] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!enrollmentId) return;
      const enrollmentIdNum = Number(enrollmentId);
      if (!Number.isInteger(enrollmentIdNum) || enrollmentIdNum <= 0) {
        setError('Invalid enrollment id');
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // Enrollment details (reuse student self courses endpoint if available)
        const enrollmentResp: any = await apiClient.get('/api/student/me/courses').catch(() => null);

        let details: EnrollmentDetails | null = null;
        if (enrollmentResp && enrollmentResp.courses) {
          const found = enrollmentResp.courses.find((c: any) => c.enrollmentId === Number(enrollmentId));
          if (found) {
            details = {
              enrollmentId: found.enrollmentId,
              studentName: '',
              courseCode: found.courseCode,
              courseName: found.courseName,
              progressPercent:
                found.totalLevels > 0 ? Math.round((found.levelsCompleted / found.totalLevels) * 100) : 0,
            };
          }
        }

        setEnrollment(details);

        // Fetch module structure
        const worksheetsResp = await apiClient.get('/api/student/me/worksheets').catch(() => null);
        if (worksheetsResp && worksheetsResp.courses) {
          const courseEntry = worksheetsResp.courses.find((c: any) => c.courseCode === details?.courseCode);
          if (courseEntry?.modules) {
            const mapped: ModuleItem[] =
              courseEntry.modules.map((m: any) => ({
                moduleId: m.moduleId,
                moduleName: m.moduleName,
                moduleIndex: m.moduleIndex,
              })) || [];
            setModules(mapped);
          }
        }

        // Fetch module attempts
        const attemptsResp = await apiClient.get(`/api/learning/module-attempts/for-teacher/${enrollmentIdNum}`);
        const attemptsItems = attemptsResp?.items || [];
        const map: Record<number, ModuleAttemptInfo> = {};
        attemptsItems.forEach((a: any) => {
          map[a.moduleIndex] = {
            status: a.status,
            startedAt: a.startedAt,
            completedAt: a.completedAt,
            score: a.score,
            maxScore: a.maxScore,
            moduleIndex: a.moduleIndex,
          };
        });
        setAttempts(map);

        await loadWorksheetAttempts(enrollmentIdNum, {
          setAttempts: setWorksheetAttempts,
          setDrafts: setWorksheetGradeDrafts,
        });
        await loadExamAttempts(enrollmentIdNum, { setAttempts: setExamAttempts, setDrafts: setExamGradeDrafts });
      } catch (err: any) {
        console.error('Failed to load enrollment detail', err);
        setError(err?.message || 'Failed to load enrollment detail');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [enrollmentId]);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const formatScore = (score?: number | null, maxScore?: number | null) => {
    if (score == null || maxScore == null) return '-';
    return `${score} / ${maxScore}`;
  };

  const parseNumberInput = (value: string) => {
    if (value == null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };

  const buildWorksheetDrafts = (items: any[]) => {
    const next: Record<number, { score: string; maxScore: string; feedback: string }> = {};
    items.forEach((a) => {
      next[a.worksheetId] = {
        score: a.score != null ? String(a.score) : '',
        maxScore: a.maxScore != null ? String(a.maxScore) : '',
        feedback: a.feedback ?? '',
      };
    });
    return next;
  };

  const buildExamDrafts = (items: any[]) => {
    const next: Record<number, { score: string; maxScore: string; feedback: string }> = {};
    items.forEach((a) => {
      next[a.examId] = {
        score: a.score != null ? String(a.score) : '',
        maxScore: a.maxScore != null ? String(a.maxScore) : '',
        feedback: a.feedback ?? '',
      };
    });
    return next;
  };

  const loadWorksheetAttempts = async (
    enrollmentIdNum: number,
    setters: {
      setAttempts: React.Dispatch<React.SetStateAction<WorksheetAttemptInfo[]>>;
      setDrafts: React.Dispatch<React.SetStateAction<Record<number, { score: string; maxScore: string; feedback: string }>>>;
    }
  ) => {
    try {
      const wsResp = await apiClient.get(`/api/learning/worksheet-attempts/for-teacher/${enrollmentIdNum}`);
      const wsItems = wsResp?.items || [];
      setters.setAttempts(
        wsItems.map((a: any) => ({
          id: a.id,
          worksheetId: a.worksheetId,
          worksheetTitle: a.worksheet?.title,
          status: a.status,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          score: a.score,
          maxScore: a.maxScore,
          feedback: a.feedback,
          gradedAt: a.gradedAt,
        }))
      );
      setters.setDrafts(buildWorksheetDrafts(wsItems));
    } catch (err) {
      console.error('Failed to load worksheet attempts', err);
    }
  };

  const loadExamAttempts = async (
    enrollmentIdNum: number,
    setters: {
      setAttempts: React.Dispatch<React.SetStateAction<ExamAttemptInfo[]>>;
      setDrafts: React.Dispatch<React.SetStateAction<Record<number, { score: string; maxScore: string; feedback: string }>>>;
    }
  ) => {
    try {
      const exResp = await apiClient.get(`/api/learning/exam-attempts/for-teacher/${enrollmentIdNum}`);
      const exItems = exResp?.items || [];
      setters.setAttempts(
        exItems.map((a: any) => ({
          id: a.id,
          examId: a.examId,
          examTitle: a.exam?.title,
          status: a.status,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          score: a.score,
          maxScore: a.maxScore,
          feedback: a.feedback,
          gradedAt: a.gradedAt,
        }))
      );
      setters.setDrafts(buildExamDrafts(exItems));
    } catch (err) {
      console.error('Failed to load exam attempts', err);
    }
  };

  const updateWorksheetDraft = (worksheetId: number, field: 'score' | 'maxScore' | 'feedback', value: string) => {
    setWorksheetGradeDrafts((prev) => ({
      ...prev,
      [worksheetId]: {
        score: prev[worksheetId]?.score ?? '',
        maxScore: prev[worksheetId]?.maxScore ?? '',
        feedback: prev[worksheetId]?.feedback ?? '',
        [field]: value,
      },
    }));
  };

  const updateExamDraft = (examId: number, field: 'score' | 'maxScore' | 'feedback', value: string) => {
    setExamGradeDrafts((prev) => ({
      ...prev,
      [examId]: {
        score: prev[examId]?.score ?? '',
        maxScore: prev[examId]?.maxScore ?? '',
        feedback: prev[examId]?.feedback ?? '',
        [field]: value,
      },
    }));
  };

  const promptForScore = async () => {
    const scoreStr = window.prompt('Enter score (numeric)');
    if (scoreStr == null) return null;
    const score = Number(scoreStr);
    if (Number.isNaN(score)) return null;
    const maxStr = window.prompt('Enter max score (optional, leave blank to keep existing)');
    const maxScore = maxStr && !Number.isNaN(Number(maxStr)) ? Number(maxStr) : undefined;
    return { score, maxScore };
  };

  const handleGradeModule = async (enrollmentIdNum: number, courseCode: string, moduleIndex: number) => {
    const input = await promptForScore();
    if (!input) return;
    const key = `${enrollmentIdNum}:${moduleIndex}`;
    try {
      setGradingKey(key);
      await apiClient.post('/api/learning/module-attempts/grade', {
        enrollmentId: enrollmentIdNum,
        courseCode,
        moduleIndex,
        score: input.score,
        maxScore: input.maxScore,
      });
      const resp = await apiClient.get(`/api/learning/module-attempts/for-teacher/${enrollmentIdNum}`);
      const attemptsItems = resp?.items || [];
      const map: Record<number, ModuleAttemptInfo> = {};
      attemptsItems.forEach((a: any) => {
        map[a.moduleIndex] = {
          status: a.status,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          score: a.score,
          maxScore: a.maxScore,
          moduleIndex: a.moduleIndex,
        };
      });
      setAttempts(map);
    } catch (err) {
      console.error('Failed to grade module attempt', err);
      alert('Could not save module score. Please try again.');
    } finally {
      setGradingKey(null);
    }
  };

  const handleGradeWorksheet = async (enrollmentIdNum: number, worksheetId: number) => {
    const draft = worksheetGradeDrafts[worksheetId] || { score: '', maxScore: '', feedback: '' };
    const parsedScore = parseNumberInput(draft.score);
    const parsedMaxScore = parseNumberInput(draft.maxScore);
    if (draft.score !== '' && parsedScore === undefined) {
      alert('Score must be a number');
      return;
    }
    if (draft.maxScore !== '' && parsedMaxScore === undefined) {
      alert('Max score must be a number');
      return;
    }
    const key = `ws:${worksheetId}`;
    try {
      setGradingKey(key);
      await apiClient.post('/api/learning/worksheet-attempts/grade', {
        enrollmentId: enrollmentIdNum,
        worksheetId,
        score: parsedScore,
        maxScore: parsedMaxScore,
        feedback: draft.feedback?.trim() || undefined,
      });
      await loadWorksheetAttempts(enrollmentIdNum, { setAttempts: setWorksheetAttempts, setDrafts: setWorksheetGradeDrafts });
    } catch (err) {
      console.error('Failed to grade worksheet attempt', err);
      alert('Could not save worksheet score. Please try again.');
    } finally {
      setGradingKey(null);
    }
  };

  const handleGradeExam = async (enrollmentIdNum: number, examId: number) => {
    const draft = examGradeDrafts[examId] || { score: '', maxScore: '', feedback: '' };
    const parsedScore = parseNumberInput(draft.score);
    const parsedMaxScore = parseNumberInput(draft.maxScore);
    if (draft.score !== '' && parsedScore === undefined) {
      alert('Score must be a number');
      return;
    }
    if (draft.maxScore !== '' && parsedMaxScore === undefined) {
      alert('Max score must be a number');
      return;
    }
    const key = `ex:${examId}`;
    try {
      setGradingKey(key);
      await apiClient.post('/api/learning/exam-attempts/grade', {
        enrollmentId: enrollmentIdNum,
        examId,
        score: parsedScore,
        maxScore: parsedMaxScore,
        feedback: draft.feedback?.trim() || undefined,
      });
      await loadExamAttempts(enrollmentIdNum, { setAttempts: setExamAttempts, setDrafts: setExamGradeDrafts });
    } catch (err) {
      console.error('Failed to grade exam attempt', err);
      alert('Could not save exam score. Please try again.');
    } finally {
      setGradingKey(null);
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

  if (error) {
    return (
      <div className="page-container">
        <ErrorCard message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="page-container">
        <ErrorCard message="Enrollment not found" onRetry={() => navigate(-1)} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.3rem' }}>
            Enrollment #{enrollment.enrollmentId}
          </h1>
          <div className="muted">
            Course: {enrollment.courseName} ({enrollment.courseCode})
          </div>
          {enrollment.studentName && <div className="muted">Student: {enrollment.studentName}</div>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title">Modules</div>
          <div className="muted">
            Progress: {enrollment.progressPercent != null ? `${enrollment.progressPercent}%` : '—'}
          </div>
        </div>
        {modules.length === 0 ? (
          <div className="muted" style={{ padding: '0.75rem' }}>
            No modules found for this course.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const attempt = attempts[m.moduleIndex];
                  const status = attempt?.status || 'NOT_STARTED';
                  const score =
                    attempt?.score != null && attempt?.maxScore != null
                      ? `${attempt.score} / ${attempt.maxScore}`
                      : '—';
                  return (
                    <tr key={m.moduleIndex}>
                      <td>
                        <div className="font-medium">
                          {m.moduleName} (#{m.moduleIndex})
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            status === 'COMPLETED'
                              ? 'badge-success'
                              : status === 'IN_PROGRESS'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                        >
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{formatDate(attempt?.startedAt)}</td>
                      <td>{formatDate(attempt?.completedAt)}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <span>{score}</span>
                          {status === 'COMPLETED' && (
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() =>
                                handleGradeModule(enrollment.enrollmentId, enrollment.courseCode, m.moduleIndex)
                              }
                              disabled={gradingKey === `${enrollment.enrollmentId}:${m.moduleIndex}`}
                            >
                              Set score
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title">Worksheets</div>
        </div>
        {worksheetAttempts.length === 0 ? (
          <div className="muted" style={{ padding: '0.75rem' }}>
            No worksheet attempts yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Worksheet</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Score</th>
                  <th>Feedback</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {worksheetAttempts.map((a) => {
                  const draft = worksheetGradeDrafts[a.worksheetId] || { score: '', maxScore: '', feedback: '' };
                  return (
                    <tr key={a.worksheetId}>
                      <td>
                        <div className="font-medium">{a.worksheetTitle || `Worksheet #${a.worksheetId}`}</div>
                        {a.gradedAt && (
                          <div className="muted" style={{ fontSize: '0.8rem' }}>
                            Graded {formatDate(a.gradedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            a.status === 'COMPLETED'
                              ? 'badge-success'
                              : a.status === 'IN_PROGRESS'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                        >
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{formatDate(a.startedAt)}</td>
                      <td>{formatDate(a.completedAt)}</td>
                      <td>{formatScore(a.score, a.maxScore)}</td>
                      <td>{a.feedback ? a.feedback : '—'}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <input
                              type="number"
                              className="input input-bordered input-xs"
                              style={{ width: '5rem' }}
                              placeholder="Score"
                              value={draft.score}
                              onChange={(e) => updateWorksheetDraft(a.worksheetId, 'score', e.target.value)}
                            />
                            <input
                              type="number"
                              className="input input-bordered input-xs"
                              style={{ width: '5rem' }}
                              placeholder="Max"
                              value={draft.maxScore}
                              onChange={(e) => updateWorksheetDraft(a.worksheetId, 'maxScore', e.target.value)}
                            />
                          </div>
                          <textarea
                            className="textarea textarea-bordered textarea-xs"
                            placeholder="Feedback"
                            rows={2}
                            value={draft.feedback}
                            onChange={(e) => updateWorksheetDraft(a.worksheetId, 'feedback', e.target.value)}
                          />
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleGradeWorksheet(enrollment.enrollmentId, a.worksheetId)}
                            disabled={gradingKey === `ws:${a.worksheetId}`}
                          >
                            {gradingKey === `ws:${a.worksheetId}` ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Exams</div>
        </div>
        {examAttempts.length === 0 ? (
          <div className="muted" style={{ padding: '0.75rem' }}>
            No exam attempts yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Submitted</th>
                  <th>Score</th>
                  <th>Feedback</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {examAttempts.map((a) => {
                  const draft = examGradeDrafts[a.examId] || { score: '', maxScore: '', feedback: '' };
                  return (
                    <tr key={a.examId}>
                      <td>
                        <div className="font-medium">{a.examTitle || `Exam #${a.examId}`}</div>
                        {a.gradedAt && (
                          <div className="muted" style={{ fontSize: '0.8rem' }}>
                            Graded {formatDate(a.gradedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            a.status === 'COMPLETED'
                              ? 'badge-success'
                              : a.status === 'IN_PROGRESS'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                        >
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{formatDate(a.startedAt)}</td>
                      <td>{formatDate(a.submittedAt)}</td>
                      <td>{formatScore(a.score, a.maxScore)}</td>
                      <td>{a.feedback ? a.feedback : '—'}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <input
                              type="number"
                              className="input input-bordered input-xs"
                              style={{ width: '5rem' }}
                              placeholder="Score"
                              value={draft.score}
                              onChange={(e) => updateExamDraft(a.examId, 'score', e.target.value)}
                            />
                            <input
                              type="number"
                              className="input input-bordered input-xs"
                              style={{ width: '5rem' }}
                              placeholder="Max"
                              value={draft.maxScore}
                              onChange={(e) => updateExamDraft(a.examId, 'maxScore', e.target.value)}
                            />
                          </div>
                          <textarea
                            className="textarea textarea-bordered textarea-xs"
                            placeholder="Feedback"
                            rows={2}
                            value={draft.feedback}
                            onChange={(e) => updateExamDraft(a.examId, 'feedback', e.target.value)}
                          />
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleGradeExam(enrollment.enrollmentId, a.examId)}
                            disabled={gradingKey === `ex:${a.examId}`}
                          >
                            {gradingKey === `ex:${a.examId}` ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherEnrollmentDetail;
