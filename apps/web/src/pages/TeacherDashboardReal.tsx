import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  AssessmentAnalyticsSummary,
  fetchTeacherAssessmentSummary,
} from '../api/assessmentAnalyticsClient';

type OverviewRow = {
  enrollmentId: number;
  studentName: string;
  courseTitle: string;
  courseCode: string;
  progressPercent: number;
  completedModules: number;
  completedWorksheets: number;
  completedExams: number;
};

type TeacherOverviewResponse = {
  students: OverviewRow[];
};

const TeacherDashboard: React.FC = () => {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentAnalyticsSummary | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = (await apiClient.get('/api/dashboard/teacher/overview')) as any;
        const payload: TeacherOverviewResponse = data?.data ?? data; // handle axios or fetch wrapper
        setRows(payload?.students || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching teacher dashboard overview:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    async function loadAssessments() {
      try {
        setAssessmentLoading(true);
        setAssessmentError(null);
        const res = await fetchTeacherAssessmentSummary();
        setAssessmentSummary(res);
      } catch (err) {
        console.error('Failed to load assessment analytics', err);
        setAssessmentError('Failed to load assessment analytics');
      } finally {
        setAssessmentLoading(false);
      }
    }
    loadAssessments();
  }, []);

  const renderStatusBadge = (progress: number) => {
    if (progress >= 100) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>;
    }
    if (progress > 0) {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In progress</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Not started</span>;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">My Assessments</h2>
            {assessmentLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {assessmentError && <p className="text-sm text-red-600">{assessmentError}</p>}
            {assessmentSummary && !assessmentLoading && !assessmentError && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">Exams</h3>
                  <div>Completed: {assessmentSummary.exam.completedAttempts}</div>
                  <div>Avg score: {assessmentSummary.exam.avgScorePercent ?? '-'}%</div>
                  <div>Pass rate: {assessmentSummary.exam.passRatePercent ?? '-'}%</div>
                </div>
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">Worksheets</h3>
                  <div>Completed: {assessmentSummary.worksheet.completedAttempts}</div>
                  <div>Avg score: {assessmentSummary.worksheet.avgScorePercent ?? '-'}%</div>
                  <div>Pass rate: {assessmentSummary.worksheet.passRatePercent ?? '-'}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Assigned Students</h2>
              <span className="text-sm text-gray-500">Total: {rows.length}</span>
            </div>
            {rows.length === 0 ? (
            <p className="text-gray-500">No enrollments found for your org unit.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modules
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Worksheets
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exams
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.enrollmentId}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.studentName || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-medium">{row.courseTitle || row.courseCode}</span>
                          <span className="text-xs text-gray-500">{row.courseCode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center space-x-2">
                          <span>{row.progressPercent}%</span>
                          {renderStatusBadge(row.progressPercent)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {row.completedModules}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {row.completedWorksheets}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {row.completedExams}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Link
                          to={`/teacher/enrollments/${row.enrollmentId}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View progress
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherDashboard;
