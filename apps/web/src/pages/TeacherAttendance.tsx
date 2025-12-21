import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

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
  orgUnitId: number | null;
  createdAt: string;
  updatedAt: string;
}

const TeacherAttendance: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [attendanceEntries, setAttendanceEntries] = useState<Record<number, { status: string; remarks: string }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [date]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch teacher's assigned students
      const studentResponse = await apiClient.get('/api/teacher-assignments/me');
      setStudents(studentResponse.students || []);
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const url = `/api/attendance/me?date=${date}`;
      
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
        return;
      }

      const payload = {
        classDate: date,
        entries
      };

      await apiClient.post('/api/attendance/record', payload);
      
      // Refresh the data
      fetchAttendanceData();
      
      alert('Attendance saved successfully!');
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      setError(err.response?.data?.error || 'Failed to save attendance');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Student Attendance</h2>
      </div>

      {/* Date Picker */}
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
      </div>

      {/* Attendance Table */}
      <form onSubmit={handleSubmit}>
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const existingAttendance = attendances.find(a => a.studentId === student.id);
                const entry = attendanceEntries[student.id] || { status: '', remarks: '' };
                
                return (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.code}</strong> - {student.firstName} {student.lastName}
                    </td>
                    <td>
                      {existingAttendance 
                        ? `${existingAttendance.courseCode || ''} ${existingAttendance.courseName || ''}`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={entry?.status ?? ''}
                        onChange={(e) => handleStatusChange(student.id, e.target.value)}
                      >
                        <option value="">Select Status</option>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="EXCUSED">Excused</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={entry?.remarks ?? ''}
                        onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="mt-3">
          <button type="submit" className="btn btn-primary">
            Save Attendance
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherAttendance;
