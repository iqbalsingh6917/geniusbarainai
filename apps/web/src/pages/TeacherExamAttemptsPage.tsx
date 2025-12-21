import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';
import { listExamAttemptsForTeacher, TeacherExamAttemptListItem } from '../api/teacherExamsClient';

const TeacherExamAttemptsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<TeacherExamAttemptListItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await listExamAttemptsForTeacher();
        setAttempts(res || []);
      } catch (err: any) {
        console.error('Failed to load exam attempts', err);
        setError(err?.message || 'Failed to load exam attempts');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.3rem' }}>Exam Attempts</h1>
          <div className="muted">Recent exam attempts within your scope.</div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam</th>
                <th>Course</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((item) => {
                const studentName = `${item.student.firstName} ${item.student.lastName || ''}`.trim();
                const score =
                  item.score !== null && item.score !== undefined && item.maxScore
                    ? `${item.score} / ${item.maxScore}`
                    : '-';
                return (
                  <tr key={item.id}>
                    <td>{studentName || '-'}</td>
                    <td>{item.exam.title}</td>
                    <td>{item.exam.courseCode}</td>
                    <td>{item.status || '-'}</td>
                    <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '-'}</td>
                    <td>{score}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/teacher/exams/attempts/${item.id}`)}
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
      </div>
    </div>
  );
};

export default TeacherExamAttemptsPage;
