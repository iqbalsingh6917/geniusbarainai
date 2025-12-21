import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

interface Enrollment {
  id: number;
  status: string;
  startDate: string;
  endDate: string | null;
  courseId: number;
  courseCode: string;
  courseName: string;
  moduleId: number | null;
  moduleName: string | null;
  moduleIndex: number | null;
  levelId: number | null;
  levelName: string | null;
  levelOrder: number | null;
}

interface Assessment {
  id: number;
  scorePercent: number;
  passed: boolean;
  attemptDate: string;
  remarks: string | null;
  levelName: string;
  levelOrder: number;
}

interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  age: number | null;
  parentName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  orgUnitId: number;
  orgUnitName: string;
  enrollments: Enrollment[];
  recentAssessments: Assessment[];
}

const AbacusStudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.SUPERADMIN : FRONTEND_PERMISSIONS.SUPERADMIN;

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/superadmin/abacus/students/${id}`);
      setStudent(data);
      setError(null);
    } catch (err) {
      setError('Failed to load student details');
      console.error('Error fetching student details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      await apiClient.delete(`/superadmin/abacus/students/${id}`);
      navigate('/superadmin/abacus-students');
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Failed to delete student');
    }
  };

  if (loading) {
    return <div className="page-container">Loading student details...</div>;
  }

  if (error) {
    return <div className="page-container error">{error}</div>;
  }

  if (!student) {
    return <div className="page-container">Student not found</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Student Details</h1>
        <div>
          <Link to="/superadmin/abacus-students" className="btn btn-secondary">
            Back to Students
          </Link>
          <Link to={`/superadmin/student-dashboard/${student.id}`} className="btn btn-primary ml-2">
            View dashboard
          </Link>
          {permissions.canCreateEditStudents && (
            <button className="btn btn-danger ml-2" onClick={handleDelete}>
              Delete Student
            </button>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h2>{student.firstName} {student.lastName}</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Student Code:</strong> {student.code}</p>
              <p><strong>Age:</strong> {student.age || '-'}</p>
              <p><strong>Status:</strong> 
                <span className={`status-badge status-${student.status.toLowerCase()}`}>
                  {student.status}
                </span>
              </p>
            </div>
            <div>
              <p><strong>Parent Name:</strong> {student.parentName || '-'}</p>
              <p><strong>Contact Phone:</strong> {student.contactPhone || '-'}</p>
              <p><strong>Contact Email:</strong> {student.contactEmail || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3>Enrollments</h3>
        </div>
        <div className="card-body">
          {student.enrollments.length === 0 ? (
            <p>No enrollments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Current Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map(enrollment => (
                    <tr key={enrollment.id}>
                      <td>{enrollment.courseCode} - {enrollment.courseName}</td>
                      <td>
                        <span className={`status-badge status-${enrollment.status.toLowerCase()}`}>
                          {enrollment.status}
                        </span>
                      </td>
                      <td>{new Date(enrollment.startDate).toLocaleDateString()}</td>
                      <td>
                        {enrollment.levelName ? `${enrollment.levelName} (${enrollment.levelOrder})` : '-'}
                      </td>
                      <td>
                        <Link to={`/superadmin/abacus-enrollments/${enrollment.id}`} className="btn btn-secondary">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Assessments</h3>
        </div>
        <div className="card-body">
          {student.recentAssessments.length === 0 ? (
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
                  {student.recentAssessments.map(assessment => (
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

export default AbacusStudentDetail;
