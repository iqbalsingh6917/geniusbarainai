import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';
import { useToast } from '../contexts/ToastContext';

type ExamAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface ExamAttemptInfo {
  status: ExamAttemptStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
}

interface ExamItem {
  enrollmentId: number;
  courseCode: string;
  courseName: string;
  examId: number;
  title: string;
  createdAt: string;
}

interface ExamsResponse {
  studentId: number;
  exams: ExamItem[];
}

const statusBadge = (status: ExamAttemptStatus) => {
  if (status === 'COMPLETED') return 'badge badge-success';
  if (status === 'IN_PROGRESS') return 'badge badge-warning';
  return 'badge badge-neutral';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const StudentExamsPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<ExamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptsByKey, setAttemptsByKey] = useState<Record<string, ExamAttemptInfo>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const getAttemptKey = (enrollmentId: number, examId: number) => `${enrollmentId}_${examId}`;

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const resp = (await apiClient.get('/api/student/me/exams')) as ExamsResponse;
        setData(resp);
        setError(null);
        const enrollments = Array.from(new Set((resp?.exams || []).map((e: ExamItem) => e.enrollmentId)));
        enrollments.forEach((enrollmentId) => fetchAttemptsForEnrollment(enrollmentId));
      } catch (err: any) {
        setError(err?.message || 'Failed to load exams');
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAttemptsForEnrollment = async (enrollmentId: number) => {
    try {
        const resp = (await apiClient.get(`/api/learning/exam-attempts/by-enrollment/${enrollmentId}`)) as any;
        const items = resp?.items || [];
      setAttemptsByKey((prev) => {
        const next = { ...prev };
        items.forEach((a: any) => {
          const key = getAttemptKey(enrollmentId, a.examId);
          next[key] = {
            status: a.status as ExamAttemptStatus,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt,
            score: a.score,
            maxScore: a.maxScore,
            feedback: a.feedback,
          };
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to load exam attempts', err);
    }
  };

  const handleStart = async (enrollmentId: number, examId: number) => {
    const key = getAttemptKey(enrollmentId, examId);
    try {
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      await apiClient.post('/api/learning/exam-attempts/start', {
        enrollmentId,
        examId,
      });
      setAttemptsByKey((prev) => ({
        ...prev,
        [key]: {
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        },
      }));
    } catch (err) {
      console.error('Failed to start exam attempt', err);
      showToast('Could not start this exam. Please try again.', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleComplete = async (enrollmentId: number, examId: number) => {
    const key = getAttemptKey(enrollmentId, examId);
    try {
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      await apiClient.post('/api/learning/exam-attempts/complete', {
        enrollmentId,
        examId,
      });
      await fetchAttemptsForEnrollment(enrollmentId);
    } catch (err) {
      console.error('Failed to complete exam attempt', err);
      showToast('Could not complete this exam. Please try again.', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
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

  if (!data || data.exams.length === 0) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>My exams</div>
          <div className="muted">No exams available yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.3rem' }}>My exams</h1>
          <div className="muted">Exam list with attempt status.</div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Course</th>
                <th>Status</th>
                <th>Started</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Feedback</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.exams.map((exam) => {
                const key = getAttemptKey(exam.enrollmentId, exam.examId);
                const attempt = attemptsByKey[key];
                const status: ExamAttemptStatus = attempt?.status ?? 'NOT_STARTED';
                const showResults = status === 'COMPLETED';
                const score =
                  showResults && attempt?.score != null && attempt?.maxScore != null
                    ? `${attempt.score} / ${attempt.maxScore}`
                    : '-';
                const feedback = showResults && attempt?.feedback ? attempt.feedback : '—';
                const isBusy = actionLoading[key];
                return (
                  <tr key={key}>
                    <td>{exam.title}</td>
                    <td>
                      {exam.courseName} ({exam.courseCode})
                    </td>
                    <td>
                      <span className={statusBadge(status)}>{status.replace('_', ' ')}</span>
                    </td>
                    <td>{formatDateTime(attempt?.startedAt)}</td>
                    <td>{formatDateTime(attempt?.submittedAt)}</td>
                    <td>{score}</td>
                    <td>{feedback}</td>
                    <td>
                      {status === 'NOT_STARTED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleStart(exam.enrollmentId, exam.examId)}
                          disabled={!!isBusy}
                        >
                          {isBusy ? 'Starting...' : 'Start exam'}
                        </button>
                      )}
                      {status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleComplete(exam.enrollmentId, exam.examId)}
                          disabled={!!isBusy}
                        >
                          {isBusy ? 'Submitting...' : 'Mark complete'}
                        </button>
                      )}
                      {status === 'COMPLETED' && <span className="muted">Completed</span>}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: '0.35rem' }}
                        onClick={() => navigate(`/student/exams/${exam.examId}/play`)}
                      >
                        Open exam
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentExamsPage;
