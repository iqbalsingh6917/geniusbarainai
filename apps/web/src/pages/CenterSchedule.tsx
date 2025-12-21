import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

interface Schedule {
  id: number;
  courseCode: string;
  courseName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherUserId: number | null;
  teacherName: string | null;
  room: string | null;
  notes: string | null;
  isActive: boolean;
}

interface Course {
  id: number;
  code: string;
  name: string;
}

interface Teacher {
  id: number;
  username: string;
}

const CenterSchedule: React.FC = () => {
  const { showToast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    courseCode: '',
    dayOfWeek: 0,
    startTime: '',
    endTime: '',
    teacherUserId: '',
    room: '',
    notes: ''
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch schedules
      const scheduleResponse = await apiClient.get('/api/schedule/center');
      setSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : []);

      // Fetch courses from enrollments (centers don't have access to superadmin endpoints)
      const enrollmentResponse = await apiClient.get('/superadmin/abacus/enrollments');
      // Extract unique courses from enrollments
      const courseMap = new Map<string, Course>();
      if (Array.isArray(enrollmentResponse)) {
        enrollmentResponse.forEach((enrollment: any) => {
          if (enrollment.courseCode && enrollment.courseName && !courseMap.has(enrollment.courseCode)) {
            courseMap.set(enrollment.courseCode, {
              id: enrollment.courseId,
              code: enrollment.courseCode,
              name: enrollment.courseName
            });
          }
        });
      }
      setCourses(Array.from(courseMap.values()));

      // Fetch teachers from teacher assignments endpoint
      const teacherResponse = await apiClient.get('/api/teacher-assignments/center');
      setTeachers(teacherResponse.teachers || []);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (schedule: Schedule | null = null) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        courseCode: schedule.courseCode,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        teacherUserId: schedule.teacherUserId?.toString() || '',
        room: schedule.room || '',
        notes: schedule.notes || ''
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        courseCode: '',
        dayOfWeek: 0,
        startTime: '',
        endTime: '',
        teacherUserId: '',
        room: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        dayOfWeek: parseInt(formData.dayOfWeek.toString()),
        teacherUserId: formData.teacherUserId ? parseInt(formData.teacherUserId) : undefined
      };

      if (editingSchedule) {
        // Update existing schedule
        await apiClient.put(`/api/schedule/${editingSchedule.id}`, payload);
      } else {
        // Create new schedule
        await apiClient.post('/api/schedule', payload);
      }

      handleCloseModal();
      fetchData(); // Refresh the data
      showToast(editingSchedule ? 'Schedule updated successfully' : 'Schedule created successfully', 'success');
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      const errorMessage = err.response?.data?.error || 'Failed to save schedule';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await apiClient.delete(`/api/schedule/${id}`);
      fetchData(); // Refresh the data
      showToast('Schedule deactivated successfully', 'success');
    } catch (err: any) {
      console.error('Error deactivating schedule:', err);
      const errorMessage = err.response?.data?.error || 'Failed to deactivate schedule';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  const groupSchedulesByDay = () => {
    const grouped: Record<number, Schedule[]> = {};
    schedules.forEach(schedule => {
      if (!grouped[schedule.dayOfWeek]) {
        grouped[schedule.dayOfWeek] = [];
      }
      grouped[schedule.dayOfWeek].push(schedule);
    });
    return grouped;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const groupedSchedules = groupSchedulesByDay();

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Center Schedule</h2>
        <button className="btn btn-primary" onClick={() => handleShowModal()}>
          Add Session
        </button>
      </div>

      {Object.keys(groupedSchedules).length === 0 ? (
        <p>No schedules found.</p>
      ) : (
        Object.entries(groupedSchedules).map(([day, daySchedules]) => (
          <div key={day} className="mb-5">
            <h4>{dayNames[parseInt(day)]}</h4>
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Teacher</th>
                  <th>Room</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {daySchedules.map(schedule => (
                  <tr key={schedule.id}>
                    <td>{schedule.startTime} - {schedule.endTime}</td>
                    <td>
                      {schedule.courseCode}
                      {schedule.courseName && ` (${schedule.courseName})`}
                    </td>
                    <td>{schedule.teacherName || '-'}</td>
                    <td>{schedule.room || '-'}</td>
                    <td>{schedule.notes || '-'}</td>
                    <td>{schedule.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button 
                        className="btn btn-outline-primary btn-sm me-2"
                        onClick={() => handleShowModal(schedule)}
                      >
                        Edit
                      </button>
                      {schedule.isActive && (
                        <button 
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeactivate(schedule.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Modal for Add/Edit Schedule */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingSchedule ? 'Edit Session' : 'Add Session'}</h5>
                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Course</label>
                    <select
                      className="form-select"
                      name="courseCode"
                      value={formData.courseCode}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.code}>
                          {course.code} - {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Day of Week</label>
                    <select
                      className="form-select"
                      name="dayOfWeek"
                      value={formData.dayOfWeek}
                      onChange={handleChange}
                      required
                    >
                      {dayNames.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Start Time</label>
                    <input
                      type="text"
                      className="form-control"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      placeholder="HH:MM (24-hour format)"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">End Time</label>
                    <input
                      type="text"
                      className="form-control"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      placeholder="HH:MM (24-hour format)"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Teacher (Optional)</label>
                    <select
                      className="form-select"
                      name="teacherUserId"
                      value={formData.teacherUserId}
                      onChange={handleChange}
                    >
                      <option value="">Select Teacher</option>
                      {teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Room (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      name="room"
                      value={formData.room}
                      onChange={handleChange}
                      placeholder="Room number or name"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2 inline-block" />
                        Saving...
                      </>
                    ) : (
                      editingSchedule ? 'Update' : 'Create'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CenterSchedule;
