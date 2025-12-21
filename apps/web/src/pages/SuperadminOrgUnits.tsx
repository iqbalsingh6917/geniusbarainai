import React, { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  fetchOrgUnits as fetchOrgUnitsApi,
  createOrgUnit,
  updateOrgUnit,
  OrgUnit,
  OrgUnitType,
  OrgUnitStatus,
} from '../api/orgUnitsClient';

const SuperadminOrgUnits: React.FC = () => {
  const { showToast } = useToast();
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | null>(null);
  const [filterType, setFilterType] = useState<OrgUnitType | 'ALL'>('ALL');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'BUSINESS_PARTNER' as OrgUnitType,
    parentId: '',
    status: 'ACTIVE' as OrgUnitStatus,
  });

  useEffect(() => {
    loadOrgUnits();
  }, [filterType]);

  const loadOrgUnits = async () => {
    try {
      setLoading(true);
      const data = await fetchOrgUnitsApi(
        filterType === 'ALL'
          ? {}
          : {
              type: filterType,
            }
      );
      setOrgUnits(data);
      setError(null);
    } catch (err) {
      setError('Failed to load organization units');
      console.error('Error fetching org units:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createOrgUnit({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parentId: formData.parentId ? parseInt(formData.parentId, 10) : null,
        status: formData.status,
      });
      showToast('Org unit created.', 'success');
      setShowCreateModal(false);
      setFormData({ code: '', name: '', type: 'BUSINESS_PARTNER', parentId: '', status: 'ACTIVE' });
      loadOrgUnits();
    } catch (err) {
      setError('Failed to create organization unit');
      showToast('Failed to create organization unit', 'error');
      console.error('Error creating org unit:', err);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrgUnit) return;
    
    try {
      await updateOrgUnit(editingOrgUnit.id, {
        name: formData.name,
        code: formData.code,
        parentId: formData.parentId ? parseInt(formData.parentId, 10) : undefined,
        status: formData.status,
      });
      showToast('Org unit updated.', 'success');
      setEditingOrgUnit(null);
      setFormData({ code: '', name: '', type: 'BUSINESS_PARTNER', parentId: '', status: 'ACTIVE' });
      loadOrgUnits();
    } catch (err) {
      setError('Failed to update organization unit');
      showToast('Failed to update organization unit', 'error');
      console.error('Error updating org unit:', err);
    }
  };

  const openCreateModal = (type: string, parentId?: number) => {
    setFormData({
      code: '',
      name: '',
      type: type as OrgUnitType,
      parentId: parentId ? parentId.toString() : '',
      status: 'ACTIVE',
    });
    setShowCreateModal(true);
  };

  const openEditModal = (orgUnit: OrgUnit) => {
    setEditingOrgUnit(orgUnit);
    setFormData({
      code: orgUnit.code,
      name: orgUnit.name,
      type: orgUnit.type as OrgUnitType,
      parentId: orgUnit.parentId ? orgUnit.parentId.toString() : '',
      status: orgUnit.isActive ? 'ACTIVE' : 'INACTIVE',
    });
  };

  if (loading) {
    return <div>Loading organization data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Organization Management</h1>
      
      <div className="mb-6">
        <label className="mr-2 text-sm text-gray-700">Filter by type:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as OrgUnitType | 'ALL')}
          className="border border-gray-300 rounded px-2 py-1 mr-4"
        >
          <option value="ALL">All</option>
          <option value="BUSINESS_PARTNER">Business Partner</option>
          <option value="FRANCHISE">Franchise</option>
          <option value="CENTER">Center</option>
        </select>
        <button
          onClick={() => openCreateModal('BUSINESS_PARTNER')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Business Partner
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Organization Hierarchy</h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-2">Code</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Parent ID</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgUnits.map((unit) => (
                  <tr key={unit.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{unit.code}</td>
                    <td className="px-4 py-2">{unit.name}</td>
                    <td className="px-4 py-2">{unit.type}</td>
                    <td className="px-4 py-2">{unit.parentId ?? '-'}</td>
                    <td className="px-4 py-2">{unit.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-2">
                      {unit.type !== 'SUPERADMIN_ROOT' && (
                        <button
                          onClick={() => openEditModal(unit)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {orgUnits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-center text-gray-500">
                      No organization units found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Create/Edit Modal */}
      {(showCreateModal || editingOrgUnit) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                {editingOrgUnit ? 'Edit Organization Unit' : 'Create Organization Unit'}
              </h3>
            </div>
            <form onSubmit={editingOrgUnit ? handleEdit : handleCreate} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  disabled={!!editingOrgUnit}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              {!editingOrgUnit && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as OrgUnitType})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled={!!editingOrgUnit}
                    >
                      <option value="BUSINESS_PARTNER">Business Partner</option>
                      <option value="FRANCHISE">Franchise</option>
                      <option value="CENTER">Center</option>
                    </select>
                  </div>
                  
                  {formData.type !== ('BUSINESS_PARTNER' as OrgUnitType) && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent ID
                      </label>
                      <input
                        type="number"
                        value={formData.parentId}
                        onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required={formData.type !== ('BUSINESS_PARTNER' as OrgUnitType)}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OrgUnitStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingOrgUnit(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {editingOrgUnit ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminOrgUnits;
