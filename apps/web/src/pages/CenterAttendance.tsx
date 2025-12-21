import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import StandardTable from '../components/ui/StandardTable';

interface Attendance {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  enrollmentId: number | null;
  courseCode: string | null;
  courseName: string | null;
  classDate: string;
  status: string;
  scheduleId: number | null;
  recordedByName: string;
  remarks: string | null;
}

interface Course {
  id: number;
  code: string;
  name: string;
}

const CenterAttendance: React.FC = () => {
  const { showToast } = useToast();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');

  // For attendance entry
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<Record<number, { status: string; remarks: string }>>({});

  useEffect(() => {
    fetchData();
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [date, selectedCourse]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch active students in this center
      const studentResponse = await apiClient.get('/superadmin/abacus/students');
      setStudents(Array.isArray(studentResponse) ? studentResponse.filter((s: any) => s.status === 'ACTIVE') : []);
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
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
    } catch (err: any) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      let url = `/api/attendance/center?date=${date}`;
      if (selectedCourse) {
        url += `&courseCode=${selectedCourse}`;
      }
      
      const response = await apiClient.get(url);
      setAttendances(Array.isArray(response) ? response : []);
      
      // Initialize attendance entries with existing data
      const entries: Record<number, { status: string; remarks: string }> = {};
      if (Array.isArray(response)) {
        response.forEach((att: Attendance) => {
          entries[att.studentId] = {
            status: att.status,
            remarks: att.remarks || ''
          };
        });
      }
      setAttendanceEntries(entries);
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching attendance data:', err);
      setError(err.response?.data?.error || 'Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: number, status: string) => {
    setAttendanceEntries(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const handleRemarksChange = (studentId: number, remarks: string) => {
    setAttendanceEntries(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      // Prepare entries for submission
      const entries = Object.entries(attendanceEntries)
        .filter(([, entry]) => entry.status) // Only submit entries with a status
        .map(([studentId, entry]) => ({
          studentId: parseInt(studentId),
          status: entry.status,
          remarks: entry.remarks || undefined
        }));

      if (entries.length === 0) {
        setError('No attendance records to save');
        showToast('No attendance records to save', 'error');
        return;
      }

      const payload = {
        classDate: date,
        entries
      };

      await apiClient.post('/api/attendance/record', payload);
      
      // Refresh the data
      fetchAttendanceData();
      
      showToast('Attendance saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      const errorMessage = err.response?.data?.error || 'Failed to save attendance';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Center Attendance</h2>
      </div>

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-4">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Course (Optional)</label>
          <select
            className="form-select"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.code}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Schedule (Optional)</label>
          <select
            className="form-select"
            value={selectedSchedule}
            onChange={(e) => setSelectedSchedule(e.target.value)}
          >
            <option value="">All Schedules</option>
            {/* We would populate this with actual schedules */}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <form onSubmit={handleSubmit}>
        <StandardTable
          headers={[
            { key: 'student', label: 'Student' },
            { key: 'course', label: 'Course' },
            { key: 'status', label: 'Status' },
            { key: 'remarks', label: 'Remarks' }
          ]}
          data={students}
          renderCell={(student, headerKey) => {
            const existingAttendance = attendances.find(a => a.studentId === student.id);
            const entry = attendanceEntries[student.id] || { status: '', remarks: '' };
            
            switch (headerKey) {
              case 'student':
                return (
                  <>
                    <strong>{student.code}</strong> - {student.firstName} {student.lastName}
                  </>
                );
              case 'course':
                return existingAttendance 
                  ? `${existingAttendance.courseCode || ''} ${existingAttendance.courseName || ''}`
                  : 'N/A';
              case 'status':
                return (
                  <select
                    className="form-select"
                    value={entry.status}
                    onChange={(e) => handleStatusChange(student.id, e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late</option>
                    <option value="EXCUSED">Excused</option>
                  </select>
                );
              case 'remarks':
                return (
                  <input
                    type="text"
                    className="form-control"
                    value={entry.remarks}
                    onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                    placeholder="Remarks"
                  />
                );
              default:
                return null;
            }
          }}
        />
        
        <div className="mt-3">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2 inline-block" />
                Saving...
              </>
            ) : (
              'Save Attendance'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CenterAttendance;
