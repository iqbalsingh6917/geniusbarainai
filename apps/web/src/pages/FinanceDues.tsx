import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StandardTable from '../components/ui/StandardTable';

interface CenterDues {
  id: number;
  code: string;
  name: string;
  totalStudents: number;
  outstandingAmount: number;
}

const FinanceDues: React.FC = () => {
  const [dues, setDues] = useState<CenterDues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/finance/dues');
      setDues(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dues data');
      console.error('Error fetching dues:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedDues = () => {
    if (!sortConfig) return dues;
    
    return [...dues].sort((a, b) => {
      // @ts-ignore
      const aValue = a[sortConfig.key];
      // @ts-ignore
      const bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'outstandingAmount') {
        // For currency values, we want to sort numerically
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // For string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      // For numeric values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Finance Dues</h1>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Finance Dues</h1>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <StandardTable
        headers={[
          { key: 'code', label: 'Center Code', sortable: true },
          { key: 'name', label: 'Center Name', sortable: true },
          { key: 'totalStudents', label: 'Active Students', sortable: true },
          { key: 'outstandingAmount', label: 'Outstanding Amount', sortable: true },
          { key: 'actions', label: 'Actions' }
        ]}
        data={getSortedDues()}
        sortConfig={sortConfig}
        onSort={handleSort}
        renderCell={(center, headerKey) => {
          switch (headerKey) {
            case 'code':
              return <span className="font-medium text-gray-900">{center.code}</span>;
            case 'name':
              return center.name;
            case 'totalStudents':
              return center.totalStudents;
            case 'outstandingAmount':
              return formatCurrency(center.outstandingAmount);
            case 'actions':
              return (
                <button className="text-blue-600 hover:text-blue-900">
                  View Details
                </button>
              );
            default:
              return null;
          }
        }}
      />
      
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700">
          <strong>Note:</strong> This table shows outstanding dues from all centers based on the current fee settings.
        </p>
      </div>
    </div>
  );
};

export default FinanceDues;