import React, { useState, useEffect } from 'react';
import { CoordinatorTeacher, fetchCoordinatorTeachers } from '../api/coordinatorClient';
import Skeleton from '../components/ui/Skeleton';

const CoordinatorTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<CoordinatorTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setLoading(true);
        const data = await fetchCoordinatorTeachers();
        setTeachers(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load teachers', err);
        setError('Failed to load teachers');
      } finally {
        setLoading(false);
      }
    };

    loadTeachers();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Teachers</h1>
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
        <h1 className="text-2xl font-bold mb-6">Teachers</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Teachers</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Center</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{teacher.username}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.centerName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {teachers.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          No teachers found for your assigned centers.
        </div>
      )}
    </div>
  );
};

export default CoordinatorTeachersPage;