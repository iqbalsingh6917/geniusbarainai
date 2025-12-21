import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

interface Teacher {
  id: number;
  username: string;
  fullName: string;
}

interface Student {
  id: number;
  code: string;
  fullName: string;
}

interface TeacherAssignment {
  id: number;
  teacherUserId: number;
  teacherName: string;
  studentId: number;
  studentName: string;
  enrollmentId: number | null;
}

interface WorksheetAssignment {
  id: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string | null;
  submittedAt: string | null;
  notes: string | null;
  student: { id: number; code: string; name: string };
  worksheet: { id: number; title: string; kind: string; difficultyBand: string | null; questionCount: number | null };
  course: { code: string; name: string };
  module: { id: number; name: string; index: number };
  level: { id: number; name: string; order: number };
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

const CenterTeacherAssignments: React.FC = () => {
  const { showToast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

  const [worksheetAssignments, setWorksheetAssignments] = useState<WorksheetAssignment[]>([]);
  const [worksheetLoading, setWorksheetLoading] = useState(true);
  const [worksheetModalOpen, setWorksheetModalOpen] = useState(false);
  const [worksheetCatalog, setWorksheetCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [savingWorksheet, setSavingWorksheet] = useState(false);
  const [updatingWorksheetId, setUpdatingWorksheetId] = useState<number | null>(null);

  useEffect(() => {
    fetchCoreData();
    fetchWorksheetAssignments();
  }, []);

  const fetchCoreData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/teacher-assignments/center');
      setTeachers(data.teachers || []);
      setStudents(data.students || []);
      setTeacherAssignments(data.assignments || []);
      setError(null);
    } catch (err) {
      setError('Failed to load teacher assignments data');
      console.error('Error fetching teacher assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorksheetAssignments = async () => {
    try {
      setWorksheetLoading(true);
      const data = await apiClient.get('/api/worksheet-assignments/center');
      setWorksheetAssignments(data || []);
    } catch (err) {
      showToast('Unable to load worksheet assignments', 'error');
    } finally {
      setWorksheetLoading(false);
    }
  };

  const openTeacherModal = (student: Student) => {
    setSelectedStudent(student);
    const currentAssignment = teacherAssignments.find((a) => a.studentId === student.id);
    setSelectedTeacherId(currentAssignment ? currentAssignment.teacherUserId : null);
    setAssignModalOpen(true);
  };

  const closeTeacherModal = () => {
    setAssignModalOpen(false);
    setSelectedStudent(null);
    setSelectedTeacherId(null);
  };

  const handleTeacherAssign = async () => {
    if (!selectedStudent || !selectedTeacherId) return;
    try {
      setSavingTeacher(true);
      await apiClient.post('/api/teacher-assignments', {
        teacherUserId: selectedTeacherId,
        studentId: selectedStudent.id,
      });
      await fetchCoreData();
      showToast('Teacher assigned successfully', 'success');
      closeTeacherModal();
    } catch (err) {
      const message = 'Failed to assign teacher to student';
      setError(message);
      console.error('Error assigning teacher:', err);
      showToast(message, 'error');
    } finally {
      setSavingTeacher(false);
    }
  };

  const handleTeacherUnassign = async (assignmentId: number) => {
    if (!window.confirm('Remove this teacher assignment?')) return;
    try {
      await apiClient.delete(`/api/teacher-assignments/${assignmentId}`);
      await fetchCoreData();
      showToast('Teacher assignment removed successfully', 'success');
    } catch (err) {
      const message = 'Failed to remove teacher assignment';
      setError(message);
      console.error('Error removing assignment:', err);
      showToast(message, 'error');
    }
  };

  const resetWorksheetForm = () => {
    setSelectedCourseCode('');
    setSelectedModuleId(null);
    setSelectedLevelId(null);
    setSelectedWorksheetId(null);
    setDueDate('');
    setNotes('');
  };

  const primeWorksheetSelections = (catalog: CatalogResponse) => {
    const firstCourse = catalog.courses?.[0];
    const firstModule = firstCourse?.modules?.[0];
    const firstLevel = firstModule?.levels?.[0];
    const firstWorksheet = firstLevel?.worksheets?.[0];
    setSelectedCourseCode(firstCourse?.courseCode || '');
    setSelectedModuleId(firstModule?.moduleId ?? null);
    setSelectedLevelId(firstLevel?.levelId ?? null);
    setSelectedWorksheetId(firstWorksheet?.id ?? null);
    setDueDate('');
    setNotes('');
  };

  const openWorksheetModal = async (student: Student) => {
    setSelectedStudent(student);
    setWorksheetModalOpen(true);
    resetWorksheetForm();
    try {
      setCatalogLoading(true);
      const catalog = await apiClient.get(`/api/worksheet-assignments/catalog/${student.id}`);
      setWorksheetCatalog(catalog);
      primeWorksheetSelections(catalog);
    } catch (err) {
      showToast('Unable to load worksheet catalog', 'error');
      setWorksheetCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
    await fetchWorksheetAssignments();
  };

  const closeWorksheetModal = () => {
    setWorksheetModalOpen(false);
    setSelectedStudent(null);
    setWorksheetCatalog(null);
    resetWorksheetForm();
  };

  const selectedCourse = useMemo(
    () => worksheetCatalog?.courses.find((c) => c.courseCode === selectedCourseCode) || null,
    [worksheetCatalog, selectedCourseCode]
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

  const handleWorksheetAssign = async () => {
    if (!selectedStudent || !selectedWorksheetId) {
      showToast('Please pick a worksheet to assign', 'error');
      return;
    }
    try {
      setSavingWorksheet(true);
      await apiClient.post('/api/worksheet-assignments', {
        studentId: selectedStudent.id,
        worksheetId: selectedWorksheetId,
        enrollmentId: selectedCourse?.enrollmentId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes || undefined,
      });
      showToast('Worksheet assigned', 'success');
      await fetchWorksheetAssignments();
    } catch (err: any) {
      showToast(err?.message || 'Failed to assign worksheet', 'error');
    } finally {
      setSavingWorksheet(false);
    }
  };

  const handleWorksheetStatusChange = async (assignmentId: number, status: WorksheetAssignment['status']) => {
    try {
      setUpdatingWorksheetId(assignmentId);
      await apiClient.put(`/api/worksheet-assignments/${assignmentId}`, { status });
      await fetchWorksheetAssignments();
      showToast('Status updated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingWorksheetId(null);
    }
  };

  const handleWorksheetDelete = async (assignmentId: number) => {
    if (!window.confirm('Delete this worksheet assignment?')) return;
    try {
      await apiClient.delete(`/api/worksheet-assignments/${assignmentId}`);
      await fetchWorksheetAssignments();
      showToast('Assignment deleted', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete assignment', 'error');
    }
  };

  const assignedCount = students.filter((student) =>
    teacherAssignments.some((a) => a.studentId === student.id)
  ).length;
  const unassignedCount = students.length - assignedCount;

  const studentAssignments = (studentId: number) =>
    worksheetAssignments.filter((a) => a.student.id === studentId);

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
          <h1 className="card-title" style={{ fontSize: '1.25rem' }}>Teacher & Worksheet Assignments</h1>
          <div className="muted">Manage teacher ownership and homework assignments for your center.</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="muted">Teachers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{teachers.length}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Students</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{students.length}</div>
          </div>
          <div className="stat-card">
            <div className="muted">Assignments</div>
            <div>
              <span className="badge badge-success" style={{ marginRight: '0.35rem' }}>{assignedCount} assigned</span>
              <span className="badge badge-neutral">{unassignedCount} unassigned</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Students</div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Teacher</th>
                <th>Worksheet assignments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const teacherAssignment = teacherAssignments.find((a) => a.studentId === student.id);
                const worksheetCount = studentAssignments(student.id).length;
                return (
                  <tr key={student.id}>
                    <td>{student.code}</td>
                    <td>{student.fullName}</td>
                    <td>
                      {teacherAssignment ? (
                        <div>
                          <div>{teacherAssignment.teacherName}</div>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleTeacherUnassign(teacherAssignment.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge-neutral">Unassigned</span>
                      )}
                    </td>
                    <td>{worksheetCount} active</td>
                    <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => openTeacherModal(student)}>
                        Assign teacher
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openWorksheetModal(student)}>
                        Assign worksheet
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All worksheet assignments ({worksheetAssignments.length})</div>
        </div>
        {worksheetLoading ? (
          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
            <LoadingSpinner size="md" />
          </div>
        ) : worksheetAssignments.length === 0 ? (
          <div className="muted">No worksheet assignments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Worksheet</th>
                  <th>Course / Module / Level</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {worksheetAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <div>{assignment.student.name}</div>
                      <div className="muted">{assignment.student.code}</div>
                    </td>
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
                    <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {assignment.status !== 'IN_PROGRESS' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleWorksheetStatusChange(assignment.id, 'IN_PROGRESS')}
                          disabled={updatingWorksheetId === assignment.id}
                        >
                          Mark in progress
                        </button>
                      )}
                      {assignment.status !== 'COMPLETED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleWorksheetStatusChange(assignment.id, 'COMPLETED')}
                          disabled={updatingWorksheetId === assignment.id}
                        >
                          Mark completed
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleWorksheetDelete(assignment.id)}>
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

      {assignModalOpen && selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: 'min(520px, 100%)' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Assign teacher</div>
                <div className="muted">{selectedStudent.code} · {selectedStudent.fullName}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeTeacherModal}>Close</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Select teacher</label>
              <select
                className="form-control"
                value={selectedTeacherId ?? ''}
                onChange={(e) => setSelectedTeacherId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">Choose a teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName} ({teacher.username})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleTeacherAssign} disabled={savingTeacher}>
                {savingTeacher ? 'Saving...' : 'Save assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {worksheetModalOpen && selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: 'min(900px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Assign worksheet</div>
                <div className="muted">{selectedStudent.code} · {selectedStudent.fullName}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeWorksheetModal}>Close</button>
            </div>

            {catalogLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : worksheetCatalog && worksheetCatalog.courses.length > 0 ? (
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
                      {worksheetCatalog.courses.map((course) => (
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
                  <button className="btn btn-primary" onClick={handleWorksheetAssign} disabled={savingWorksheet}>
                    {savingWorksheet ? 'Assigning...' : 'Assign worksheet'}
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
              {worksheetLoading ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <LoadingSpinner size="md" />
                </div>
              ) : studentAssignments(selectedStudent.id).length === 0 ? (
                <div className="muted">No assignments yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Worksheet</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentAssignments(selectedStudent.id).map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <div>{assignment.worksheet.title}</div>
                            <div className="muted">{assignment.worksheet.kind}</div>
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
                                onClick={() => handleWorksheetStatusChange(assignment.id, 'IN_PROGRESS')}
                                disabled={updatingWorksheetId === assignment.id}
                              >
                                Mark in progress
                              </button>
                            )}
                            {assignment.status !== 'COMPLETED' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleWorksheetStatusChange(assignment.id, 'COMPLETED')}
                                disabled={updatingWorksheetId === assignment.id}
                              >
                                Mark completed
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleWorksheetDelete(assignment.id)}
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
    </div>
  );
};

export default CenterTeacherAssignments;
