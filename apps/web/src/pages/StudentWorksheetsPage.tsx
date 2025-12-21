import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import ErrorCard from '../components/ui/ErrorCard';

interface Worksheet {
  id: number;
  title: string;
  kind: string;
  difficultyBand: string | null;
  questionCount: number | null;
  notes: string | null;
}

interface Level {
  levelId: number;
  levelName: string;
  levelOrder: number;
  worksheets: Worksheet[];
}

interface Module {
  moduleId: number;
  moduleName: string;
  moduleIndex: number;
  levels: Level[];
}

interface Course {
  enrollmentId: number;
  courseCode: string;
  courseName: string;
  variant?: string;
  modules: Module[];
}

interface WorksheetsResponse {
  studentId: number;
  courses: Course[];
}

interface ActiveAssignment {
  id: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string | null;
  submittedAt: string | null;
  notes: string | null;
  worksheet: {
    id: number;
    title: string;
    kind: string;
    difficultyBand: string | null;
    questionCount: number | null;
  };
  level: { id: number; name: string; order: number };
  module: { id: number; name: string; index: number };
  course: { code: string; name: string; variant?: string };
  attempt: {
    id: number;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
    totalScore: number | null;
    maxScore: number | null;
    submittedAt: string | null;
  } | null;
  hasQuestions?: boolean;
}

interface ActiveAssignmentsResponse {
  studentId: number;
  assignments: ActiveAssignment[];
}

type TabKey = 'active' | 'catalog';
type WorksheetAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface WorksheetAttemptInfo {
  status: WorksheetAttemptStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
}

const statusClass = (status: ActiveAssignment['status']) => {
  switch (status) {
    case 'COMPLETED':
      return 'badge badge-success';
    case 'IN_PROGRESS':
      return 'badge badge-warning';
    default:
      return 'badge badge-neutral';
  }
};

const statusLabel = (status: ActiveAssignment['status']) => {
  if (status === 'NOT_STARTED') return 'Not started';
  if (status === 'IN_PROGRESS') return 'In progress';
  return 'Completed';
};

const attemptStatusClass = (status: ActiveAssignment['attempt'] | null) => {
  const value = status?.status;
  if (value === 'SUBMITTED' || value === 'GRADED') return 'badge badge-success';
  if (value === 'IN_PROGRESS') return 'badge badge-warning';
  return 'badge badge-neutral';
};

