import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

// Import the API client
import { apiClient } from '../utils/apiClient';

// Import UI components
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import StandardTable from '../components/ui/StandardTable';

// Define the Student type locally since we're having import issues
interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName?: string;
  age?: number;
  parentName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  enrollmentsCount?: number;
}

const AbacusStudents: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Student>>({
    firstName: '',
    lastName: '',
    age: undefined,
    parentName: '',
    contactPhone: '',
    contactEmail: '',
    status: 'ACTIVE'
  });
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Get permissions based on user role
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.SUPERADMIN : FRONTEND_PERMISSIONS.SUPERADMIN;

  // Check if user has permission to access this page
  useEffect(() => {
    if (user && !permissions.showAbacusStudentsPage) {
      setError('You do not have permission to access this page');
      setLoading(false);
    }
  }, [user, permissions]);

  // Fetch students
  useEffect(() => {
    // Only fetch data if user has permission
    if (user && permissions.showAbacusStudentsPage) {
      fetchStudents();
    }
  }, [user, permissions]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/superadmin/abacus/students');
      setStudents(data);
      setError(null);
    } catch (err) {
      setError('Failed to load students');
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<Student>) => ({
      ...prev,
      [name]: name === 'age' ? (value ? parseInt(value) : undefined) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const newStudent = await apiClient.post('/superadmin/abacus/students', formData);
      setStudents((prev: Student[]) => [newStudent, ...prev]);
      setShowModal(false);
      setFormData({
        firstName: '',
        lastName: '',
        age: undefined,
        parentName: '',
        contactPhone: '',
        contactEmail: '',
        status: 'ACTIVE'
      });
      showToast('Student created successfully', 'success');
    } catch (err: any) {
      console.error('Error creating student:', err);
      showToast(err.response?.data?.error || 'Failed to create student', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setStudentToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    
    try {
      await apiClient.delete(`/superadmin/abacus/students/${studentToDelete}`);
      setStudents((prev: Student[]) => prev.filter(student => student.id !== studentToDelete));
      setShowDeleteDialog(false);
      setStudentToDelete(null);
      showToast('Student deleted successfully', 'success');
    } catch (err: any) {
      console.error('Error deleting student:', err);
      showToast(err.response?.data?.error || 'Failed to delete student', 'error');
      setShowDeleteDialog(false);
      setStudentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setStudentToDelete(null);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedStudents = () => {
    if (!sortConfig) return students;
    
    return [...students].sort((a, b) => {
      // @ts-ignore
      const aValue = a[sortConfig.key];
      // @ts-ignore
      const bValue = b[sortConfig.key];
      
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
        <h1>Abacus Students</h1>
        {permissions.canCreateEditStudents && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Add New Student
          </button>
        )}
      </div>

      <StandardTable
        headers={[
          { key: 'code', label: 'Student Code', sortable: true },
          { key: 'name', label: 'Name', sortable: true },
          { key: 'age', label: 'Age', sortable: true },
          { key: 'status', label: 'Status', sortable: true },
          { key: 'enrollmentsCount', label: 'Enrollments', sortable: true },
          { key: 'actions', label: 'Actions' }
        ]}
        data={getSortedStudents()}
        sortConfig={sortConfig}
        onSort={handleSort}
        renderCell={(student, headerKey) => {
          switch (headerKey) {
            case 'code':
              return student.code;
            case 'name':
              return `${student.firstName} ${student.lastName}`;
            case 'age':
              return student.age || '-';
            case 'status':
              return (
                <span className={student.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-neutral'}>
                  {student.status}
                </span>
              );
            case 'enrollmentsCount':
              return student.enrollmentsCount || 0;
            case 'actions':
              return (
                <>
                  <Link to={`/superadmin/abacus-students/${student.id}`} className="btn btn-secondary btn-sm">
                    View
                  </Link>
                  <Link to={`/superadmin/student-dashboard/${student.id}`} className="btn btn-primary btn-sm" style={{ marginLeft: '0.5rem' }}>
                    View dashboard
                  </Link>
                  {permissions.canCreateEditStudents && (
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteClick(student.id)}
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

      {/* Add Student Modal */}
      {showModal && permissions.canCreateEditStudents && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New Student</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName || ''}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age || ''}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="parentName">Parent Name</label>
                <input
                  type="text"
                  id="parentName"
                  name="parentName"
                  value={formData.parentName || ''}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="contactPhone">Contact Phone</label>
                <input
                  type="text"
                  id="contactPhone"
                  name="contactPhone"
                  value={formData.contactPhone || ''}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="contactEmail">Contact Email</label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  value={formData.contactEmail || ''}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'ACTIVE'}
                  onChange={handleInputChange}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="GRADUATED">Graduated</option>
                </select>
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
                    'Create Student'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title="Delete Student"
        message="Are you sure you want to delete this student? This action cannot be undone."
        confirmText="Yes, delete student"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default AbacusStudents;
