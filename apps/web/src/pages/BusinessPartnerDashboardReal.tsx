import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/apiClient';
import { fetchBpDashboard, OrgDashboardSummary } from '../api/bpDashboardClient';
import { fetchBpLeadSummary, LeadSummaryResponse } from '../api/bpLeadsClient';
import { formatCurrency } from '../utils/formatters';

interface DashboardData {
  org: {
    businessPartnerCode: string;
    franchisesCount: number;
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

const PHASE_HIGHLIGHT = 'Phase 1 highlights Abacus Level 1 (Regular) as the primary live course.';

const BusinessPartnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [orgSummary, setOrgSummary] = useState<OrgDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<LeadSummaryResponse | null>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const goToLeads = (stage?: string) => {
    const query = stage ? `?stage=${stage}` : '';
    navigate(`/business-partner/leads${query}`);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [data, summary] = await Promise.all([
        apiClient.get('/api/dashboard/business-partner'),
        fetchBpDashboard(),
      ]);
      setDashboardData(data);
      setOrgSummary(summary);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching business partner dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadFunnel() {
      try {
        setLoadingFunnel(true);
        setFunnelError(null);
        const res = await fetchBpLeadSummary();
        if (!isMounted) return;
        setFunnel(res);
      } catch (err) {
        console.error('Failed to load BP lead funnel', err);
        if (!isMounted) return;
        setFunnelError('Could not load lead funnel.');
      } finally {
        if (isMounted) setLoadingFunnel(false);
      }
    }
    loadFunnel();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Business Partner Dashboard</h1>
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
        <h1 className="text-2xl font-bold mb-6">Business Partner Dashboard</h1>
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
        <h1 className="text-2xl font-bold mb-6">Business Partner Dashboard</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">No dashboard data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Business Partner Dashboard</h1>
      {user?.role !== 'SUPERADMIN' && (
        <p className="mb-4 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          {PHASE_HIGHLIGHT}
        </p>
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

      {/* Org Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded p-4">
            <h3 className="text-lg font-medium text-gray-700">Business Partner</h3>
            <p className="text-xl font-bold text-blue-600">{dashboardData.org.businessPartnerCode}</p>
          </div>
          <div className="border rounded p-4">
            <h3 className="text-lg font-medium text-gray-700">Franchises</h3>
            <p className="text-xl font-bold text-green-600">{dashboardData.org.franchisesCount}</p>
          </div>
          <div className="border rounded p-4">
            <h3 className="text-lg font-medium text-gray-700">Centers</h3>
            <p className="text-xl font-bold text-purple-600">{dashboardData.org.centersCount}</p>
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

      {/* Lead Funnel */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Lead Funnel</h2>
          {loadingFunnel && <span className="text-sm text-gray-500">Loading...</span>}
          {funnelError && <span className="text-sm text-red-500">{funnelError}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <FunnelCard label="New" value={funnel?.byStage.NEW ?? 0} onClick={() => goToLeads('NEW')} />
          <FunnelCard label="Contacted" value={funnel?.byStage.CONTACTED ?? 0} onClick={() => goToLeads('CONTACTED')} />
          <FunnelCard label="Trial Booked" value={funnel?.byStage.TRIAL_BOOKED ?? 0} onClick={() => goToLeads('TRIAL_BOOKED')} />
          <FunnelCard label="Trial Done" value={funnel?.byStage.TRIAL_DONE ?? 0} onClick={() => goToLeads('TRIAL_DONE')} />
          <FunnelCard label="Converted" value={funnel?.byStage.CONVERTED ?? 0} onClick={() => goToLeads('CONVERTED')} />
          <FunnelCard label="Lost" value={funnel?.byStage.LOST ?? 0} onClick={() => goToLeads('LOST')} />
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">By Source</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FunnelCard label="Campaign" value={funnel?.bySource.CAMPAIGN ?? 0} compact />
            <FunnelCard label="Referral" value={funnel?.bySource.REFERRAL ?? 0} compact />
            <FunnelCard label="Walk In" value={funnel?.bySource.WALK_IN ?? 0} compact />
            <FunnelCard label="Whatsapp" value={funnel?.bySource.WHATSAPP ?? 0} compact />
            <FunnelCard label="Other" value={funnel?.bySource.OTHER ?? 0} compact />
          </div>
          <div className="mt-3 text-sm text-gray-700">Total leads: {funnel?.totalLeads ?? 0}</div>
          <div className="mt-3">
            <button className="btn btn-outline btn-sm" onClick={() => goToLeads()}>
              View all leads
            </button>
          </div>
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

export default BusinessPartnerDashboard;

const FunnelCard: React.FC<{ label: string; value: number; compact?: boolean; onClick?: () => void }> = ({ label, value, compact, onClick }) => (
  <div
    className={`border rounded p-4 ${compact ? 'text-center' : ''} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
    onClick={onClick}
  >
    <h4 className="text-sm font-medium text-gray-600">{label}</h4>
    <p className="text-2xl font-bold text-indigo-600">{value}</p>
  </div>
);
