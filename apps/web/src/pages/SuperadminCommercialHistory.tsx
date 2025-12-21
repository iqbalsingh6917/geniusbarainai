import React, { useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type OrderItem = {
  id: string;
  createdAt: string;
  buyerOrgUnitId: number;
  buyerOrgName: string | null;
  buyerOrgType: string | null;
  courseCode: string;
  seatQuantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  status: string;
};

type AllocationItem = {
  id: string;
  createdAt: string;
  parentOrgUnitId: number;
  parentOrgName: string | null;
  parentOrgType: string | null;
  childOrgUnitId: number;
  childOrgName: string | null;
  childOrgType: string | null;
  courseCode: string;
  allocatedSeats: number;
};

type LicenseItem = {
  id: string;
  orgUnitId: number;
  orgUnitName: string | null;
  orgUnitType: string | null;
  courseCode: string;
  courseName: string | null;
  variant: string | null;
  totalSeats: number;
  usedSeats: number;
  remaining: number;
};

type HistoryResponse = {
  orders: OrderItem[];
  allocations: AllocationItem[];
  licenses: LicenseItem[];
};

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const SuperadminCommercialHistory: React.FC = () => {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/superadmin/commercial/history');
      setData(res?.data ?? res ?? null);
    } catch (err) {
      console.error('Failed to load commercial history:', err);
      setError('Failed to load commercial history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Commercial History</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={fetchData}>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-6 text-center">
          <LoadingSpinner size="md" />
          <div className="mt-2">Loading commercial history...</div>
        </div>
      )}

      {error && !loading && (
        <div className="card p-4 mb-4 bg-red-50 border border-red-200 text-red-700">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" onClick={fetchData}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">License Orders</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Buyer Org</th>
                    <th>Course</th>
                    <th>Seats</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>
                        <div className="font-medium">{o.buyerOrgName ?? `Org ${o.buyerOrgUnitId}`}</div>
                        <div className="text-xs text-gray-500">
                          {o.buyerOrgType ?? 'Org'} • ID: {o.buyerOrgUnitId}
                        </div>
                      </td>
                      <td>{o.courseCode}</td>
                      <td>{o.seatQuantity}</td>
                      <td>
                        {o.totalPrice} {o.currency}
                      </td>
                      <td>{o.status}</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-600 py-4">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Seat Allocations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Parent Org</th>
                    <th>Child Org</th>
                    <th>Course</th>
                    <th>Allocated Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allocations.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.createdAt)}</td>
                      <td>
                        <div className="font-medium">{a.parentOrgName ?? `Org ${a.parentOrgUnitId}`}</div>
                        <div className="text-xs text-gray-500">
                          {a.parentOrgType ?? 'Org'} • ID: {a.parentOrgUnitId}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">{a.childOrgName ?? `Org ${a.childOrgUnitId}`}</div>
                        <div className="text-xs text-gray-500">
                          {a.childOrgType ?? 'Org'} • ID: {a.childOrgUnitId}
                        </div>
                      </td>
                      <td>{a.courseCode}</td>
                      <td>{a.allocatedSeats}</td>
                    </tr>
                  ))}
                  {data.allocations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-600 py-4">
                        No allocations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">License Usage Snapshot</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Org</th>
                    <th>Course</th>
                    <th>Variant</th>
                    <th>Total Seats</th>
                    <th>Used Seats</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.licenses.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="font-medium">{l.orgUnitName ?? `Org ${l.orgUnitId}`}</div>
                        <div className="text-xs text-gray-500">
                          {l.orgUnitType ?? 'Org'} • ID: {l.orgUnitId}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">{l.courseName ?? l.courseCode}</div>
                        <div className="text-xs text-gray-500">{l.courseCode}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span>{l.variant ?? '-'}</span>
                          {l.variant === 'BEATS20' && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                              AI-enhanced
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{l.totalSeats}</td>
                      <td>{l.usedSeats}</td>
                      <td>{Math.max(l.remaining, 0)}</td>
                    </tr>
                  ))}
                  {data.licenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-600 py-4">
                        No licenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminCommercialHistory;
