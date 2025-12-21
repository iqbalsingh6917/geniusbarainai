import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

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

const TeacherSchedule: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch teacher's schedules
      const response = await apiClient.get('/api/schedule/teacher');
      setSchedules(Array.isArray(response) ? response : []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      setError(err.response?.data?.error || 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const groupSchedulesByDay = () => {
    const grouped: Record<number, Schedule[]> = {};
    if (Array.isArray(schedules)) {
      schedules.forEach(schedule => {
        if (!grouped[schedule.dayOfWeek]) {
          grouped[schedule.dayOfWeek] = [];
        }
        grouped[schedule.dayOfWeek].push(schedule);
      });
    }
    return grouped;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const groupedSchedules = groupSchedulesByDay();

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>My Schedule</h2>
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
                  <th>Room</th>
                  <th>Notes</th>
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
                    <td>{schedule.room || '-'}</td>
                    <td>{schedule.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default TeacherSchedule;
