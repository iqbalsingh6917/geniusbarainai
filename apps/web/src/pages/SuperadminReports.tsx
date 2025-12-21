import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchPerformanceReport, fetchFinanceReport, fetchFinanceTimeseries, DateRangeFilter } from '../api/reportsClient';
import { apiClient } from '../utils/apiClient';

type Course = { id: number; code: string; name: string };

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const SuperadminReports: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [from, setFrom] = useState<string>(daysAgoISO(30));
  const [to, setTo] = useState<string>(todayISO());
  const [courseCode, setCourseCode] = useState<string>('');
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadFunnel, setLeadFunnel] = useState<any | null>(null);
  const [enrollments, setEnrollments] = useState<any | null>(null);
  const [finance, setFinance] = useState<any | null>(null);
  const [timeseries, setTimeseries] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'SUPERADMIN') return;
    loadCourses();
    loadReports();
  }, []);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/superadmin/abacus/courses');
      setCourses(res ?? []);
    } catch {
      // ignore
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const filter: DateRangeFilter = { from, to, courseCode: courseCode || undefined };
      const [perfRes, finRes, tsRes] = await Promise.all([
        fetchPerformanceReport(filter),
        fetchFinanceReport(filter),
        fetchFinanceTimeseries(filter),
      ]);
      setLeadFunnel(perfRes?.leadFunnel ?? null);
      setEnrollments(perfRes?.enrollments ?? null);
      setFinance(finRes ?? null);
      setTimeseries(tsRes ?? []);
    } catch (err) {
      console.error('Failed to load reports', err);
      setError('Failed to load reports.');
      showToast('Failed to load reports.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalLeads = useMemo(() => {
    if (!leadFunnel) return 0;
    return Object.values(leadFunnel).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
  }, [leadFunnel]);

  const converted = leadFunnel?.converted ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

  const totalCollected = finance?.totalCollected ?? 0;
  const totalDues = finance?.totalDues ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFrom(daysAgoISO(30));
              setTo(todayISO());
              setCourseCode('');
            }}
          >
            Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={loadReports} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full input input-bordered" />
          </div>
          <div>
            <label className="text-sm text-gray-600">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full input input-bordered" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Course</label>
            <select value={courseCode} onChange={(e) => setCourseCode(e.target.value)} className="w-full select select-bordered">
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
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
          <p className="text-3xl font-bold text-green-600">{converted}</p>
          <p className="text-xs text-gray-500">Rate: {conversionRate}%</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Active Enrollments</p>
          <p className="text-3xl font-bold text-indigo-600">{enrollments?.active ?? 0}</p>
          <p className="text-xs text-gray-500">Total: {enrollments?.total ?? 0} · Completed: {enrollments?.completed ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Revenue Collected</p>
          <p className="text-3xl font-bold text-green-600">₹{(totalCollected || 0).toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Outstanding Dues</p>
          <p className="text-3xl font-bold text-red-600">₹{(totalDues || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Lead Funnel</h2>
        {!leadFunnel && <p className="text-sm text-gray-500">No data.</p>}
        {leadFunnel && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: 'new', label: 'New' },
              { key: 'contacted', label: 'Contacted' },
              { key: 'trialBooked', label: 'Trial Booked' },
              { key: 'trialDone', label: 'Trial Done' },
              { key: 'converted', label: 'Converted' },
              { key: 'lost', label: 'Lost' },
            ].map((stage) => (
              <div key={stage.key} className="border rounded p-3">
                <p className="text-xs text-gray-500">{stage.label}</p>
                <p className="text-xl font-semibold">{leadFunnel[stage.key] ?? 0}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Finance (timeseries)</h2>
        {timeseries.length === 0 ? (
          <p className="text-sm text-gray-500">No finance data in this range.</p>
        ) : (
          <div className="space-y-2">
            {timeseries.map((point) => (
              <div key={point.date} className="flex justify-between text-sm">
                <span className="text-gray-600">{point.date}</span>
                <span className="font-semibold">₹{point.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminReports;
