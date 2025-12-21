import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';
import { useToast } from '../contexts/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import { formatCurrency } from '../utils/formatters';
import { handleErrorToast, parseErrorMessage } from '../utils/errorHandling';

interface CenterDues {
  totalStudents: number;
  outstandingAmount: number;
}

const CenterFinance: React.FC = () => {
  const { showToast } = useToast();
  const [dues, setDues] = useState<CenterDues>({ totalStudents: 0, outstandingAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: '',
    notes: ''
  });
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCenterDues();
  }, []);

  const fetchCenterDues = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/finance/center');
      setDues(data);
      setError(null);
    } catch (err) {
      const msg = parseErrorMessage(err, 'Failed to load center dues');
      setError(msg);
      console.error('Error fetching center dues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessing(true);
      setPaymentError(null);
      setPaymentSuccess(null);
      setFieldErrors({});

      if (!paymentData.amount || paymentData.amount <= 0) {
        setFieldErrors({ amount: 'Enter a positive amount' });
        setProcessing(false);
        return;
      }
      
      await apiClient.post('/api/finance/center/transactions', paymentData);
      
      setPaymentSuccess('Payment recorded successfully');
      setPaymentData({ amount: 0, method: '', notes: '' });
      setShowPaymentForm(false);
      
      // Refresh dues after payment
      fetchCenterDues();
      setTimeout(() => setPaymentSuccess(null), 3000);
      showToast('Payment recorded', 'success');
    } catch (err) {
      const msg = handleErrorToast(err, showToast, 'Failed to record payment');
      setPaymentError(msg);
      const amountError = (err as any)?.details?.find?.((d: any) => d.path?.includes('amount'))?.message;
      if (amountError) setFieldErrors({ amount: amountError });
      console.error('Error recording payment:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseInt(value) || 0 : value
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Center Finance</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24" />
          ))}
        </div>
        <div className="mt-6 bg-white rounded-lg shadow p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Center Finance</h1>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {/* Dues Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Active Students</h2>
          <p className="text-3xl font-bold text-blue-600">{dues.totalStudents}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Outstanding Amount</h2>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(dues.outstandingAmount)}</p>
        </div>
      </div>
      
      {/* Payment Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Record Payment</h2>
          <button
            onClick={() => setShowPaymentForm(!showPaymentForm)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {showPaymentForm ? 'Cancel' : 'Record Payment'}
          </button>
        </div>
        
        {dues.outstandingAmount === 0 && !showPaymentForm && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            No outstanding dues right now. You can still record a payment manually if needed.
          </div>
        )}
        
        {paymentSuccess && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Success! </strong>
            <span className="block sm:inline">{paymentSuccess}</span>
          </div>
        )}
        
        {paymentError && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{paymentError}</span>
          </div>
        )}
        
        {showPaymentForm && (
          <form onSubmit={handlePaymentSubmit} className="mt-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
                Amount (₹)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={paymentData.amount}
                onChange={handlePaymentChange}
                min="0"
                max={dues.outstandingAmount}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
              {fieldErrors.amount && <p className="text-sm text-red-600 mt-1">{fieldErrors.amount}</p>}
              <p className="mt-1 text-sm text-gray-500">
                Maximum: {formatCurrency(dues.outstandingAmount)}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="method">
                Payment Method
              </label>
              <select
                id="method"
                name="method"
                value={paymentData.method}
                onChange={handlePaymentChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              >
                <option value="">Select Method</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={paymentData.notes}
                onChange={handlePaymentChange}
                rows={3}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={processing}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700">
          <strong>Note:</strong> Record payments received for outstanding dues. Payments will be reflected in the superadmin finance records.
        </p>
      </div>
    </div>
  );
};

export default CenterFinance;