const attemptStatusLabel = (status: ActiveAssignment['attempt'] | null) => {
  const value = status?.status;
  if (!value) return 'Not started';
  if (value === 'SUBMITTED') return 'Submitted';
  if (value === 'GRADED') return 'Graded';
  return 'In progress';
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const StudentWorksheetsPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('active');
  const [catalogData, setCatalogData] = useState<WorksheetsResponse | null>(null);
  const [activeData, setActiveData] = useState<ActiveAssignmentsResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [attemptsByKey, setAttemptsByKey] = useState<Record<string, WorksheetAttemptInfo>>({});
  const [attemptLoading, setAttemptLoading] = useState<Record<number, boolean>>({});

  const getAttemptKey = (enrollmentId: number, worksheetId: number) => `${enrollmentId}_${worksheetId}`;

  const fetchCatalog = async () => {
    try {
      setCatalogLoading(true);
      const resp = await apiClient.get('/api/student/me/worksheets');
      setCatalogData(resp);
      setCatalogError(null);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setCatalogError('You are not authorized. Please log in again.');
      } else {
        setCatalogError(err?.message || 'Failed to load worksheets');
      }
    } finally {
      setCatalogLoading(false);
    }
  };

  const fetchActive = async () => {
    try {
      setActiveLoading(true);
      const resp = await apiClient.get('/api/student/me/active-worksheets');
      setActiveData(resp);
      setActiveError(null);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setActiveError('You are not authorized. Please log in again.');
      } else {
        setActiveError(err?.message || 'Failed to load active worksheets');
      }
    } finally {
      setActiveLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchActive();
  }, []);

  const fetchAttemptsForEnrollment = async (enrollmentId: number) => {
    try {
      setAttemptLoading((prev) => ({ ...prev, [enrollmentId]: true }));
      const resp = await apiClient.get(`/api/learning/worksheet-attempts/by-enrollment/${enrollmentId}`);
      const items = resp?.items || [];
      setAttemptsByKey((prev) => {
        const next = { ...prev };
        items.forEach((a: any) => {
          const key = getAttemptKey(enrollmentId, a.worksheetId);
          next[key] = {
            status: a.status as WorksheetAttemptStatus,
            startedAt: a.startedAt,
            completedAt: a.completedAt,
            score: a.score,
            maxScore: a.maxScore,
            feedback: a.feedback,
          };
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to load worksheet attempts', err);
    } finally {
      setAttemptLoading((prev) => ({ ...prev, [enrollmentId]: false }));
    }
  };

  useEffect(() => {
    if (catalogData?.courses) {
      const uniqueEnrollments = Array.from(new Set(catalogData.courses.map((c) => c.enrollmentId)));
      uniqueEnrollments.forEach((id) => fetchAttemptsForEnrollment(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogData?.courses?.length]);

  const handleStatusUpdate = async (id: number, status: ActiveAssignment['status']) => {
    try {
      setUpdatingId(id);
      await apiClient.put(`/api/worksheet-assignments/${id}`, { status });
      showToast('Worksheet status updated', 'success');
      await fetchActive();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartAttempt = async (assignment: ActiveAssignment) => {
    try {
      setUpdatingId(assignment.id);
      const resp: any = await apiClient.post(
        `/api/student/me/worksheets/${assignment.worksheet.id}/attempt`,
        { assignmentId: assignment.id }
      );
      const attemptId = resp?.attempt?.id || resp?.id;
      if (attemptId) {
        await fetchActive();
        navigate(`/student/worksheet-attempts/${attemptId}`);
      } else {
        showToast('Could not start attempt', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to start attempt', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderActiveTab = () => {
    if (activeLoading) {
      return (
        <div className="card" style={{ textAlign: 'center' }}>
          <LoadingSpinner size="lg" />
        </div>
      );
    }
    if (activeError) {
      return <ErrorCard message={activeError} onRetry={fetchActive} />;
    }
    if (!activeData || activeData.assignments.length === 0) {
      return (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Active worksheets</div>
          <div className="muted">No active worksheets assigned yet.</div>
        </div>
      );
    }

    return activeData.assignments.map((assignment) => {
      const hasQuestions = assignment.hasQuestions ?? (assignment.worksheet.questionCount ?? 0) > 0;
      const attempt = assignment.attempt;
      const actionLabel = !attempt
        ? 'Start attempt'
        : attempt.status === 'IN_PROGRESS'
          ? 'Continue attempt'
          : 'View attempt';
      const scoreText =
        attempt && attempt.totalScore !== null && attempt.maxScore !== null
          ? `${attempt.totalScore} / ${attempt.maxScore}`
          : '-';
      const courseLabel = `${assignment.course.name} (${assignment.course.code}${
        assignment.course.variant === 'BEATS20' ? ' · AI-enhanced' : ''
      })`;

      return (
        <div className="card" key={assignment.id}>
          <div className="card-header">
            <div>
              <div className="card-title">{assignment.worksheet.title}</div>
              <div className="muted">
                {courseLabel} - {assignment.module.name} - Level {assignment.level.order}: {assignment.level.name}
              </div>
            </div>
            <span
              className={hasQuestions ? attemptStatusClass(attempt) : statusClass(assignment.status)}
            >
              {hasQuestions ? attemptStatusLabel(attempt) : statusLabel(assignment.status)}
            </span>
          </div>
          <div className="stat-grid" style={{ marginBottom: '0.5rem' }}>
            <div className="stat-card">
              <div className="muted">Due date</div>
              <div>{formatDate(assignment.dueDate)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Questions</div>
              <div>{assignment.worksheet.questionCount ?? '-'}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Difficulty</div>
              <div>{assignment.worksheet.difficultyBand || '-'}</div>
            </div>
            {hasQuestions && (
              <div className="stat-card">
                <div className="muted">Score</div>
                <div>{scoreText}</div>
              </div>
            )}
          </div>
          {assignment.notes && (
            <div className="muted" style={{ marginBottom: '0.5rem' }}>
              Notes: {assignment.notes}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {hasQuestions ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleStartAttempt(assignment)}
                disabled={updatingId === assignment.id}
              >
                {actionLabel}
              </button>
            ) : (
              <>
                {assignment.status === 'NOT_STARTED' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStatusUpdate(assignment.id, 'IN_PROGRESS')}
                    disabled={updatingId === assignment.id}
                  >
                    Mark as started
                  </button>
                )}
                {assignment.status === 'IN_PROGRESS' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStatusUpdate(assignment.id, 'COMPLETED')}
                    disabled={updatingId === assignment.id}
                  >
                    Mark as completed
                  </button>
                )}
              </>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(`/student/worksheets/${assignment.worksheet.id}/play`)}
            >
              Open online
            </button>
          </div>
        </div>
      );
    });
  };
  const renderCatalogTab = () => {
    if (catalogLoading) {
      return (
        <div className="card" style={{ textAlign: 'center' }}>
          <LoadingSpinner size="lg" />
        </div>
      );
    }
    if (catalogError) {
      return <ErrorCard message={catalogError} onRetry={fetchCatalog} />;
    }
    if (!catalogData || catalogData.courses.length === 0) {
      return (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>All worksheets</div>
          <div className="muted">No worksheets are available yet.</div>
        </div>
      );
    }

    return catalogData.courses.map((course) => (
      <div className="card" key={course.courseCode}>
        <div className="card-header">
          <div>
            <div className="card-title">
              {course.courseName}
              {course.variant === 'BEATS20' && (
                <span className="muted" style={{ marginLeft: '0.35rem' }}>· AI-enhanced</span>
              )}
            </div>
            <div className="muted">Code: {course.courseCode}</div>
          </div>
        </div>

        {course.modules.length === 0 && <div className="muted">No modules found.</div>}

        {course.modules.map((module) => (
          <div key={module.moduleId} style={{ marginTop: '0.5rem' }}>
            <div className="muted" style={{ fontWeight: 600 }}>
              Module {module.moduleIndex} · {module.moduleName}
            </div>

            {module.levels.length === 0 && <div className="muted">No levels found.</div>}

            {module.levels.map((level) => (
              <div key={level.levelId} style={{ marginTop: '0.35rem' }}>
                <div className="muted" style={{ fontWeight: 500 }}>
                  Level {level.levelOrder}: {level.levelName}
                </div>
                {level.worksheets.length === 0 ? (
                  <div className="muted">No worksheets for this level.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table" style={{ marginTop: '0.35rem' }}>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Kind</th>
                          <th>Difficulty</th>
                          <th>Questions</th>
                          <th>Notes</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Feedback</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {level.worksheets.map((worksheet) => {
                          const key = getAttemptKey(course.enrollmentId, worksheet.id);
                          const attempt = attemptsByKey[key];
                          const status: WorksheetAttemptStatus = attempt?.status ?? 'NOT_STARTED';
                          const loadingAttempt = attemptLoading[course.enrollmentId] || updatingId === worksheet.id;
                          return (
                            <tr key={worksheet.id}>
                              <td>{worksheet.title}</td>
                              <td>{worksheet.kind}</td>
                              <td>{worksheet.difficultyBand || '-'}</td>
                              <td>{worksheet.questionCount ?? '-'}</td>
                              <td className="muted">{worksheet.notes || '-'}</td>
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
                              <td>
                                {attempt?.score != null && attempt?.maxScore != null
                                  ? `${attempt.score} / ${attempt.maxScore}`
                                  : '-'}
                              </td>
                              <td>{attempt?.feedback ? attempt.feedback : '—'}</td>
                              <td>
                                {status === 'NOT_STARTED' && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    disabled={loadingAttempt}
                                    onClick={async () => {
                                      try {
                                        setUpdatingId(worksheet.id);
                                        await apiClient.post('/api/learning/worksheet-attempts/start', {
                                          enrollmentId: course.enrollmentId,
                                          worksheetId: worksheet.id,
                                        });
                                        setAttemptsByKey((prev) => ({
                                          ...prev,
                                          [key]: { status: 'IN_PROGRESS', startedAt: new Date().toISOString() },
                                        }));
                                      } catch (err) {
                                        console.error('Failed to start worksheet attempt', err);
                                        showToast('Could not start this worksheet. Please try again.', 'error');
                                      } finally {
                                        setUpdatingId(null);
                                      }
                                    }}
                                  >
                                    {loadingAttempt ? 'Starting...' : 'Start'}
                                  </button>
                                )}
                                {status === 'IN_PROGRESS' && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={loadingAttempt}
                                    onClick={async () => {
                                      try {
                                        setUpdatingId(worksheet.id);
                                        await apiClient.post('/api/learning/worksheet-attempts/complete', {
                                          enrollmentId: course.enrollmentId,
                                          worksheetId: worksheet.id,
                                        });
                                        setAttemptsByKey((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...(prev[key] || { status: 'IN_PROGRESS' }),
                                            status: 'COMPLETED',
                                            completedAt: new Date().toISOString(),
                                          },
                                        }));
                                        await fetchAttemptsForEnrollment(course.enrollmentId);
                                      } catch (err) {
                                        console.error('Failed to complete worksheet attempt', err);
                                        showToast('Could not complete this worksheet. Please try again.', 'error');
                                      } finally {
                                        setUpdatingId(null);
                                      }
                                    }}
                                  >
                                    {loadingAttempt ? 'Saving...' : 'Mark completed'}
                                  </button>
                                )}
                                {status === 'COMPLETED' && <span className="muted">Completed</span>}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ marginLeft: '0.35rem' }}
                                  onClick={() => navigate(`/student/worksheets/${worksheet.id}/play`)}
                                >
                                  Open online
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    ));
  };

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.3rem' }}>My worksheets</h1>
          <div className="muted">Active homework plus full worksheet library.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-ghost btn-sm ${tab === 'active' ? 'badge-neutral' : ''}`}
            onClick={() => setTab('active')}
          >
            Active
          </button>
          <button
            className={`btn btn-ghost btn-sm ${tab === 'catalog' ? 'badge-neutral' : ''}`}
            onClick={() => setTab('catalog')}
          >
            All worksheets
          </button>
        </div>
      </div>

      {tab === 'active' ? renderActiveTab() : renderCatalogTab()}
    </div>
  );
};

export default StudentWorksheetsPage;



