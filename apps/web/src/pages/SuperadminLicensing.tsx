import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import StandardTable from '../components/ui/StandardTable';

type LicensingSummaryItem = {
  licenseId: number;
  parentOrgUnitId: number;
  parentOrgUnitName: string;
  parentOrgUnitType: string;
  courseCode: string;
  totalSeats: number;
  allocatedSeats: number;
  remainingSeats: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  usedSeats?: number;
};

const SuperadminLicensing: React.FC = () => {
  const [data, setData] = useState<LicensingSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get('/api/licensing/summary');
        setData(res?.data ?? res ?? []);
      } catch (err) {
        console.error('Error fetching licensing summary:', err);
        setError('Failed to load licensing summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  }, []);

  const rows = useMemo(() => {
    return data.map((row) => ({
      ...row,
      usedSeats: row.allocatedSeats ?? 0,
      remainingSeats: row.remainingSeats ?? Math.max((row.totalSeats || 0) - (row.allocatedSeats || 0), 0),
    }));
  }, [data]);

  const formatDate = (value: string | null) => {
    if (!value) return 'Not set';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderValidity = (from: string | null, to: string | null) => {
    if (!from && !to) return 'Not set';
    if (from && to) return `${formatDate(from)} - ${formatDate(to)}`;
    if (from) return `${formatDate(from)} - open`;
    return `open - ${formatDate(to)}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Licensing</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Licensing</h1>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">No licenses configured yet.</div>
      )}

      {!error && rows.length > 0 && (
        <StandardTable
          headers={[
            { key: 'orgUnit', label: 'Org Unit' },
            { key: 'orgUnitType', label: 'Org Type' },
            { key: 'course', label: 'Course' },
            { key: 'courseCode', label: 'Course Code' },
            { key: 'status', label: 'Status' },
            { key: 'totalSeats', label: 'Total Seats' },
            { key: 'usedSeats', label: 'Used Seats' },
            { key: 'remainingSeats', label: 'Remaining' },
            { key: 'validity', label: 'Validity' },
          ]}
          data={rows}
          renderCell={(row, headerKey) => {
            switch (headerKey) {
              case 'orgUnit':
                return (
                  <div>
                    <div className="font-medium">{row.parentOrgUnitName ?? '—'}</div>
                    <div className="text-xs text-gray-500">ID: {row.parentOrgUnitId}</div>
                  </div>
                );
              case 'orgUnitType':
                return row.parentOrgUnitType ?? '—';
              case 'course':
                return row.courseCode ?? '—';
              case 'courseCode':
                return row.courseCode;
              case 'status':
                return (
                  <span className={`px-2 py-1 rounded-full text-xs ${row.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                );
              case 'totalSeats':
                return row.totalSeats;
              case 'usedSeats':
                return row.usedSeats;
              case 'remainingSeats':
                return row.remainingSeats;
              case 'validity':
                return renderValidity(row.validFrom, row.validTo);
              default:
                return null;
            }
          }}
        />
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
        <p>
          This view is read-only. Licensing data is stored centrally in CourseLicense and can be extended later with seat
          allocation workflows.
        </p>
      </div>
    </div>
  );
};

export default SuperadminLicensing;
