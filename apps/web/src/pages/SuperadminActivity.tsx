import React, { useEffect, useMemo, useState } from 'react';
import StandardTable from '../components/ui/StandardTable';
import { apiClient } from '../utils/apiClient';
import Skeleton from '../components/ui/Skeleton';

type ActivityItem = {
  type: 'ENROLLMENT' | 'ASSESSMENT' | 'WORKSHEET_ATTEMPT';
  createdAt: string | Date | null;
  orgUnitName: string | null;
  orgUnitType: string | null;
  courseCode: string | null;
  courseName: string | null;
  courseVariant: string | null;
  studentCode: string | null;
  studentName: string | null;
  details: string;
};

const typeLabel: Record<ActivityItem['type'], string> = {
  ENROLLMENT: 'Enrollment',
  ASSESSMENT: 'Assessment',
  WORKSHEET_ATTEMPT: 'Worksheet attempt',
};

const formatDateTime = (value: ActivityItem['createdAt']) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SuperadminActivity: React.FC = () => {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ActivityItem['type'] | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get('/api/superadmin/activity/summary');
        setActivity(res ?? []);
      } catch (err) {
        console.error('Error fetching activity summary:', err);
        setError('Failed to load activity summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return activity.filter((item) => {
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesSearch =
        !term ||
        [item.studentName, item.studentCode, item.courseName, item.orgUnitName, item.details]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      return matchesType && matchesSearch;
    });
  }, [activity, filterType, search]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Activity Monitor</h1>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Activity Monitor</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600" htmlFor="activity-type-filter">
            Type
          </label>
          <select
            id="activity-type-filter"
            className="form-control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ActivityItem['type'] | 'ALL')}
          >
            <option value="ALL">All</option>
            <option value="ENROLLMENT">Enrollment</option>
            <option value="ASSESSMENT">Assessment</option>
            <option value="WORKSHEET_ATTEMPT">Worksheet Attempt</option>
          </select>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <label className="text-sm text-gray-600" htmlFor="activity-search">
            Search
          </label>
          <input
            id="activity-search"
            type="text"
            className="form-control"
            placeholder="Student, course, org, or details"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search activity"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">
          No recent activity in the last 30 days.
        </div>
      )}

      {!error && rows.length > 0 && (
        <StandardTable
          headers={[
            { key: 'createdAt', label: 'Time' },
            { key: 'type', label: 'Type' },
            { key: 'org', label: 'Org' },
            { key: 'course', label: 'Course' },
            { key: 'student', label: 'Student' },
            { key: 'details', label: 'Details' },
          ]}
          data={rows}
          renderCell={(row, key) => {
            const item = row as ActivityItem;
            switch (key) {
              case 'createdAt':
                return <span className="text-sm text-gray-700">{formatDateTime(item.createdAt)}</span>;
              case 'type':
                return (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                    {typeLabel[item.type] || item.type}
                  </span>
                );
              case 'org':
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{item.orgUnitName ?? '-'}</span>
                    <span className="text-xs text-gray-500">{item.orgUnitType ?? ''}</span>
                  </div>
                );
              case 'course':
                return (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.courseName ?? '-'}</span>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span>{item.courseCode ?? ''}</span>
                      {item.courseVariant && (
                        <>
                          <span>·</span>
                          <span>{item.courseVariant}</span>
                          {item.courseVariant === 'BEATS20' && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px]">
                              AI-enhanced
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              case 'student':
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{item.studentName ?? '-'}</span>
                    <span className="text-xs text-gray-500">{item.studentCode ?? ''}</span>
                  </div>
                );
              case 'details':
                return <span className="text-sm text-gray-700">{item.details}</span>;
              default:
                return null;
            }
          }}
        />
      )}
    </div>
  );
};

export default SuperadminActivity;
