import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Skeleton from '../components/ui/Skeleton';
import { apiClient } from '../utils/apiClient';
import AnomaliesPanel from '../components/ops/AnomaliesPanel';
import RetentionSignalsPanel from '../components/assist/RetentionSignalsPanel';
import { fetchCenterDashboard } from '../api/centerDashboardClient';
import { OrgDashboardSummary } from '../api/bpDashboardClient';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { fetchCenterAssistSignals, RetentionSignal, RetentionSignalsResponse } from '../api/retentionAssistClient';
import { fetchOpsAnomalySummary, OpsAnomalySummary } from '../api/opsAnomaliesClient';

type StudentRow = {
  enrollmentId: number;
  studentName: string;
  courseTitle: string;
  courseCode: string;
  progressPercent: number;
  completedModules: number;
  completedWorksheets: number;
  completedExams: number;
};

type CenterOverviewResponse = {
  students: StudentRow[];
};

const HeadCoordinatorDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [orgSummary, setOrgSummary] = useState<OrgDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsAnomalySummary | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [assistSignals, setAssistSignals] = useState<RetentionSignal[]>([]);
  const [assistSummary, setAssistSummary] = useState<RetentionSignalsResponse['summary'] | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [data, summary] = await Promise.all([
          apiClient.get('/api/dashboard/head-coordinator/overview'),
          fetchCenterDashboard()
        ]);
        const payload: CenterOverviewResponse = (data as any)?.data ?? data;
        setStudents(payload?.students || []);
        setOrgSummary(summary);
        setError(null);
      } catch (err) {
        console.error('Failed to load head coordinator dashboard', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadOpsAnomalies() {
      try {
        setOpsLoading(true);
        setOpsError(null);
        const res = await fetchOpsAnomalySummary();
        if (!isMounted) return;
        setOpsSummary(res);
      } catch (err) {
        console.error('Failed to load ops anomalies', err);
        if (!isMounted) return;
        setOpsError('Failed to load anomalies.');
        setOpsSummary(null);
      } finally {
        if (isMounted) setOpsLoading(false);
      }
    }
    loadOpsAnomalies();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadAssistSignals() {
      try {
        setAssistLoading(true);
        setAssistError(null);
        const res = await fetchCenterAssistSignals({ window: 14, limit: 50, offset: 0 });
        if (!isMounted) return;
        setAssistSignals(res.items ?? []);
        setAssistSummary(res.summary ?? null);
      } catch (err) {
        console.error('Failed to load assist signals', err);
        if (!isMounted) return;
        setAssistError('Failed to load signals.');
      } finally {
        if (isMounted) setAssistLoading(false);
      }
    }
    loadAssistSignals();
    return () => {
      isMounted = false;
    };
  }, []);

  const statusBadge = (progress: number) => {
    if (progress >= 100) return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>;
    if (progress > 0) return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In progress</span>;
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Not started</span>;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Head Coordinator Dashboard</h1>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Student Risk Signals</h2>
          {assistSummary ? (
            <span className="text-xs text-gray-500">{assistSummary.totalSignals} signals</span>
          ) : null}
        </div>
        <RetentionSignalsPanel
          title="Top student signals"
          signals={assistSignals}
          loading={assistLoading}
          error={assistError}
          maxItems={5}
          showDetails={false}
        />
        {assistSummary?.byCode && Object.keys(assistSummary.byCode).length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            {Object.entries(assistSummary.byCode).map(([code, count]) => (
              <span key={code} className="inline-block mr-3">
                {code}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {orgSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Students</div>
            <div className="text-xl font-semibold">{orgSummary.totals.students}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Enrollments</div>
            <div className="text-xl font-semibold">
              {orgSummary.totals.enrollmentsOngoing} ongoing / {orgSummary.totals.enrollmentsCompleted} completed
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Finance</div>
            <div className="text-sm">Collected: {formatCurrency(orgSummary.finance.paymentsTotal)}</div>
            <div className="text-sm">Pending: {formatCurrency(orgSummary.finance.duesPending)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Assessments</div>
            <div className="text-sm">Exam attempts: {orgSummary.assessments.examAttempts}</div>
            <div className="text-sm">WS attempts: {orgSummary.assessments.worksheetAttempts}</div>
            <div className="text-sm">
              Avg score: {formatPercent(orgSummary.assessments.avgExamScorePercent)} / {formatPercent(orgSummary.assessments.avgWorksheetScorePercent)}
              {orgSummary.assessments.avgWorksheetScorePercent ?? '-'}%
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <AnomaliesPanel summary={opsSummary} loading={opsLoading} error={opsError} maxItems={3} />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Students & Progress</h2>
            <span className="text-sm text-gray-500">Total: {students.length}</span>
          </div>
          {students.length === 0 ? (
            <p className="text-gray-500">No students found for your assigned centers.</p>
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
                  {students.map((row) => (
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
                          {statusBadge(row.progressPercent)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.completedModules}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.completedWorksheets}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.completedExams}</td>
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
      )}
    </div>
  );
};

export default HeadCoordinatorDashboard;