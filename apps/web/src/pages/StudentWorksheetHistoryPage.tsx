import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';

interface AttemptRow {
  id: number;
  status: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  teacherAdjustedScore: number | null;
  teacherComment: string | null;
  reviewedAt: string | null;
}

interface AttemptGroup {
  worksheetId: number;
  worksheetTitle: string;
  course: { code: string; name: string; variant?: string };
  module: { id: number; name: string; index: number };
  level: { id: number; name: string; order: number };
  attempts: AttemptRow[];
}

const StudentWorksheetHistoryPage: React.FC = () => {
  const [groups, setGroups] = useState<AttemptGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data: AttemptGroup[] = await apiClient.get('/api/student/me/worksheets/attempts');
      setGroups(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attempts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorCard message={error} onRetry={fetchHistory} />;
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <div className="card-title" style={{ fontSize: '1.2rem' }}>My Attempts</div>
          <div className="muted">Submitted worksheet attempts with teacher feedback.</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <div className="muted">No attempts yet.</div>
        </div>
      ) : (
        groups.map((group) => (
          <div className="card" key={group.worksheetId} style={{ marginBottom: '0.75rem' }}>
            <div className="card-header">
              <div>
                <div className="card-title">{group.worksheetTitle}</div>
                <div className="muted">
                  {group.course.name} ({group.course.code}
                  {group.course.variant === 'BEATS20' ? ' · AI-enhanced' : ''}) - Module {group.module.index}: {group.module.name} - Level {group.level.order}:{' '}
                  {group.level.name}
                </div>
              </div>
            </div>
            {group.attempts.length === 0 ? (
              <div className="muted">No attempts for this worksheet yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Teacher review</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.attempts.map((attempt) => {
                      const score =
                        attempt.teacherAdjustedScore !== null
                          ? `${attempt.teacherAdjustedScore} (adjusted)`
                          : attempt.totalScore !== null && attempt.maxScore !== null
                            ? `${attempt.totalScore} / ${attempt.maxScore}`
                            : '-';
                      return (
                        <tr key={attempt.id}>
                          <td>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-'}</td>
                          <td>{attempt.status}</td>
                          <td>{score}</td>
                          <td>
                            {attempt.reviewedAt ? (
                              <span className="badge badge-success">Reviewed</span>
                            ) : (
                              <span className="badge badge-neutral">Pending review</span>
                            )}
                            {attempt.teacherComment && <div className="muted">{attempt.teacherComment}</div>}
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate(`/student/worksheet-attempts/${attempt.id}`)}
                            >
                              View
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
        ))
      )}
    </div>
  );
};

export default StudentWorksheetHistoryPage;
