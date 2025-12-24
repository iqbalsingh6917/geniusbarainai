import React, { useState, useEffect } from 'react';
import { fetchTeacherSubmissions } from '../api/teacherClient';
import { useToast } from '../contexts/ToastContext';
import { Link } from 'react-router-dom';

const TeacherSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'worksheet' | 'exam'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');
  const { showToast } = useToast();

  useEffect(() => {
    const loadSubmissions = async () => {
      try {
        const data = await fetchTeacherSubmissions(typeFilter, statusFilter);
        setSubmissions(data);
      } catch (err) {
        console.error('Failed to fetch submissions:', err);
        setError('Failed to load submissions');
        showToast('Failed to load submissions', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadSubmissions();
  }, [typeFilter, statusFilter]);

  const handleFilterChange = () => {
    const loadSubmissions = async () => {
      try {
        const data = await fetchTeacherSubmissions(typeFilter, statusFilter);
        setSubmissions(data);
      } catch (err) {
        console.error('Failed to fetch submissions:', err);
        setError('Failed to load submissions');
        showToast('Failed to load submissions', 'error');
      }
    };

    loadSubmissions();
  };

  useEffect(() => {
    handleFilterChange();
  }, [typeFilter, statusFilter]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Submissions</h1>
        <div className="bg-white rounded-lg shadow p-6">
          Loading submissions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Submissions</h1>
        <div className="bg-white rounded-lg shadow p-6 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Submissions</h1>
      
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="worksheet">Worksheets</option>
            <option value="exam">Exams</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Review</option>
            <option value="graded">Graded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignment
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted At
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.map((submission) => (
              <tr key={`${submission.type}-${submission.id}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {submission.studentName} {submission.studentCode ? `(${submission.studentCode})` : ''}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {submission.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {submission.type.charAt(0).toUpperCase() + submission.type.slice(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${submission.status === 'GRADED' ? 'bg-green-100 text-green-800' : 
                      submission.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'}`}>
                    {submission.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {submission.teacherAdjustedScore !== null 
                    ? `${submission.teacherAdjustedScore} / ${submission.maxScore || '-'}` 
                    : submission.totalScore !== null 
                      ? `${submission.totalScore} / ${submission.maxScore || '-'}` 
                      : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link 
                    to={`/teacher/submissions/${submission.id}/grade`} 
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {submission.status === 'GRADED' ? 'View' : 'Grade'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherSubmissionsPage;