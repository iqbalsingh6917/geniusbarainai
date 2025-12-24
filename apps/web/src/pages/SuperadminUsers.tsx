import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { handleErrorToast, parseErrorMessage, parseFieldErrors } from '../utils/errorHandling';

interface User {
  id: number;
  username: string;
  role: string;
  orgUnitId: number | null;
  orgUnitCode: string | null;
  orgUnitName: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OrgUnit {
  id: number;
  code: string;
  name: string;
  type: string;
}

const SuperadminUsers: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [filters, setFilters] = useState({
    orgUnitId: '',
    role: '',
    search: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'BUSINESS_PARTNER',
    orgUnitId: ''
  });
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
    fetchOrgUnits();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.orgUnitId) queryParams.append('orgUnitId', filters.orgUnitId);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.search) queryParams.append('search', filters.search);
      
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const data = await apiClient.get(`/api/superadmin/users${queryString}`);
      setUsers(data);
      setError(null);
    } catch (err) {
      const msg = parseErrorMessage(err, 'Failed to load users');
      setError(msg);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgUnits = async () => {
    try {
      const data = await apiClient.get('/api/superadmin/org-units');
      // Flatten the org unit tree
      const flattenOrgUnits = (units: any[]): OrgUnit[] => {
        let result: OrgUnit[] = [];
        units.forEach(unit => {
          result.push({
            id: unit.id,
            code: unit.code,
            name: unit.name,
            type: unit.type
          });
          if (unit.children && unit.children.length > 0) {
            result = result.concat(flattenOrgUnits(unit.children));
          }
        });
        return result;
      };
      setOrgUnits(flattenOrgUnits(data));
    } catch (err) {
      console.error('Error fetching org units:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    try {
      const payload: any = {
        username: formData.username,
        password: formData.password,
        role: formData.role,
        orgUnitId: parseInt(formData.orgUnitId)
      };
      
      await apiClient.post('/api/superadmin/users', payload);
      setShowCreateModal(false);
      setFormData({ username: '', password: '', role: 'BUSINESS_PARTNER', orgUnitId: '' });
      fetchUsers();
      showToast('User created', 'success');
    } catch (err) {
      const fields = parseFieldErrors(err);
      if (Object.keys(fields).length) setFormErrors(fields);
      handleErrorToast(err, showToast, 'Failed to create user');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormErrors({});
    
    try {
      const payload: any = {
        role: formData.role,
        orgUnitId: formData.orgUnitId ? parseInt(formData.orgUnitId) : null,
        isActive: editingUser.isActive
      };
      
      await apiClient.put(`/api/superadmin/users/${editingUser.id}`, payload);
      setEditingUser(null);
      setFormData({ username: '', password: '', role: 'BUSINESS_PARTNER', orgUnitId: '' });
      fetchUsers();
      showToast('User updated', 'success');
    } catch (err) {
      const fields = parseFieldErrors(err);
      if (Object.keys(fields).length) setFormErrors(fields);
      handleErrorToast(err, showToast, 'Failed to update user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setResetErrors({});
    
    try {
      await apiClient.post(`/api/superadmin/users/${resetPasswordUser.id}/reset-password`, {
        newPassword: resetPasswordData.newPassword
      });
      setResetPasswordUser(null);
      setResetPasswordData({ newPassword: '' });
      fetchUsers();
      showToast('Password reset', 'success');
    } catch (err) {
      const fields = parseFieldErrors(err);
      if (Object.keys(fields).length) setResetErrors(fields);
      handleErrorToast(err, showToast, 'Failed to reset password');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiClient.put(`/api/superadmin/users/${user.id}`, {
        isActive: !user.isActive
      });
      fetchUsers();
      showToast(`User ${!user.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Failed to update user status');
    }
  };

  const openCreateModal = () => {
    setFormData({ username: '', password: '', role: 'BUSINESS_PARTNER', orgUnitId: '' });
    setShowCreateModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      orgUnitId: user.orgUnitId ? user.orgUnitId.toString() : ''
    });
  };

  const openResetPasswordModal = (user: User) => {
    setResetPasswordUser(user);
    setResetPasswordData({ newPassword: '' });
  };

  const filteredOrgUnits = orgUnits.filter(orgUnit => {
    if (formData.role === 'BUSINESS_PARTNER') {
      return orgUnit.type === 'BUSINESS_PARTNER';
    } else if (formData.role === 'FRANCHISE') {
      return orgUnit.type === 'FRANCHISE';
    } else if (['CENTER_MANAGER', 'HEAD_COORDINATOR', 'COORDINATOR', 'ADMISSIONS', 'TEACHER'].includes(formData.role)) {
      return orgUnit.type === 'CENTER';
    }
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded shadow p-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Org Unit</label>
            <select
              value={filters.orgUnitId}
              onChange={(e) => setFilters({...filters, orgUnitId: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Org Units</option>
              {orgUnits.map(orgUnit => (
                <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.code} - {orgUnit.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({...filters, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Roles</option>
              <option value="SUPERADMIN">Superadmin</option>
              <option value="BUSINESS_PARTNER">Business Partner</option>
              <option value="FRANCHISE">Franchise</option>
              <option value="CENTER_MANAGER">Center Manager</option>
              <option value="HEAD_COORDINATOR">Head Coordinator</option>
              <option value="COORDINATOR">Coordinator</option>
              <option value="ADMISSIONS">Admissions</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              placeholder="Username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={openCreateModal}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Add User
            </button>
          </div>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Users</h2>
        </div>
        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              <p className="mb-2">No users match your filters.</p>
              <button onClick={openCreateModal} className="btn btn-primary btn-sm">
                Create first user
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Org Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.orgUnitCode ? `${user.orgUnitCode} - ${user.orgUnitName}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(user)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                {editingUser ? 'Edit User' : 'Create User'}
              </h3>
            </div>
            <form onSubmit={editingUser ? handleUpdate : handleCreate} className="p-6">
              {!editingUser && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                {formErrors.username && <p className="text-sm text-red-600 mt-1">{formErrors.username}</p>}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required={!editingUser}
                />
                {formErrors.password && <p className="text-sm text-red-600 mt-1">{formErrors.password}</p>}
              </div>
            </>
          )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value, orgUnitId: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="SUPERADMIN">Superadmin</option>
                  <option value="BUSINESS_PARTNER">Business Partner</option>
                  <option value="FRANCHISE">Franchise</option>
                  <option value="CENTER_MANAGER">Center Manager</option>
                  <option value="HEAD_COORDINATOR">Head Coordinator</option>
                  <option value="COORDINATOR">Coordinator</option>
                  <option value="ADMISSIONS">Admissions</option>
                  <option value="TEACHER">Teacher</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Org Unit
                </label>
              <select
                value={formData.orgUnitId}
                onChange={(e) => setFormData({...formData, orgUnitId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select Org Unit</option>
                {filteredOrgUnits.map(orgUnit => (
                  <option key={orgUnit.id} value={orgUnit.id}>
                    {orgUnit.code} - {orgUnit.name}
                  </option>
                ))}
              </select>
              {formErrors.orgUnitId && <p className="text-sm text-red-600 mt-1">{formErrors.orgUnitId}</p>}
            </div>
            
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                Reset Password for {resetPasswordUser.username}
              </h3>
            </div>
            <form onSubmit={handleResetPassword} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={resetPasswordData.newPassword}
                  onChange={(e) => setResetPasswordData({...resetPasswordData, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                {resetErrors.newPassword && <p className="text-sm text-red-600 mt-1">{resetErrors.newPassword}</p>}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminUsers;
