import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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

type LicenseOrder = {
  id: string;
  buyerOrgUnitId: number;
  courseCode: string;
  seatQuantity: number;
  unitPrice: number;
  currency: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  buyerOrgUnit?: OrgUnit;
};

const statusOptions = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'];

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

const SuperadminLicenseOrders: React.FC = () => {
  const [orders, setOrders] = useState<LicenseOrder[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [createForm, setCreateForm] = useState({
    buyerOrgUnitId: '',
    courseCode: '',
    seatQuantity: '',
    unitPrice: '',
    currency: 'INR',
    status: 'PENDING',
  });

  const [editForm, setEditForm] = useState({
    status: '',
    seatQuantity: '',
    unitPrice: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, orgsRes, coursesRes] = await Promise.all([
        apiClient.get('/api/superadmin/license-orders'),
        apiClient.get('/api/superadmin/org-units'),
        apiClient.get('/superadmin/abacus/courses'),
      ]);
      setOrders(ordersRes ?? []);
      setOrgUnits(orgsRes ?? []);
      setCourses(coursesRes ?? []);
    } catch (err) {
      console.error('Failed to load license orders:', err);
      setError('Failed to load license orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        buyerOrgUnitId: Number(createForm.buyerOrgUnitId),
        courseCode: createForm.courseCode,
        seatQuantity: Number(createForm.seatQuantity),
        unitPrice: Number(createForm.unitPrice),
        currency: createForm.currency || 'INR',
        status: createForm.status || 'PENDING',
      };
      await apiClient.post('/api/superadmin/license-orders', payload);
      setShowCreate(false);
      setCreateForm({
        buyerOrgUnitId: '',
        courseCode: '',
        seatQuantity: '',
        unitPrice: '',
        currency: 'INR',
        status: 'PENDING',
      });
      fetchAll();
    } catch (err) {
      console.error('Error creating license order:', err);
      alert('Failed to create license order');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (order: LicenseOrder) => {
    setEditingId(order.id);
    setEditForm({
      status: order.status,
      seatQuantity: '',
      unitPrice: '',
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const payload: any = {};
      if (editForm.status) payload.status = editForm.status;
      if (editForm.seatQuantity) payload.seatQuantity = Number(editForm.seatQuantity);
      if (editForm.unitPrice) payload.unitPrice = Number(editForm.unitPrice);

      await apiClient.put(`/api/superadmin/license-orders/${editingId}`, payload);
      setEditingId(null);
      setEditForm({ status: '', seatQuantity: '', unitPrice: '' });
      fetchAll();
    } catch (err) {
      console.error('Error updating license order:', err);
      alert('Failed to update license order');
    } finally {
      setSavingEdit(false);
    }
  };

  const courseOptionLabel = (courseCode: string) => {
    const course = courses.find((c) => c.code === courseCode);
    if (!course) return courseCode;
    return `${course.name} (${course.code})`;
  };

  const ordersView = useMemo(() => orders, [orders]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">License Orders</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          New Order
        </button>
      </div>

      {loading && (
        <div className="card p-6 text-center">
          <LoadingSpinner size="md" />
          <div className="mt-2">Loading license orders...</div>
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
                  <th>Buyer Org</th>
                  <th>Course</th>
                  <th>Seats</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordersView.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      {order.buyerOrgUnit
                        ? `${order.buyerOrgUnit.name} (${order.buyerOrgUnit.type}, ID: ${order.buyerOrgUnit.id})`
                        : `Org ${order.buyerOrgUnitId}`}
                    </td>
                    <td>{courseOptionLabel(order.courseCode)}</td>
                    <td>{order.seatQuantity}</td>
                    <td>{order.unitPrice}</td>
                    <td>{order.totalPrice}</td>
                    <td>{order.currency}</td>
                    <td>{order.status}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(order)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {ordersView.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-gray-600 py-4">
                      No license orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-xl font-bold">Create License Order</h2>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Close
              </button>
            </div>
            <form className="modal-body" onSubmit={handleCreate}>
              <div className="form-group">
                <label>Buyer Org Unit *</label>
                <select
                  required
                  value={createForm.buyerOrgUnitId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, buyerOrgUnitId: e.target.value }))}
                >
                  <option value="">Select Org Unit</option>
                  {orgUnits.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type}, ID: {org.id}, Code: {org.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Course *</label>
                <select
                  required
                  value={createForm.courseCode}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, courseCode: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.code}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Seat Quantity *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={createForm.seatQuantity}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, seatQuantity: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Unit Price *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={createForm.unitPrice}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <input
                  type="text"
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, currency: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-xl font-bold">Update License Order</h2>
              <button className="btn btn-ghost" onClick={() => setEditingId(null)}>
                Close
              </button>
            </div>
            <form className="modal-body" onSubmit={handleEditSave}>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Seat Quantity (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.seatQuantity}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, seatQuantity: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Unit Price (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminLicenseOrders;
