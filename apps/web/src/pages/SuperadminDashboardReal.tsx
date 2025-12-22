import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/apiClient';
import Skeleton from '../components/ui/Skeleton';
import AnomaliesPanel from '../components/ops/AnomaliesPanel';
import {
  AssessmentAnalyticsSummary,
  fetchSuperadminAssessmentSummary,
} from '../api/assessmentAnalyticsClient';
import { fetchOpsAnomalySummary, OpsAnomalySummary } from '../api/opsAnomaliesClient';

interface DashboardData {
  totals: {
    totalStudents: number;
    activeEnrollments: number;
    totalCenters: number;
    totalBusinessPartners: number;
    totalFranchises: number;
  };
  abacus: {
    totalCourses: number;
    totalModules: number;
    totalLevels: number;
  };
  activity: {
    enrollmentsLast30Days: number;
    assessmentsLast30Days: number;
  };
  finance: {
    totalDues: number;
    totalCollected: number;
  };
  perCourse: Array<{
    courseCode: string;
    courseName: string;
    variant?: string;
    studentsCount: number;
    activeEnrollmentsCount: number;
    completionRatePercent: number;
  }>;
}

type SuperadminOverview = {
  totalStudents: number;
  totalEnrollments: number;
  totalRevenue: number;
  activeLicenses: number;
  totalOrgUnits: number;
  outstandingDues: number;
};

type CourseSummaryRow = {
  courseCode: string;
  courseTitle?: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completionRate: number;
};

type AuditLogEntry = {
  id: number;
  createdAt: string;
  action: string;
  orgUnitId?: number | null;
  actorUserId?: number | null;
  meta?: any;
};

const PHASE_HIGHLIGHT = 'Phase 1 highlights Abacus Level 1 (Regular) as the primary live course.';

const SuperadminDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [overview, setOverview] = useState<SuperadminOverview | null>(null);
  const [courseSummary, setCourseSummary] = useState<CourseSummaryRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const activityLimit = 20;
  const [activityFrom, setActivityFrom] = useState<string>('');
  const [activityTo, setActivityTo] = useState<string>('');
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentAnalyticsSummary | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsAnomalySummary | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    if (!user || !token || user.role !== 'SUPERADMIN') {
      navigate('/login');
      return;
    }
    
    fetchDashboardData();
  }, [user, token, navigate]);

  useEffect(() => {
    let isMounted = true;
    async function loadOpsAnomalies() {
      if (!user || !token || user.role !== 'SUPERADMIN') return;
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
  }, [user, token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, overviewRes, courseSummaryRes] = await Promise.all([
        apiClient.get('/api/dashboard/superadmin'),
        apiClient.get('/api/dashboard/superadmin/overview').catch(() => null),
        apiClient.get('/api/dashboard/superadmin/course-summary').catch(() => []),
      ]);
      setDashboardData(dashboardRes);
      setOverview((overviewRes as any) ?? null);
      setCourseSummary((courseSummaryRes as any) ?? []);
      // recent activity loaded separately
      setError(null);
    } catch (err: any) {
      // If unauthorized, redirect to login
      if (err.message && err.message.includes('401')) {
        navigate('/login');
        return;
      }
      setError('Failed to load dashboard data');
      console.error('Error fetching superadmin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadAssessments() {
      try {
        setAssessmentLoading(true);
        setAssessmentError(null);
        const res = await fetchSuperadminAssessmentSummary();
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

  useEffect(() => {
    let isMounted = true;
    async function loadActivity() {
      try {
        setActivityError(null);
        const params = new URLSearchParams();
        params.set('page', String(activityPage));
        params.set('limit', String(activityLimit));
        if (activityFrom) params.set('from', new Date(activityFrom).toISOString());
        if (activityTo) params.set('to', new Date(activityTo).toISOString());

        const res: any = await apiClient.get(`/api/audit/recent-activity?${params.toString()}`);
        if (!isMounted) return;
        setRecentActivity(res?.items ?? []);
        setActivityTotal(res?.total ?? 0);
      } catch (err) {
        console.error('Failed to load recent activity', err);
        if (!isMounted) return;
        setActivityError('Failed to load activity.');
        setRecentActivity([]);
        setActivityTotal(0);
      }
    }
    loadActivity();
    return () => {
      isMounted = false;
    };
  }, [activityPage, activityLimit, activityFrom, activityTo]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Superadmin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Superadmin Dashboard</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Superadmin Dashboard</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">No dashboard data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Superadmin Dashboard</h1>
      {user?.role !== 'SUPERADMIN' && (
        <p className="mb-4 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          {PHASE_HIGHLIGHT}
        </p>
      )}
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Students</h3>
          <p className="text-3xl font-bold text-blue-600">{overview?.totalStudents ?? 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Enrollments</h3>
          <p className="text-3xl font-bold text-green-600">{overview?.totalEnrollments ?? 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-indigo-600">Rs.{(overview?.totalRevenue ?? 0).toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Active Licenses</h3>
          <p className="text-3xl font-bold text-purple-600">{overview?.activeLicenses ?? 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Org Units</h3>
          <p className="text-3xl font-bold text-teal-600">
            {overview?.totalOrgUnits ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Outstanding Dues</h3>
          <p className="text-3xl font-bold text-red-600">Rs.{(overview?.outstandingDues ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => navigate('/superadmin/org-management')}>
            Business Partners / Org Units
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/superadmin/licensing')}>
            Licensing Summary
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/superadmin/licensing/allocations')}>
            Seat Allocations
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/superadmin/license-orders')}>
            License Orders
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/superadmin/abacus-builder')}>
            Curriculum Builder
          </button>
        </div>
      </div>

      <div className="mb-8">
        <AnomaliesPanel summary={opsSummary} loading={opsLoading} error={opsError} maxItems={5} />
      </div>

      {/* Assessments Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Assessments</h2>
        {assessmentLoading && <p className="text-sm text-gray-500">Loading...</p>}
        {assessmentError && <p className="text-sm text-red-600">{assessmentError}</p>}
        {assessmentSummary && !assessmentLoading && !assessmentError && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-2">Exams</h3>
              <div>Total: {assessmentSummary.exam.totalAttempts}</div>
              <div>Completed: {assessmentSummary.exam.completedAttempts}</div>
              <div>Avg score: {assessmentSummary.exam.avgScorePercent ?? '-'}%</div>
              <div>Pass rate: {assessmentSummary.exam.passRatePercent ?? '-'}%</div>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-2">Worksheets</h3>
              <div>Total: {assessmentSummary.worksheet.totalAttempts}</div>
              <div>Completed: {assessmentSummary.worksheet.completedAttempts}</div>
              <div>Avg score: {assessmentSummary.worksheet.avgScorePercent ?? '-'}%</div>
              <div>Pass rate: {assessmentSummary.worksheet.passRatePercent ?? '-'}%</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Abacus Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Abacus Curriculum Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
            <h3 className="text-lg font-medium text-gray-700">Courses</h3>
            <p className="text-2xl font-bold text-blue-600">{dashboardData.abacus.totalCourses}</p>
          </div>
          <div className="border rounded p-4 text-center">
            <h3 className="text-lg font-medium text-gray-700">Modules</h3>
            <p className="text-2xl font-bold text-green-600">{dashboardData.abacus.totalModules}</p>
          </div>
          <div className="border rounded p-4 text-center">
            <h3 className="text-lg font-medium text-gray-700">Levels</h3>
            <p className="text-2xl font-bold text-purple-600">{dashboardData.abacus.totalLevels}</p>
          </div>
        </div>
      </div>
      
      {/* Activity Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Activity (Last 30 Days)</h2>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <div>
            <label className="text-xs text-gray-500 block">From</label>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={activityFrom}
              onChange={(e) => {
                setActivityPage(1);
                setActivityFrom(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block">To</label>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={activityTo}
              onChange={(e) => {
                setActivityPage(1);
                setActivityTo(e.target.value);
              }}
            />
          </div>
          <div className="ml-auto text-sm text-gray-600">
            {activityTotal > 0
              ? `Showing ${Math.min(activityTotal, (activityPage - 1) * activityLimit + 1)}–${Math.min(activityTotal, activityPage * activityLimit)} of ${activityTotal}`
              : 'No activity'}
          </div>
        </div>
        {activityError && <p className="text-sm text-red-500 mb-2">{activityError}</p>}
        {recentActivity.length === 0 ? (
          <p className="text-gray-500">No recent activity.</p>
        ) : (
          <ul className="space-y-3">
            {recentActivity.map((log) => (
              <li key={log.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{log.action}</div>
                  {log.meta && (
                    <div className="text-xs text-gray-500 truncate">{JSON.stringify(log.meta)}</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end items-center gap-2 mt-4">
          <button
            className="btn btn-sm"
            onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
            disabled={activityPage <= 1}
          >
            Prev
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setActivityPage((p) => p + 1)}
            disabled={activityPage * activityLimit >= activityTotal}
          >
            Next
          </button>
        </div>
      </div>
      
      {/* Per-Course Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Course Summary</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courseSummary.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={4}>
                    No course summary data.
                  </td>
                </tr>
              )}
              {courseSummary.map((course, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {course.courseTitle || course.courseCode} ({course.courseCode})
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {course.totalEnrollments}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {course.activeEnrollments}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{course.completionRate}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${course.completionRate}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;
