import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import { apiClient } from '../utils/apiClient';
import AnomaliesPanel from '../components/ops/AnomaliesPanel';
import { fetchFranchiseDashboard } from '../api/franchiseDashboardClient';
import { fetchFranchiseLeadSummary } from '../api/franchiseLeadsClient';
import { fetchOpsAnomalySummary, OpsAnomalySummary } from '../api/opsAnomaliesClient';
import { fetchFranchiseOverview, FranchiseOverview } from '../api/dashboardOverviewClient';

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
  const [leadSummary, setLeadSummary] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<FranchiseOverview | null>(null);
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
      const [data, , leads, overview] = await Promise.all([
        apiClient.get('/api/dashboard/franchise'),
        fetchFranchiseDashboard(),
        fetchFranchiseLeadSummary(),
        fetchFranchiseOverview(),
      ]);
      setDashboardData(data);
      setLeadSummary(leads);
      setOverviewData(overview);
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

  if (!dashboardData || !overviewData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Franchise Dashboard</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">No dashboard data available</span>
        </div>
      </div>
    );
  }

  const FunnelCard = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
      <h3 className="text-lg font-medium text-gray-900">{label}</h3>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Franchise Dashboard</h1>

      {/* Basic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Centers</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.org.centersCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Students</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.totals.studentsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Active Enrollments</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.totals.activeEnrollmentsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Conversion Rate</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{overviewData.leadConversionRate.conversionRate}%</p>
        </div>
      </div>

      {leadSummary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Lead Funnel</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <FunnelCard label="New" value={overviewData.leadFunnel.byStage.NEW} />
            <FunnelCard label="Contacted" value={overviewData.leadFunnel.byStage.CONTACTED} />
            <FunnelCard label="Trial Booked" value={overviewData.leadFunnel.byStage.TRIAL_BOOKED} />
            <FunnelCard label="Trial Done" value={overviewData.leadFunnel.byStage.TRIAL_DONE} />
            <FunnelCard label="Converted" value={overviewData.leadFunnel.byStage.CONVERTED} />
            <FunnelCard label="Lost" value={overviewData.leadFunnel.byStage.LOST} />
          </div>
          <div className="mt-3 text-sm text-gray-700">Total leads: {overviewData.leadFunnel.totalLeads}</div>
          <div className="mt-3">
            <button className="btn btn-outline btn-sm" onClick={() => goToLeads()}>
              View All Leads
            </button>
          </div>
        </div>
      )}

      {/* Center Leaderboard */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Center Leaderboard (Top 10)</h2>
        {overviewData.centerLeaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Center</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overviewData.centerLeaderboard.map((center, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{center.centerName}</div>
                      <div className="text-sm text-gray-500">{center.centerCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.totalLeads}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.convertedLeads}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No center data available</p>
        )}
      </div>

      {/* Stalled Leads */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Stalled Leads (Last Activity &gt; 7 days)</h2>
        {overviewData.stalledLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overviewData.stalledLeads.slice(0, 10).map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lead.firstName} {lead.lastName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.contactPhone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.stage}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(lead.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No stalled leads</p>
        )}
      </div>

      {opsSummary && (
        <AnomaliesPanel
          summary={opsSummary}
          loading={opsLoading}
          error={opsError}
        />
      )}
    </div>
  );
};

export default FranchiseDashboard;