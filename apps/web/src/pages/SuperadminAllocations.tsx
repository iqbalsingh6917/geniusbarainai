import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { createSeatAllocation } from '../api/licensingClient';
import { useToast } from '../contexts/ToastContext';

type OrgUnit = {
  id: number;
  name: string;
  type: string;
  code: string;
};

type Course = {
  id: number;
  code: string;
  name: string;
};

type Allocation = {
  id: string;
  parentOrgUnitId: number;
  childOrgUnitId: number;
  courseCode: string;
  allocatedSeats: number;
  createdAt: string;
  parentOrgUnit?: OrgUnit;
  childOrgUnit?: OrgUnit;
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

const SuperadminAllocations: React.FC = () => {
  const { showToast } = useToast();
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [form, setForm] = useState({
    parentOrgUnitId: '',
    childOrgUnitId: '',
    courseCode: '',
    allocatedSeats: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allocRes, orgsRes, coursesRes] = await Promise.all([
        apiClient.get('/api/superadmin/licensing/allocations'),
        apiClient.get('/api/superadmin/org-units'),
        apiClient.get('/superadmin/abacus/courses'),
      ]);
      setAllocations(allocRes ?? []);
      setOrgUnits(orgsRes ?? []);
      setCourses(coursesRes ?? []);
    } catch (err) {
      console.error('Failed to load allocations:', err);
      setError('Failed to load allocations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const parentId = Number(form.parentOrgUnitId);
    const childId = Number(form.childOrgUnitId);
    const seats = Number(form.allocatedSeats);

    if (!parentId || !childId || !form.courseCode || !seats || seats <= 0) {
      setError('Please fill all fields with valid values.');
      return;
    }

    setSaving(true);
    setError(null);
    setAllocationError(null);
    try {
      const res = await createSeatAllocation({
        parentOrgUnitId: parentId,
        childOrgUnitId: childId,
        courseCode: form.courseCode,
        allocatedSeats: seats,
      });

      const remaining = res?.parentLicenseSummary?.remainingSeatsAfterAllocation;
      if (remaining !== undefined && remaining !== null) {
        showToast(`Allocation created. Remaining parent seats: ${remaining}.`, 'success');
      } else {
        showToast('Allocation created.', 'success');
      }

      setShowForm(false);
      setForm({
        parentOrgUnitId: '',
        childOrgUnitId: '',
        courseCode: '',
        allocatedSeats: '',
      });
      fetchAll();
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.response?.data?.error || err?.response?.data?.code;
      const meta = err?.response?.data?.meta;

      let friendly = 'Could not create allocation. Please try again or contact support.';
      if (code === 'INVALID_SEAT_COUNT') {
        friendly = 'Allocated seats must be a positive number.';
      } else if (code === 'NO_ACTIVE_LICENSE') {
        friendly = 'No active license found for this course under the selected parent organization.';
      } else if (code === 'INSUFFICIENT_SEATS') {
        const remaining = meta?.remaining;
        const requested = meta?.requested;
        if (remaining !== undefined && requested !== undefined) {
          friendly = `Requested ${requested} seats, but only ${remaining} seats are remaining on this license.`;
        } else {
          friendly = 'Insufficient seats on parent license.';
        }
      }

      console.error('Error creating allocation:', err);
      setAllocationError(friendly);
      showToast(friendly, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderOrgLabel = (org?: OrgUnit, fallbackId?: number) => {
    if (!org) return fallbackId ? `Org ${fallbackId}` : '-';
    return `${org.name} (${org.type}, ID: ${org.id})`;
  };

  const renderCourseLabel = (courseCode: string) => {
    const course = courses.find((c) => c.code === courseCode);
    if (!course) return courseCode;
    return `${course.name} (${course.code})`;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Seat Allocations</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          New Allocation
        </button>
      </div>

      {loading && (
        <div className="card p-6 text-center">
          <LoadingSpinner size="md" />
          <div className="mt-2">Loading allocations...</div>
        </div>
      )}

      {error && !loading && (
        <div className="card p-4 mb-4 bg-red-50 border border-red-200 text-red-700">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Created At</th>
                  <th>Parent Org</th>
                  <th>Child Org</th>
                  <th>Course</th>
                  <th>Allocated Seats</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr key={alloc.id}>
                    <td>{formatDate(alloc.createdAt)}</td>
                    <td>{renderOrgLabel(alloc.parentOrgUnit, alloc.parentOrgUnitId)}</td>
                    <td>{renderOrgLabel(alloc.childOrgUnit, alloc.childOrgUnitId)}</td>
                    <td>{renderCourseLabel(alloc.courseCode)}</td>
                    <td>{alloc.allocatedSeats}</td>
                  </tr>
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-600 py-4">
                      No allocations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-xl font-bold">Create Allocation</h2>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Parent Org Unit *</label>
                <select
                  required
                  value={form.parentOrgUnitId}
                  onChange={(e) => setForm((prev) => ({ ...prev, parentOrgUnitId: e.target.value }))}
                >
                  <option value="">Select parent</option>
                  {orgUnits.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type}, ID: {org.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Child Org Unit *</label>
                <select
                  required
                  value={form.childOrgUnitId}
                  onChange={(e) => setForm((prev) => ({ ...prev, childOrgUnitId: e.target.value }))}
                >
                  <option value="">Select child</option>
                  {orgUnits.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type}, ID: {org.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Course *</label>
                <select
                  required
                  value={form.courseCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, courseCode: e.target.value }))}
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.code}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Allocated Seats *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.allocatedSeats}
                  onChange={(e) => setForm((prev) => ({ ...prev, allocatedSeats: e.target.value }))}
                />
              </div>

              {allocationError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                  {allocationError}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminAllocations;
