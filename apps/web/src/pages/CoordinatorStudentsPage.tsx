import React, { useState, useEffect } from 'react';
import { CoordinatorStudent, fetchCoordinatorStudents } from '../api/coordinatorClient';
import Skeleton from '../components/ui/Skeleton';

const CoordinatorStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<CoordinatorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const data = await fetchCoordinatorStudents();
        setStudents(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load students', err);
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Students</h1>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Students</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Students</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Center</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {student.firstName} {student.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.centerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.enrollmentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {students.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          No students found for your assigned centers.
        </div>
      )}
    </div>
  );
};

export default CoordinatorStudentsPage;