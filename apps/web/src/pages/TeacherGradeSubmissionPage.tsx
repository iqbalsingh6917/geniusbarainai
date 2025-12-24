import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gradeSubmission } from '../api/teacherClient';
import { useToast } from '../contexts/ToastContext';

const TeacherGradeSubmissionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submission, setSubmission] = useState<any>(null);
  const [score, setScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>('');
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // In a real implementation, we would fetch the submission details
    // For MVP, we'll simulate having the submission data
    setLoading(false);
    // Set a mock submission for the UI
    setSubmission({
      id: parseInt(id || '0', 10),
      type: 'worksheet', // Could be worksheet or exam
      studentName: 'Student Name',
      studentCode: 'STU001',
      title: 'Sample Assignment Title',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      totalScore: null,
      maxScore: 100,
      teacherAdjustedScore: null,
      teacherComment: null,
      reviewedAt: null
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (score === '') {
      showToast('Score is required', 'error');
      return;
    }
    
    if (maxScore === '') {
      showToast('Max score is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const result = await gradeSubmission(parseInt(id || '0', 10), {
        score: Number(score),
        maxScore: Number(maxScore),
        remarks
      });
      
      showToast(result.message, 'success');
      navigate('/teacher/submissions');
    } catch (err: any) {
      console.error('Failed to grade submission:', err);
      showToast(err?.message || 'Failed to grade submission', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Grade Submission</h1>
        <div className="bg-white rounded-lg shadow p-6">
          Loading submission...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Grade Submission</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Submission Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Student</p>
            <p className="font-medium">
              {submission?.studentName} {submission?.studentCode ? `(${submission.studentCode})` : ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Assignment</p>
            <p className="font-medium">{submission?.title}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Type</p>
            <p className="font-medium">{submission?.type?.charAt(0).toUpperCase() + submission.type?.slice(1)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium">{submission?.status}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Grade Submission</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Score <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter score"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Score <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter max score"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks/Feedback
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter feedback for the student..."
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => navigate('/teacher/submissions')}
              className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherGradeSubmissionPage;