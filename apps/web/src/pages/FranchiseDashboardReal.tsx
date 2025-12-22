import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import { apiClient } from '../utils/apiClient';
import AnomaliesPanel from '../components/ops/AnomaliesPanel';
import { fetchFranchiseDashboard } from '../api/franchiseDashboardClient';
import { OrgDashboardSummary } from '../api/bpDashboardClient';
import { fetchFranchiseLeadSummary } from '../api/franchiseLeadsClient';
import { formatCurrency } from '../utils/formatters';
import { fetchOpsAnomalySummary, OpsAnomalySummary } from '../api/opsAnomaliesClient';

interface DashboardData {
  org: {
    franchiseCode: string;
    centersCount: number;
  };
  totals: {
    studentsCount: number;
    activeEnrollmentsCount: number;
  };
  perCenter: Array<{
    centerCode: string;
    centerName: string;
    studentsCount: number;
    activeEnrollmentsCount: number;
  }>;
}

const FranchiseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [orgSummary, setOrgSummary] = useState<OrgDashboardSummary | null>(null);
  const [leadSummary, setLeadSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsAnomalySummary | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
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

  const goToLeads = (stage?: string) => {
    const query = stage ? `?stage=${stage}` : '';
    navigate(`/franchise/leads${query}`);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [data, summary, leads] = await Promise.all([
        apiClient.get('/api/dashboard/franchise'),
        fetchFranchiseDashboard(),
        fetchFranchiseLeadSummary(),
      ]);
      setDashboardData(data);
      setOrgSummary(summary);
      setLeadSummary(leads);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching franchise dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Franchise Dashboard</h1>
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
        <h1 className="text-2xl font-bold mb-6">Franchise Dashboard</h1>
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
        <h1 className="text-2xl font-bold mb-6">Franchise Dashboard</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">No dashboard data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Franchise Dashboard</h1>

      {leadSummary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Lead Funnel</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <FunnelCard label="New" value={leadSummary.byStage?.NEW ?? 0} onClick={() => goToLeads('NEW')} />
            <FunnelCard label="Contacted" value={leadSummary.byStage?.CONTACTED ?? 0} onClick={() => goToLeads('CONTACTED')} />
            <FunnelCard label="Trial Booked" value={leadSummary.byStage?.TRIAL_BOOKED ?? 0} onClick={() => goToLeads('TRIAL_BOOKED')} />
            <FunnelCard label="Trial Done" value={leadSummary.byStage?.TRIAL_DONE ?? 0} onClick={() => goToLeads('TRIAL_DONE')} />
            <FunnelCard label="Converted" value={leadSummary.byStage?.CONVERTED ?? 0} onClick={() => goToLeads('CONVERTED')} />
            <FunnelCard label="Lost" value={leadSummary.byStage?.LOST ?? 0} onClick={() => goToLeads('LOST')} />
          </div>
          <div className="mt-3 text-sm text-gray-700">Total leads: {leadSummary.totalLeads ?? 0}</div>
          <div className="mt-3">
            <button className="btn btn-outline btn-sm" onClick={() => goToLeads()}>
              View all leads
            </button>
          </div>
        </div>
      )}

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
              Avg score: {orgSummary.assessments.avgExamScorePercent ?? '-'}% /{' '}
              {orgSummary.assessments.avgWorksheetScorePercent ?? '-'}%
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <AnomaliesPanel summary={opsSummary} loading={opsLoading} error={opsError} maxItems={3} />
      </div>
      
      {/* Org Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded p-4">
            <h3 className="text-lg font-medium text-gray-700">Franchise</h3>
            <p className="text-xl font-bold text-blue-600">{dashboardData.org.franchiseCode}</p>
          </div>
          <div className="border rounded p-4">
            <h3 className="text-lg font-medium text-gray-700">Centers</h3>
            <p className="text-xl font-bold text-green-600">{dashboardData.org.centersCount}</p>
          </div>
        </div>
      </div>
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Students</h3>
          <p className="text-3xl font-bold text-blue-600">{dashboardData.totals.studentsCount}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Active Enrollments</h3>
          <p className="text-3xl font-bold text-green-600">{dashboardData.totals.activeEnrollmentsCount}</p>
        </div>
      </div>
      
      {/* Per-Center Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Centers Overview</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Center</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Enrollments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData.perCenter.map((center, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{center.centerCode}</div>
                    <div className="text-sm text-gray-500">{center.centerName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {center.studentsCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {center.activeEnrollmentsCount}
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

export default FranchiseDashboard;

const FunnelCard: React.FC<{ label: string; value: number; compact?: boolean; onClick?: () => void }> = ({ label, value, compact, onClick }) => (
  <div
    className={`border rounded p-4 ${compact ? 'text-center' : ''} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
    onClick={onClick}
  >
    <h4 className="text-sm font-medium text-gray-600">{label}</h4>
    <p className="text-2xl font-bold text-indigo-600">{value}</p>
  </div>
);
