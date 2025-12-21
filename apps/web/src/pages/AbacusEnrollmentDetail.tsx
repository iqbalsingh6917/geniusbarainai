import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

interface Assessment {
  id: number;
  scorePercent: number;
  passed: boolean;
  attemptDate: string;
  remarks: string | null;
  levelName: string;
  levelOrder: number;
}

interface Enrollment {
  id: number;
  status: string;
  startDate: string;
  endDate: string | null;
  orgUnitName: string;
  studentCode: string;
  studentFirstName: string;
  studentLastName: string;
  courseCode: string;
  courseName: string;
  moduleTitle: string | null;
  moduleIndex: number | null;
  levelName: string | null;
  levelOrder: number | null;
  assessments: Assessment[];
}

const AbacusEnrollmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.SUPERADMIN : FRONTEND_PERMISSIONS.SUPERADMIN;

  useEffect(() => {
    fetchEnrollment();
  }, [id]);

  const fetchEnrollment = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/superadmin/abacus/enrollments/${id}/progress`);
      setEnrollment(data);
      setError(null);
    } catch (err) {
      setError('Failed to load enrollment details');
      console.error('Error fetching enrollment details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this enrollment?')) {
      return;
    }

    try {
      await apiClient.delete(`/superadmin/abacus/enrollments/${id}`);
      navigate('/superadmin/abacus-enrollments');
    } catch (err) {
      console.error('Error deleting enrollment:', err);
      alert('Failed to delete enrollment');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updatedEnrollment = await apiClient.put(`/superadmin/abacus/enrollments/${id}`, {
        status: newStatus
      });
      
      setEnrollment(prev => prev ? { ...prev, ...updatedEnrollment } : null);
    } catch (err) {
      console.error('Error updating enrollment status:', err);
      alert('Failed to update enrollment status');
    }
  };

  if (loading) {
    return <div className="page-container">Loading enrollment details...</div>;
  }

  if (error) {
    return <div className="page-container error">{error}</div>;
  }

  if (!enrollment) {
    return <div className="page-container">Enrollment not found</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Enrollment Details</h1>
        <div>
          <Link to="/superadmin/abacus-enrollments" className="btn btn-secondary">
            Back to Enrollments
          </Link>
          {permissions.canCreateEditEnrollments && (
            <button className="btn btn-danger ml-2" onClick={handleDelete}>
              Delete Enrollment
            </button>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h2>{enrollment.studentCode} - {enrollment.studentFirstName} {enrollment.studentLastName}</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Course:</strong> {enrollment.courseCode} - {enrollment.courseName}</p>
              <p><strong>Status:</strong> 
                <span className={`status-badge status-${enrollment.status.toLowerCase()}`}>
                  {enrollment.status}
                </span>
              </p>
              {permissions.canUpdateProgress && (
                <div className="mt-2">
                  <button 
                    className="btn btn-secondary mr-2"
                    onClick={() => handleStatusChange(enrollment.status === 'ONGOING' ? 'COMPLETED' : 'ONGOING')}
                  >
                    {enrollment.status === 'ONGOING' ? 'Complete' : 'Reopen'} Enrollment
                  </button>
                </div>
              )}
            </div>
            <div>
              <p><strong>Start Date:</strong> {new Date(enrollment.startDate).toLocaleDateString()}</p>
              {enrollment.endDate && (
                <p><strong>End Date:</strong> {new Date(enrollment.endDate).toLocaleDateString()}</p>
              )}
              <p><strong>Organization:</strong> {enrollment.orgUnitName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3>Current Position</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Current Module:</strong> 
                {enrollment.moduleTitle ? 
                  `${enrollment.moduleTitle} (Module ${enrollment.moduleIndex})` : 
                  'Not assigned'}
              </p>
            </div>
            <div>
              <p><strong>Current Level:</strong> 
                {enrollment.levelName ? 
                  `${enrollment.levelName} (Level ${enrollment.levelOrder})` : 
                  'Not assigned'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Assessments</h3>
        </div>
        <div className="card-body">
          {enrollment.assessments.length === 0 ? (
            <p>No assessments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
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
                  {enrollment.assessments.map(assessment => (
                    <tr key={assessment.id}>
                      <td>{new Date(assessment.attemptDate).toLocaleDateString()}</td>
                      <td>{assessment.levelName} ({assessment.levelOrder})</td>
                      <td>{assessment.scorePercent}%</td>
                      <td>
                        {assessment.passed ? (
                          <span className="status-badge status-success">Passed</span>
                        ) : (
                          <span className="status-badge status-danger">Failed</span>
                        )}
                      </td>
                      <td>{assessment.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbacusEnrollmentDetail;