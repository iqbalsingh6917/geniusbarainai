import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface Enrollment {
  id: number;
  studentId: number;
  studentName: string;
  courseCode: string;
  courseName: string;
  status: string;
  currentModuleTitle: string;
  currentLevelName: string;
}

interface Assignment {
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
  course: { code: string; name: string };
  module: { name: string; index: number };
  level: { name: string; order: number };
}

interface CatalogWorksheet {
  id: number;
  title: string;
  kind: string;
  difficultyBand: string | null;
  questionCount: number | null;
  notes: string | null;
}

interface CatalogLevel {
  levelId: number;
  levelName: string;
  levelOrder: number;
  worksheets: CatalogWorksheet[];
}

interface CatalogModule {
  moduleId: number;
  moduleName: string;
  moduleIndex: number;
  levels: CatalogLevel[];
}

interface CatalogCourse {
  courseId: number;
  courseCode: string;
  courseName: string;
  variant?: string;
  enrollmentId: number;
  modules: CatalogModule[];
}

interface CatalogResponse {
  studentId: number;
  courses: CatalogCourse[];
}

interface AttemptSummary {
  id: number;
  status: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  assignmentId: number | null;
  worksheet: { id: number; title: string };
  course: { code: string; name: string };
  module: { id: number; name: string; index: number };
  level: { id: number; name: string; order: number };
}

const statusBadge = (status: string) => {
  if (status === 'COMPLETED') return 'badge badge-success';
  if (status === 'IN_PROGRESS') return 'badge badge-warning';
  return 'badge badge-neutral';
};

const statusLabel = (status: string) => {
  if (status === 'NOT_STARTED') return 'Not started';
  if (status === 'IN_PROGRESS') return 'In progress';
  return 'Completed';
};

const TeacherMyStudents: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [attemptsModalOpen, setAttemptsModalOpen] = useState(false);
  const [attemptsStudent, setAttemptsStudent] = useState<Student | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/teacher-assignments/me');
      setStudents(data.students || []);
      setEnrollments(data.enrollments || []);
      setError(null);
    } catch (err) {
      setError('Failed to load my students data');
      console.error('Error fetching teacher assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCourseCode('');
    setSelectedModuleId(null);
    setSelectedLevelId(null);
    setSelectedWorksheetId(null);
    setDueDate('');
    setNotes('');
  };

  const fetchAssignments = async (studentId: number) => {
    try {
      setAssignmentsLoading(true);
      const data = await apiClient.get(`/api/worksheet-assignments/teacher?studentId=${studentId}`);
      setAssignments(data || []);
    } catch (err) {
      showToast('Unable to load assignments', 'error');
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchAttemptCount = async (studentId: number) => {
    try {
      const data = await apiClient.get(`/api/teacher/worksheets/attempts/history/${studentId}`);
      setAttemptCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      setAttemptCount(null);
    }
  };

  const fetchAttempts = async (studentId: number) => {
    try {
      setAttemptsLoading(true);
      const data: AttemptSummary[] = await apiClient.get(
        `/api/teacher/worksheets/attempts?studentId=${studentId}`
      );
      setAttempts(data || []);
    } catch (err) {
      showToast('Unable to load attempts', 'error');
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const fetchCatalog = async (studentId: number) => {
    try {
      setCatalogLoading(true);
      const data: CatalogResponse = await apiClient.get(`/api/worksheet-assignments/catalog/${studentId}`);
      setCatalog(data);
      primeSelections(data);
    } catch (err) {
      showToast('Unable to load worksheet catalog', 'error');
      setCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
  };

  const primeSelections = (data: CatalogResponse) => {
    const firstCourse = data.courses?.[0];
    if (!firstCourse) {
      resetForm();
      return;
    }
    const firstModule = firstCourse.modules?.[0];
    const firstLevel = firstModule?.levels?.[0];
    const firstWorksheet = firstLevel?.worksheets?.[0];
    setSelectedCourseCode(firstCourse.courseCode);
    setSelectedModuleId(firstModule?.moduleId ?? null);
    setSelectedLevelId(firstLevel?.levelId ?? null);
    setSelectedWorksheetId(firstWorksheet?.id ?? null);
    setDueDate('');
    setNotes('');
  };

  const openAssignModal = (student: Student) => {
    setSelectedStudent(student);
    setAssignModalOpen(true);
    resetForm();
    fetchCatalog(student.id);
    fetchAssignments(student.id);
    fetchAttemptCount(student.id);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setSelectedStudent(null);
    setCatalog(null);
    setAssignments([]);
    resetForm();
  };

  const openAttemptsModal = (student: Student) => {
    setAttemptsStudent(student);
    setAttemptsModalOpen(true);
    fetchAttempts(student.id);
  };

  const closeAttemptsModal = () => {
    setAttemptsModalOpen(false);
    setAttemptsStudent(null);
    setAttempts([]);
  };

  const selectedCourse = useMemo(
    () => catalog?.courses.find((c) => c.courseCode === selectedCourseCode) || null,
    [catalog, selectedCourseCode]
  );

  const selectedModule = useMemo(
    () => selectedCourse?.modules.find((m) => m.moduleId === selectedModuleId) || null,
    [selectedCourse, selectedModuleId]
  );

  const selectedLevel = useMemo(
    () => selectedModule?.levels.find((l) => l.levelId === selectedLevelId) || null,
    [selectedModule, selectedLevelId]
  );

  useEffect(() => {
    if (selectedCourse && selectedCourse.modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(selectedCourse.modules[0].moduleId);
    }
  }, [selectedCourse, selectedModuleId]);

  useEffect(() => {
    if (selectedModule && selectedModule.levels.length > 0 && !selectedLevelId) {
      setSelectedLevelId(selectedModule.levels[0].levelId);
    }
  }, [selectedModule, selectedLevelId]);

  useEffect(() => {
    if (selectedLevel && selectedLevel.worksheets.length > 0 && !selectedWorksheetId) {
      setSelectedWorksheetId(selectedLevel.worksheets[0].id);
    }
  }, [selectedLevel, selectedWorksheetId]);

  const handleCreateAssignment = async () => {
    if (!selectedStudent) return;
    if (!selectedWorksheetId) {
      showToast('Please pick a worksheet to assign', 'error');
      return;
    }

    const enrollmentId = selectedCourse?.enrollmentId;
    try {
      setSaving(true);
      await apiClient.post('/api/worksheet-assignments', {
        studentId: selectedStudent.id,
        worksheetId: selectedWorksheetId,
        enrollmentId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes || undefined,
      });
      showToast('Worksheet assigned', 'success');
      await fetchAssignments(selectedStudent.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to assign worksheet', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (assignmentId: number, status: Assignment['status']) => {
    try {
      setUpdatingId(assignmentId);
      await apiClient.put(`/api/worksheet-assignments/${assignmentId}`, { status });
      if (selectedStudent) {
        await fetchAssignments(selectedStudent.id);
      }
      showToast('Status updated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!window.confirm('Delete this worksheet assignment?')) return;
    try {
      await apiClient.delete(`/api/worksheet-assignments/${assignmentId}`);
      if (selectedStudent) {
        await fetchAssignments(selectedStudent.id);
      }
      showToast('Assignment deleted', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete assignment', 'error');
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
        <div className="card">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.25rem' }}>My Students</h1>
          <div className="muted">Track students, view enrollments, and assign worksheets.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Students ({students.length})</div>
        </div>
        <div className="overflow-x-auto">
          {students.length === 0 ? (
            <div className="muted">No students assigned to you yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.code}</td>
                    <td>{student.firstName} {student.lastName}</td>
                    <td>
                      <span className={student.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {student.status}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link to={`/teacher/students/${student.id}/dashboard`} className="btn btn-ghost btn-sm">
                        View dashboard
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => openAttemptsModal(student)}>
                        View attempts
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => openAssignModal(student)}>
                        Assign worksheets
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Enrollments ({enrollments.length})</div>
        </div>
        <div className="overflow-x-auto">
          {enrollments.length === 0 ? (
            <div className="muted">No enrollments found for your students.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Current module</th>
                  <th>Current level</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.studentName}</td>
                    <td>
                      <div>{enrollment.courseCode}</div>
                      <div className="muted">{enrollment.courseName}</div>
                    </td>
                    <td>
                      <span
                        className={
                          enrollment.status === 'COMPLETED'
                            ? 'badge badge-success'
                            : enrollment.status === 'ONGOING'
                              ? 'badge badge-warning'
                              : 'badge badge-neutral'
                        }
                      >
                        {enrollment.status}
                      </span>
                    </td>
                    <td>{enrollment.currentModuleTitle || '-'}</td>
                    <td>{enrollment.currentLevelName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {assignModalOpen && selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: 'min(900px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Assign worksheets</div>
                <div className="muted">
                  {selectedStudent.code} - {selectedStudent.firstName} {selectedStudent.lastName}
                </div>
                {attemptCount !== null && (
                  <div className="muted">Existing attempts: {attemptCount}</div>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeAssignModal}>Close</button>
            </div>

            {catalogLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : catalog && catalog.courses.length > 0 ? (
              <>
                <div className="stat-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card">
                    <div className="muted">Course</div>
                    <select
                      className="form-control"
                      value={selectedCourseCode}
                      onChange={(e) => {
                        setSelectedCourseCode(e.target.value);
                        setSelectedModuleId(null);
                        setSelectedLevelId(null);
                        setSelectedWorksheetId(null);
                      }}
                    >
                      {catalog.courses.map((course) => (
                        <option key={course.courseCode} value={course.courseCode}>
                          {course.courseName} ({course.courseCode}{course.variant === 'BEATS20' ? ' · AI-enhanced' : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Module</div>
                    <select
                      className="form-control"
                      value={selectedModuleId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        setSelectedModuleId(val);
                        setSelectedLevelId(null);
                        setSelectedWorksheetId(null);
                      }}
                    >
                      {(selectedCourse?.modules || []).map((module) => (
                        <option key={module.moduleId} value={module.moduleId}>
                          Module {module.moduleIndex}: {module.moduleName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Level</div>
                    <select
                      className="form-control"
                      value={selectedLevelId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        setSelectedLevelId(val);
                        setSelectedWorksheetId(null);
                      }}
                    >
                      {(selectedModule?.levels || []).map((level) => (
                        <option key={level.levelId} value={level.levelId}>
                          Level {level.levelOrder}: {level.levelName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Worksheet</div>
                    <select
                      className="form-control"
                      value={selectedWorksheetId ?? ''}
                      onChange={(e) => setSelectedWorksheetId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    >
                      {(selectedLevel?.worksheets || []).map((worksheet) => (
                        <option key={worksheet.id} value={worksheet.id}>
                          {worksheet.title} ({worksheet.kind})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="stat-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card">
                    <div className="muted">Due date</div>
                    <input
                      type="date"
                      className="form-control"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                    <div className="muted">Notes</div>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Optional notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button className="btn btn-primary" onClick={handleCreateAssignment} disabled={saving}>
                    {saving ? 'Assigning...' : 'Assign worksheet'}
                  </button>
                </div>
              </>
            ) : (
              <div className="muted">No courses found for this student.</div>
            )}

            <div className="card" style={{ background: 'var(--color-bg-soft)' }}>
              <div className="card-header">
                <div className="card-title">Existing assignments</div>
              </div>
              {assignmentsLoading ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <LoadingSpinner size="md" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="muted">No assignments yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Worksheet</th>
                        <th>Course / Module / Level</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <div>{assignment.worksheet.title}</div>
                            <div className="muted">{assignment.worksheet.kind}</div>
                          </td>
                          <td>
                            <div>{assignment.course.code}</div>
                            <div className="muted">
                              Module {assignment.module.index} · Level {assignment.level.order}
                            </div>
                          </td>
                          <td>
                            <span className={statusBadge(assignment.status)}>{statusLabel(assignment.status)}</span>
                          </td>
                          <td>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'}</td>
                          <td className="muted">{assignment.notes || '—'}</td>
                          <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {assignment.status !== 'IN_PROGRESS' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleStatusChange(assignment.id, 'IN_PROGRESS')}
                                disabled={updatingId === assignment.id}
                              >
                                Mark in progress
                              </button>
                            )}
                            {assignment.status !== 'COMPLETED' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleStatusChange(assignment.id, 'COMPLETED')}
                                disabled={updatingId === assignment.id}
                              >
                                Mark completed
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {attemptsModalOpen && attemptsStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: 'min(800px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Worksheet attempts</div>
                <div className="muted">
                  {attemptsStudent.code} - {attemptsStudent.firstName} {attemptsStudent.lastName}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeAttemptsModal}>
                Close
              </button>
            </div>

            {attemptsLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="muted">No attempts yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Worksheet</th>
                      <th>Course / Module / Level</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.worksheet.title}</td>
                        <td>
                          <div>{attempt.course.code}</div>
                          <div className="muted">
                            Module {attempt.module.index} - Level {attempt.level.order}
                          </div>
                        </td>
                        <td>{attempt.status}</td>
                        <td>
                          {attempt.submittedAt
                            ? new Date(attempt.submittedAt).toLocaleString()
                            : '-'}
                        </td>
                        <td>
                          {attempt.totalScore !== null && attempt.maxScore !== null
                            ? `${attempt.totalScore} / ${attempt.maxScore}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherMyStudents;


