import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesSummary, fetchSalesBreakdown, SalesFilter, LeadStageSummary, LeadBreakdownRow } from '../api/salesClient';
import { apiClient } from '../utils/apiClient';
import { useToast } from '../contexts/ToastContext';

type Course = { id: number; code: string; name: string };

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const SuperadminSalesConsole: React.FC = () => {
  const { showToast } = useToast();

  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [courseCode, setCourseCode] = useState('');
  const [groupBy, setGroupBy] = useState<'BP' | 'FRANCHISE' | 'CENTER'>('BP');
  const [courses, setCourses] = useState<Course[]>([]);

  const [summary, setSummary] = useState<LeadStageSummary | null>(null);
  const [rows, setRows] = useState<LeadBreakdownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
    load();
  }, []);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/superadmin/abacus/courses');
      setCourses(res ?? []);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const filter: SalesFilter = { from, to, courseCode: courseCode || undefined, groupBy };
      const [s, b] = await Promise.all([fetchSalesSummary(filter), fetchSalesBreakdown(filter)]);
      setSummary(s);
      setRows(b);
    } catch (err) {
      console.error('Failed to load sales data', err);
      setError('Failed to load sales data.');
      showToast('Failed to load sales data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalLeads = useMemo(() => {
    if (!summary) return 0;
    return summary.new + summary.contacted + summary.trialBooked + summary.trialDone + summary.converted + summary.lost;
  }, [summary]);

  const conversionRate = totalLeads > 0 ? Math.round(((summary?.converted ?? 0) / totalLeads) * 100) : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales / Lead Console</h1>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFrom(daysAgoISO(30));
              setTo(todayISO());
              setCourseCode('');
              setGroupBy('BP');
            }}
          >
            Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-sm text-gray-600">From</label>
            <input type="date" className="input input-bordered w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600">To</label>
            <input type="date" className="input input-bordered w-full" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Course</label>
            <select className="select select-bordered w-full" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Group By</label>
            <select className="select select-bordered w-full" value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
              <option value="BP">Business Partner</option>
              <option value="FRANCHISE">Franchise</option>
              <option value="CENTER">Center</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-3xl font-bold text-blue-600">{totalLeads}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Converted</p>
          <p className="text-3xl font-bold text-green-600">{summary?.converted ?? 0}</p>
          <p className="text-xs text-gray-500">Conversion Rate: {conversionRate}%</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Lost</p>
          <p className="text-3xl font-bold text-red-500">{summary?.lost ?? 0}</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Org Unit</th>
                <th>Type</th>
                <th>New</th>
                <th>Contacted</th>
                <th>Trial Booked</th>
                <th>Trial Done</th>
                <th>Converted</th>
                <th>Lost</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gray-500">
                    No leads found for this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.orgUnitId}>
                    <td>{row.orgUnitName}</td>
                    <td>{row.orgUnitType}</td>
                    <td>{row.new}</td>
                    <td>{row.contacted}</td>
                    <td>{row.trialBooked}</td>
                    <td>{row.trialDone}</td>
                    <td>{row.converted}</td>
                    <td>{row.lost}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperadminSalesConsole;
