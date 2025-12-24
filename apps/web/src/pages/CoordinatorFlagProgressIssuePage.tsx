import React, { useState } from 'react';
import { flagProgressIssue, fetchCoordinatorStudents } from '../api/coordinatorClient';
import { useToast } from '../contexts/ToastContext';

const CoordinatorFlagProgressIssuePage: React.FC = () => {
  const [studentId, setStudentId] = useState<number | ''>('');
  const [enrollmentId, setEnrollmentId] = useState<number | ''>('');
  const [issueType, setIssueType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loadStudents, setLoadStudents] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { showToast } = useToast();

  const issueTypes = [
    'Low Performance',
    'Slow Progress',
    'Not Meeting Milestones',
    'High Absenteeism',
    'Other'
  ];

  const handleLoadStudents = async () => {
    try {
      setLoadStudents(true);
      const data = await fetchCoordinatorStudents();
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students', err);
      showToast('Failed to load students', 'error');
    } finally {
      setLoadStudents(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId || !enrollmentId || !issueType) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      await flagProgressIssue({
        studentId: Number(studentId),
        enrollmentId: Number(enrollmentId),
        issueType,
        description
      });
      
      setSubmitSuccess(true);
      showToast('Progress issue flagged successfully', 'success');
      
      // Reset form
      setStudentId('');
      setEnrollmentId('');
      setIssueType('');
      setDescription('');
    } catch (err) {
      console.error('Failed to flag progress issue', err);
      showToast('Failed to flag progress issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Flag Progress Issue</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(Number(e.target.value) || '')}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.code} - {student.firstName} {student.lastName} ({student.centerName})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLoadStudents}
                  disabled={loadStudents}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  {loadStudents ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enrollment ID <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={enrollmentId}
                onChange={(e) => setEnrollmentId(Number(e.target.value) || '')}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter enrollment ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select an issue type</option>
                {issueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional details about the progress issue..."
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Flag Issue'}
            </button>
          </div>
        </form>

        {submitSuccess && (
          <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            Progress issue flagged successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default CoordinatorFlagProgressIssuePage;