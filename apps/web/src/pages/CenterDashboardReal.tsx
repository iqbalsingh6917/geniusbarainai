import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchCenterOverview, CenterOverview } from '../api/dashboardOverviewClient';
import { apiClient } from '../utils/apiClient';

const CenterDashboardReal: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<CenterOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, overview] = await Promise.all([
          apiClient.get('/api/dashboard/center'),
          fetchCenterOverview(),
        ]);
        setDashboardData(dashboard);
        setOverviewData(overview);
        setError(null);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Center Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-200 animate-pulse rounded h-24"></div>
          <div className="bg-gray-200 animate-pulse rounded h-24"></div>
          <div className="bg-gray-200 animate-pulse rounded h-24"></div>
          <div className="bg-gray-200 animate-pulse rounded h-24"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Center Dashboard</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!dashboardData || !overviewData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Center Dashboard</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative">
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
      <h1 className="text-2xl font-bold mb-6">Center Dashboard</h1>
      
      {/* Basic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Students</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.totals.studentsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Active Enrollments</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.totals.activeEnrollmentsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Completed Enrollments</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{dashboardData.totals.completedEnrollmentsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900">Conversion Rate</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{overviewData.leadConversionRate.conversionRate}%</p>
        </div>
      </div>

      {/* Lead Funnel */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sales Funnel</h2>
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
      </div>

      {/* Follow-ups and Conversions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Follow-ups due today */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Follow-ups Due Today</h2>
          {overviewData.followUpsDueToday.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overviewData.followUpsDueToday.map((lead: any) => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{lead.firstName} {lead.lastName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.contactPhone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No follow-ups due today</p>
          )}
        </div>

        {/* Converted Leads */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Conversions</h2>
          {overviewData.convertedLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overviewData.convertedLeads.slice(0, 5).map((lead: any) => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{lead.firstName} {lead.lastName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.convertedToStudentId ? `STU${lead.convertedToStudentId.toString().padStart(4, '0')}` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No recent conversions</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/center/leads" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded text-center">
            Manage Leads
          </Link>
          <Link to="/center/students" className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded text-center">
            View Students
          </Link>
          <Link to="/center/enrollments" className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded text-center">
            View Enrollments
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CenterDashboardReal;