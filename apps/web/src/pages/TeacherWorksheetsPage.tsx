import React, { useState, useEffect } from 'react';
import { fetchTeacherWorksheets } from '../api/teacherClient';
import { useToast } from '../contexts/ToastContext';

const TeacherWorksheetsPage: React.FC = () => {
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const loadWorksheets = async () => {
      try {
        const data = await fetchTeacherWorksheets();
        setWorksheets(data);
      } catch (err) {
        console.error('Failed to fetch worksheets:', err);
        setError('Failed to load worksheets');
        showToast('Failed to load worksheets', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadWorksheets();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Worksheets</h1>
        <div className="bg-white rounded-lg shadow p-6">
          Loading worksheets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Worksheets</h1>
        <div className="bg-white rounded-lg shadow p-6 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Worksheets</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Course
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Level
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difficulty
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Questions
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {worksheets.map((worksheet) => (
              <tr key={worksheet.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {worksheet.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.courseCode} - {worksheet.courseName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.moduleTitle} (Module {worksheet.moduleIndex})
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.levelName} (Level {worksheet.levelOrder})
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.kind}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.difficultyBand || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.questionCount || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.assignedCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {worksheet.completedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherWorksheetsPage;