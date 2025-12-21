import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';

interface StudentDashboardData {
  student: {
    id: number;
    code: string;
    fullName: string;
    status: string;
    orgUnit: {
      code: string | null;
      name: string | null;
    };
    activeEnrollment: {
      id: number;
      courseCode: string;
      courseName: string;
      status: string;
    } | null;
  };
  progress: {
    totalLevels: number;
    completedLevels: number;
  };
  recentAssessments: Array<{
    id: number;
    date: string;
    courseCode: string;
    courseName: string;
    moduleName: string;
    levelName: string;
    scorePercent: number;
    status: string;
    remarks: string | null;
  }>;
  attendanceSummary: {
    month: string;
    totalClasses: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendancePercent: number;
  };
}

const StudentDashboardPage: React.FC = () => {
  const { studentId } = useParams<{ studentId?: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const endpoint = studentId
          ? `/api/student-dashboard/${studentId}`
          : '/api/student/me/dashboard';
        const dashboardData = await apiClient.get(endpoint);
        setData(dashboardData);
        setError(null);
      } catch (err: any) {
        const message = err?.message || 'Failed to load student dashboard';
        if (message.includes('401')) {
          navigate('/login');
          return;
        }
        if (message.includes('403')) {
          setError('You do not have access to this student dashboard.');
        } else {
          setError('Failed to load student dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, navigate]);

  const badge = (text: string, tone: 'success' | 'neutral' | 'danger') => {
    const toneClass =
      tone === 'success'
        ? 'badge badge-success'
        : tone === 'danger'
          ? 'badge badge-danger'
          : 'badge badge-neutral';
    return <span className={toneClass}>{text}</span>;
  };

  const formatMonth = (raw: string) => {
    const [year, month] = raw.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">Student Dashboard</h1>
          </div>
          <div className="flex justify-center items-center" style={{ minHeight: 180 }}>
            <LoadingSpinner size="lg" />
          </div>
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

  if (!data) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">Student Dashboard</h1>
          </div>
          <div className="muted">No dashboard data found.</div>
        </div>
      </div>
    );
  }

  const { student, progress, recentAssessments, attendanceSummary } = data;
  const completionPercent =
    progress.totalLevels > 0
      ? Math.round((progress.completedLevels / progress.totalLevels) * 100)
      : 0;

  return (
    <div className="page-container">
      {/* Profile */}
      <div className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.4rem' }}>{student.fullName}</h1>
            <div className="muted">Code: {student.code}</div>
          </div>
          {badge(student.status, student.status === 'ACTIVE' ? 'success' : 'neutral')}
        </div>
        <div className="muted">
          Center: {student.orgUnit.name || '-'} ({student.orgUnit.code || 'N/A'})
        </div>
      </div>

      {/* Active course + progress */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Active course</h2>
            <div className="muted">
              {student.activeEnrollment
                ? student.activeEnrollment.courseName
                : 'No active enrollment'}
            </div>
          </div>
          {student.activeEnrollment &&
            badge(
              student.activeEnrollment.status,
              student.activeEnrollment.status === 'COMPLETED' ? 'success' : 'neutral'
            )}
        </div>
        <div className="muted" style={{ marginBottom: '0.35rem' }}>
          Levels completed: {progress.completedLevels} of {progress.totalLevels}
        </div>
        <div className="muted" style={{ marginBottom: '0.5rem' }}>
          {completionPercent}% completion
        </div>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {/* Assessments */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Last 5 assessments</h2>
        </div>
        {recentAssessments.length === 0 ? (
          <div className="muted">No assessments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Level</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {recentAssessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>{new Date(assessment.date).toLocaleDateString()}</td>
                    <td>{assessment.levelName}</td>
                    <td>{assessment.scorePercent}%</td>
                    <td>
                      {badge(
                        assessment.status,
                        assessment.status === 'PASS' ? 'success' : 'danger'
                      )}
                    </td>
                    <td className="muted">{assessment.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Attendance · {formatMonth(attendanceSummary.month)}</h2>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="muted">Present</div>
            <div className="card-title">{attendanceSummary.present}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Absent</div>
            <div className="card-title">{attendanceSummary.absent}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Late</div>
            <div className="card-title">{attendanceSummary.late}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Excused</div>
            <div className="card-title">{attendanceSummary.excused}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Total classes</div>
            <div className="card-title">{attendanceSummary.totalClasses}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Attendance %</div>
            <div className="card-title">
              {attendanceSummary.attendancePercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;

