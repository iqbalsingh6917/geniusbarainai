import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

// Import the API client
import { apiClient } from '../utils/apiClient';

// Import UI components
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import StandardTable from '../components/ui/StandardTable';

// Define the types locally
interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName?: string;
}

interface AbacusCourse {
  id: number;
  code: string;
  name: string;
}

interface AbacusModule {
  id: number;
  title: string;
  index: number;
}

interface AbacusLevel {
  id: number;
  name: string;
  order: number;
}

interface AbacusEnrollment {
  id: number;
  studentId: number;
  courseId: number;
  currentModuleId?: number;
  currentLevelId?: number;
  status: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  
  // Flattened related data from the API response
  studentCode: string;
  studentFirstName: string;
  studentLastName?: string;
  courseCode: string;
  courseName: string;
  moduleId?: number;
  moduleTitle?: string;
  moduleIndex?: number;
  levelId?: number;
  levelName?: string;
  levelOrder?: number;
}

const AbacusEnrollments: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [enrollments, setEnrollments] = useState<AbacusEnrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<AbacusCourse[]>([]);
  const [modules, setModules] = useState<AbacusModule[]>([]);
  const [levels, setLevels] = useState<AbacusLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [enrollmentToDelete, setEnrollmentToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    studentId: 0,
    courseId: 0,
    currentModuleId: null as number | null,
    currentLevelId: null as number | null,
    status: 'ONGOING',
    notes: ''
  });
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Get permissions based on user role
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.SUPERADMIN : FRONTEND_PERMISSIONS.SUPERADMIN;
  const hasPermission = (perm: string) => {
    // Prefer explicit permissions array on the user; otherwise fall back to role-based frontend permissions map
    const permsList = (user as any)?.permissions;
    if (Array.isArray(permsList) && permsList.includes(perm)) {
      return true;
    }
    return (permissions as any)?.[perm] === true;
  };

  const canViewEnrollments =
    hasPermission('abacus.enrollment.view_all') ||
    hasPermission('abacus.enrollment.view_center');

  const canCreateEnrollments =
    hasPermission('abacus.enrollment.create_any') ||
    hasPermission('abacus.enrollment.create_center');

  const canUpdateEnrollments =
    hasPermission('abacus.enrollment.update_any') ||
    hasPermission('abacus.enrollment.update_center');

  // Check if user has permission to access this page
  useEffect(() => {
    if (user && (!permissions.showAbacusEnrollmentsPage || !canViewEnrollments)) {
      setError('You do not have access to view enrollments.');
      setLoading(false);
    }
  }, [user, permissions, canViewEnrollments]);

  // Fetch enrollments, students, and courses
  useEffect(() => {
    if (!user || !permissions.showAbacusEnrollmentsPage || !canViewEnrollments) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchEnrollments(),
      fetchStudents(),
      fetchCourses()
    ]).finally(() => {
      setLoading(false);
    });
  }, [user, permissions, canViewEnrollments]);

  const fetchEnrollments = async () => {
    try {
      const data = await apiClient.get('/superadmin/abacus/enrollments');
      setEnrollments(data);
      setError(null);
    } catch (err) {
      setError('Failed to load enrollments');
      console.error('Error fetching enrollments:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiClient.get('/superadmin/abacus/students');
      setStudents(data);
      setError(null);
    } catch (err) {
      setError('Failed to load students');
      console.error('Error fetching students:', err);
    }
  };

  const fetchCourses = async () => {
    // Try direct course fetch (now allowed for center roles); fall back to deriving from enrollments
    try {
      const data = await apiClient.get('/superadmin/abacus/courses');
      setCourses(data);
      setError(null);
      return;
    } catch (err) {
      console.error('Direct course fetch failed, falling back to derived list:', err);
      // continue to fallback below
    }

    // Fallback: derive course list from enrollments the user can see
    try {
      const enrollmentData = enrollments.length > 0 ? enrollments : await apiClient.get('/superadmin/abacus/enrollments');
      const courseMap = new Map<string, AbacusCourse>();
      enrollmentData.forEach((enrollment: any) => {
        if (enrollment.courseCode && enrollment.courseName && !courseMap.has(enrollment.courseCode)) {
          courseMap.set(enrollment.courseCode, {
            id: enrollment.courseId,
            code: enrollment.courseCode,
            name: enrollment.courseName,
          });
        }
      });
      setCourses(Array.from(courseMap.values()));
      setError(null);
    } catch (err) {
      setError('Failed to load courses');
      console.error('Error fetching courses (derived from enrollments):', err);
    }
  };

  const fetchModulesByCourse = async (courseId: number) => {
    try {
      const data = await apiClient.get(`/superadmin/abacus/courses/${courseId}/modules`);
      setModules(data);
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  };

  const fetchLevelsByModule = async (moduleId: number) => {
    try {
      const data = await apiClient.get(`/superadmin/abacus-levels?moduleId=${moduleId}`);
      setLevels(data);
    } catch (err) {
      console.error('Error fetching levels:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // For status and notes fields, we don't want to parse as integer
    if (name === 'status' || name === 'notes') {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      // For numeric fields, parse as integer
      const parsedValue = value ? parseInt(value) : null;
      
      setFormData(prev => ({
        ...prev,
        [name]: parsedValue
      }));

      // If course is selected, fetch modules
      if (name === 'courseId' && parsedValue) {
        fetchModulesByCourse(parsedValue);
        // Clear modules and levels when course changes
        setModules([]);
        setLevels([]);
        // Clear current module and level selections
        setFormData(prev => ({
          ...prev,
          currentModuleId: null,
          currentLevelId: null
        }));
      }

      // If module is selected, fetch levels
      if (name === 'currentModuleId' && parsedValue) {
        fetchLevelsByModule(parsedValue);
        // Clear level selection when module changes
        setFormData(prev => ({
          ...prev,
          currentLevelId: null
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const newEnrollment = await apiClient.post('/superadmin/abacus/enrollments', {
        ...formData,
        currentModuleId: formData.currentModuleId ?? undefined,
        currentLevelId: formData.currentLevelId ?? undefined
      });
      
      setEnrollments(prev => [newEnrollment, ...prev]);
      setShowModal(false);
      setFormData({
        studentId: 0,
        courseId: 0,
        currentModuleId: null,
        currentLevelId: null,
        status: 'ONGOING',
        notes: ''
      });
      showToast('Enrollment created successfully', 'success');
    } catch (err: any) {
      console.error('Error creating enrollment:', err);
      showToast(err.response?.data?.error || 'Failed to create enrollment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setEnrollmentToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!enrollmentToDelete) return;
    
    try {
      await apiClient.delete(`/superadmin/abacus/enrollments/${enrollmentToDelete}`);
      setEnrollments(prev => prev.filter(enrollment => enrollment.id !== enrollmentToDelete));
      setShowDeleteDialog(false);
      setEnrollmentToDelete(null);
      showToast('Enrollment deleted successfully', 'success');
    } catch (err: any) {
      console.error('Error deleting enrollment:', err);
      showToast(err.response?.data?.error || 'Failed to delete enrollment', 'error');
      setShowDeleteDialog(false);
      setEnrollmentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setEnrollmentToDelete(null);
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const updatedEnrollment = await apiClient.put(`/superadmin/abacus/enrollments/${id}`, {
        status: newStatus
      });
      
      setEnrollments(prev => 
        prev.map(enrollment => 
          enrollment.id === id ? { ...enrollment, ...updatedEnrollment } : enrollment
        )
      );
    } catch (err) {
      console.error('Error updating enrollment status:', err);
      alert('Failed to update enrollment status');
    }
  };

  const handleViewProgress = async (id: number) => {
    setProgressLoading(true);
    setShowProgressModal(true);
    
    try {
      const data = await apiClient.get(`/superadmin/abacus/enrollments/${id}/progress`);
      setProgressData(data);
    } catch (err) {
      console.error('Error fetching enrollment progress:', err);
      alert('Failed to load enrollment progress');
    } finally {
      setProgressLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedEnrollments = () => {
    if (!sortConfig) return enrollments;
    
    return [...enrollments].sort((a, b) => {
      let aValue, bValue;
      
      // Handle special sorting cases
      switch (sortConfig.key) {
        case 'student':
          aValue = `${a.studentFirstName} ${a.studentLastName || ''}`.toLowerCase();
          bValue = `${b.studentFirstName} ${b.studentLastName || ''}`.toLowerCase();
          break;
        case 'course':
          aValue = `${a.courseCode} ${a.courseName}`.toLowerCase();
          bValue = `${b.courseCode} ${b.courseName}`.toLowerCase();
          break;
        case 'currentModule':
          aValue = a.moduleTitle ? a.moduleTitle.toLowerCase() : '';
          bValue = b.moduleTitle ? b.moduleTitle.toLowerCase() : '';
          break;
        case 'currentLevel':
          aValue = a.levelName ? a.levelName.toLowerCase() : '';
          bValue = b.levelName ? b.levelName.toLowerCase() : '';
          break;
        case 'startDate':
          aValue = new Date(a.startDate).getTime();
          bValue = new Date(b.startDate).getTime();
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        default:
          // @ts-ignore
          aValue = a[sortConfig.key];
          // @ts-ignore
          bValue = b[sortConfig.key];
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
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
        <div className="card">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Abacus Enrollments</h1>
        {canCreateEnrollments && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Add New Enrollment
          </button>
        )}
      </div>

      <StandardTable
        headers={[
          { key: 'student', label: 'Student', sortable: true },
          { key: 'course', label: 'Course', sortable: true },
          { key: 'currentModule', label: 'Current Module', sortable: true },
          { key: 'currentLevel', label: 'Current Level', sortable: true },
          { key: 'status', label: 'Status', sortable: true },
          { key: 'startDate', label: 'Start Date', sortable: true },
          { key: 'actions', label: 'Actions' }
        ]}
        data={getSortedEnrollments()}
        sortConfig={sortConfig}
        onSort={handleSort}
        renderCell={(enrollment, headerKey) => {
          switch (headerKey) {
            case 'student':
              return (
                <>
                  <div>{enrollment.studentCode}</div>
                  <div className="small">{enrollment.studentFirstName} {enrollment.studentLastName}</div>
                </>
              );
            case 'course':
              return (
                <>
                  <div>{enrollment.courseCode}</div>
                  <div className="small">{enrollment.courseName}</div>
                </>
              );
            case 'currentModule':
              return enrollment.moduleTitle ? (
                <>
                  <div>{enrollment.moduleTitle}</div>
                  <div className="small">Module {enrollment.moduleIndex}</div>
                </>
              ) : '-';
            case 'currentLevel':
              return enrollment.levelName ? (
                <>
                  <div>{enrollment.levelName}</div>
                  <div className="small">Level {enrollment.levelOrder}</div>
                </>
              ) : '-';
            case 'status':
              return (
                <span
                  className={
                    enrollment.status === 'COMPLETED'
                      ? 'badge badge-success'
                      : enrollment.status === 'ONGOING'
                        ? 'badge badge-neutral'
                        : 'badge badge-warning'
                  }
                >
                  {enrollment.status}
                </span>
              );
            case 'startDate':
              return new Date(enrollment.startDate).toLocaleDateString();
            case 'actions':
              return (
                <>
                  {permissions.canUpdateProgress && (
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStatusChange(enrollment.id, enrollment.status === 'ONGOING' ? 'COMPLETED' : 'ONGOING')}
                      disabled={!canUpdateEnrollments}
                    >
                      {enrollment.status === 'ONGOING' ? 'Complete' : 'Reopen'}
                    </button>
                  )}
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleViewProgress(enrollment.id)}
                  >
                    View Progress
                  </button>
                  {canUpdateEnrollments && (
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteClick(enrollment.id)}
                    >
                      Delete
                    </button>
                  )}
                </>
              );
            default:
              return null;
          }
        }}
      />

      {/* Add Enrollment Modal */}
      {showModal && canCreateEnrollments && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New Enrollment</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="studentId">Student *</label>
                <select
                  id="studentId"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.code} - {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="courseId">Course *</label>
                <select
                  id="courseId"
                  name="courseId"
                  value={formData.courseId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="currentModuleId">Current Module</label>
                <select
                  id="currentModuleId"
                  name="currentModuleId"
                  value={formData.currentModuleId || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select Module</option>
                  {modules.map(module => (
                    <option key={module.id} value={module.id}>
                      {module.title} (Module {module.index})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="currentLevelId">Current Level</label>
                <select
                  id="currentLevelId"
                  name="currentLevelId"
                  value={formData.currentLevelId || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select Level</option>
                  {levels.map(level => (
                    <option key={level.id} value={level.id}>
                      {level.name} (Level {level.order})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      Saving...
                    </div>
                  ) : (
                    'Create Enrollment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Enrollment Progress</h2>
              <button className="close-button" onClick={() => setShowProgressModal(false)}>×</button>
            </div>
            
            {progressLoading ? (
              <div className="modal-body">Loading progress...</div>
            ) : progressData ? (
              <div className="modal-body">
                {/* Enrollment Summary */}
                <div className="progress-section">
                  <h3>Enrollment Summary</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Student:</label>
                      <span>{progressData.studentCode} - {progressData.studentFirstName} {progressData.studentLastName || ''}</span>
                    </div>
                    <div className="summary-item">
                      <label>Course:</label>
                      <span>{progressData.courseCode} - {progressData.courseName}</span>
                    </div>
                    <div className="summary-item">
                      <label>Status:</label>
                      <span className={progressData.status === 'COMPLETED' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {progressData.status}
                      </span>
                    </div>
                    <div className="summary-item">
                      <label>Start Date:</label>
                      <span>{new Date(progressData.startDate).toLocaleDateString()}</span>
                    </div>
                    {progressData.endDate && (
                      <div className="summary-item">
                        <label>End Date:</label>
                        <span>{new Date(progressData.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Module & Level */}
                <div className="progress-section">
                  <h3>Current Position</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Current Module:</label>
                      <span>
                        {progressData.moduleTitle ? 
                          `${progressData.moduleTitle} (Module ${progressData.moduleIndex})` : 
                          'Not assigned'}
                      </span>
                    </div>
                    <div className="summary-item">
                      <label>Current Level:</label>
                      <span>
                        {progressData.levelName ? 
                          `${progressData.levelName} (Level ${progressData.levelOrder})` : 
                          'Not assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Last 5 Assessments */}
                <div className="progress-section">
                  <h3>Recent Assessments</h3>
                  {progressData.assessments && progressData.assessments.length > 0 ? (
                    <table className="assessments-table">
                      <thead>
                        <tr>
                          <th>Level</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressData.assessments.slice(0, 5).map((assessment: any) => (
                          <tr key={assessment.id}>
                            <td>{assessment.levelName} (L{assessment.levelOrder})</td>
                            <td>{assessment.scorePercent}%</td>
                            <td>
                              <span className={assessment.passed ? 'badge badge-success' : 'badge badge-danger'}>
                                {assessment.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                            <td>{new Date(assessment.attemptDate).toLocaleDateString()}</td>
                            <td>{assessment.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No assessments found for this enrollment.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="modal-body">Failed to load progress data.</div>
            )}
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProgressModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title="Delete Enrollment"
        message="Are you sure you want to delete this enrollment? This action cannot be undone."
        confirmText="Yes, delete enrollment"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default AbacusEnrollments;
