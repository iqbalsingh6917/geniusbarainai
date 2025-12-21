import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

interface FeeSetting {
  amountPerStudent: number;
  currency: string;
}

const FinanceSettings: React.FC = () => {
  const [feeSetting, setFeeSetting] = useState<FeeSetting>({ amountPerStudent: 0, currency: 'INR' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchFeeSettings();
  }, []);

  const fetchFeeSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/finance/settings');
      setFeeSetting(data);
      setError(null);
    } catch (err) {
      setError('Failed to load fee settings');
      console.error('Error fetching fee settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccess(null);
      setError(null);
      
      await apiClient.put('/api/finance/settings', feeSetting);
      
      setSuccess('Fee settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update fee settings');
      console.error('Error updating fee settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFeeSetting(prev => ({
      ...prev,
      [name]: name === 'amountPerStudent' ? parseInt(value) || 0 : value
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Finance Settings</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Finance Settings</h1>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Success! </strong>
          <span className="block sm:inline">{success}</span>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSave}>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amountPerStudent">
              Amount Per Student (₹)
            </label>
            <input
              type="number"
              id="amountPerStudent"
              name="amountPerStudent"
              value={feeSetting.amountPerStudent}
              onChange={handleChange}
              min="0"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              This is the flat license fee charged per active student enrollment
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="currency">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={feeSetting.currency}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="INR">INR (Indian Rupee)</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">Fee Model A: Flat Per-Student License Fee</h2>
        <p className="text-blue-700">
          Centers pay a fixed amount per active student enrollment. No royalties or revenue sharing.
        </p>
      </div>
    </div>
  );
};

export default FinanceSettings;