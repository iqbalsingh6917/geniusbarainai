import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import Skeleton from '../components/ui/Skeleton';
import { statusChip } from '../utils/formatters';

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

const TeacherMyEnrollments: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/teacher-assignments/me');
      setEnrollments(data.enrollments);
      setError(null);
    } catch (err) {
      setError('Failed to load my enrollments data');
      console.error('Error fetching teacher enrollments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">My Enrollments</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded shadow p-4">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">My Enrollments</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Enrollments</h1>
      
      {/* Enrollments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Enrollments ({enrollments.length})</h2>
        </div>
        <div className="overflow-x-auto">
          {enrollments.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Module</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Level</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrollments.map(enrollment => (
                  <tr key={enrollment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {enrollment.studentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{enrollment.courseCode}</div>
                      <div className="text-gray-400">{enrollment.courseName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {statusChip(
                        enrollment.status,
                        enrollment.status === 'COMPLETED'
                          ? 'green'
                          : enrollment.status === 'ONGOING'
                          ? 'blue'
                          : 'yellow',
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.currentModuleTitle || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.currentLevelName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-4 text-gray-500">
              No enrollments found for your students.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherMyEnrollments;
