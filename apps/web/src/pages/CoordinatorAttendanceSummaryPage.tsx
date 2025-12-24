import React, { useState, useEffect } from 'react';
import { CoordinatorAttendanceSummary, fetchCoordinatorAttendanceSummary } from '../api/coordinatorClient';
import Skeleton from '../components/ui/Skeleton';

const CoordinatorAttendanceSummaryPage: React.FC = () => {
  const [attendanceSummary, setAttendanceSummary] = useState<CoordinatorAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttendanceSummary = async () => {
      try {
        setLoading(true);
        const data = await fetchCoordinatorAttendanceSummary();
        setAttendanceSummary(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load attendance summary', err);
        setError('Failed to load attendance summary');
      } finally {
        setLoading(false);
      }
    };

    loadAttendanceSummary();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Attendance Summary</h1>
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
        <h1 className="text-2xl font-bold mb-6">Attendance Summary</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Attendance Summary</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Center</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Students</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Attendance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attendanceSummary.map((summary) => (
              <tr key={summary.centerName}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{summary.centerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{summary.totalStudents}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{summary.recentAttendanceCount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {summary.totalStudents > 0 
                    ? `${((summary.recentAttendanceCount / summary.totalStudents) * 100).toFixed(2)}%` 
                    : '0%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attendanceSummary.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          No attendance summary data found for your assigned centers.
        </div>
      )}
    </div>
  );
};

export default CoordinatorAttendanceSummaryPage;