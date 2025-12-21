import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StandardTable from '../components/ui/StandardTable';

interface Transaction {
  id: number;
  amount: number;
  type: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
  orgUnitCode: string;
  orgUnitName: string;
}

const FinanceTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/finance/transactions');
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError('Failed to load transactions');
      console.error('Error fetching transactions:', err);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Finance Transactions</h1>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Finance Transactions</h1>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <StandardTable
        headers={[
          { key: 'date', label: 'Date' },
          { key: 'center', label: 'Center' },
          { key: 'amount', label: 'Amount' },
          { key: 'method', label: 'Method' },
          { key: 'notes', label: 'Notes' }
        ]}
        data={transactions}
        renderCell={(transaction, headerKey) => {
          switch (headerKey) {
            case 'date':
              return formatDate(transaction.createdAt);
            case 'center':
              return (
                <>
                  <div>{transaction.orgUnitCode}</div>
                  <div className="text-gray-500 text-xs">{transaction.orgUnitName}</div>
                </>
              );
            case 'amount':
              return formatCurrency(transaction.amount);
            case 'method':
              return transaction.method || '-';
            case 'notes':
              return transaction.notes || '-';
            default:
              return null;
          }
        }}
      />
      
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700">
          <strong>Note:</strong> This table shows all payment transactions received from centers.
        </p>
      </div>
    </div>
  );
};

export default FinanceTransactions;