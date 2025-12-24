import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../utils/apiClient';
import { parseErrorMessage } from '../utils/errorHandling';
import { formatCurrency, formatDate, formatDateTime, statusChip } from '../utils/formatters';
import {
  buildExportDetailUrl,
  fetchSettlement,
  finalizeSettlement,
  markSettlementPaid,
  Settlement,
} from '../api/settlementsClient';

type FinanceSettlementDetailProps = {
  basePath?: string;
  readOnly?: boolean;
};

const FinanceSettlementDetail: React.FC<FinanceSettlementDetailProps> = ({
  basePath = '/superadmin/finance-settlements',
  readOnly = false,
}) => {
  const { id } = useParams();
  const settlementId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  const buildErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      const message = err.message || fallback;
      return err.code ? `${message} [${err.code}]` : message;
    }
    return parseErrorMessage(err, fallback);
  };

  const getExportFilename = (contentDisposition: string | null, fallback: string) => {
    if (!contentDisposition) return fallback;
    const match = contentDisposition.match(/filename="([^"]+)"/i);
    return match?.[1] || fallback;
  };

  const buildExportError = async (response: Response, fallback: string) => {
    let message = fallback;
    let code: string | undefined;
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
      code = payload?.error?.code || payload?.code;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message, false, code);
  };

  const downloadCsv = async (url: string, fallbackFilename: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!response.ok) {
      await buildExportError(response, 'Failed to export settlement');
    }
    const blob = await response.blob();
    const filename = getExportFilename(response.headers.get('Content-Disposition'), fallbackFilename);
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const loadSettlement = async () => {
    if (!Number.isFinite(settlementId)) return;
    try {
      setLoading(true);
      const data = await fetchSettlement(settlementId);
      setSettlement(data);
      setError(null);
      setPaymentRef(data.paymentRef || '');
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to load settlement');
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId]);

  const handleFinalize = async () => {
    if (!settlement) return;
    const confirmed = window.confirm('Finalize this settlement? This locks the snapshot.');
    if (!confirmed) return;
    try {
      setProcessing(true);
      await finalizeSettlement(settlement.id);
      showToast('Settlement finalized', 'success');
      loadSettlement();
    } catch (err) {
      showToast(buildErrorMessage(err, 'Failed to finalize settlement'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!settlement) return;
    const confirmed = window.confirm('Mark this settlement as paid?');
    if (!confirmed) return;
    try {
      setProcessing(true);
      await markSettlementPaid(settlement.id, paymentRef || undefined);
      showToast('Settlement marked paid', 'success');
      loadSettlement();
    } catch (err) {
      showToast(buildErrorMessage(err, 'Failed to mark settlement paid'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCsv = async () => {
    if (!settlement) return;
    try {
      setExporting(true);
      await downloadCsv(buildExportDetailUrl(settlement.id), `settlement_${settlement.id}.csv`);
    } catch (err) {
      showToast(buildErrorMessage(err, 'Failed to export settlement'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatPeriodEnd = (value: string) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && date.getHours() === 0 && date.getMinutes() === 0) {
      const adjusted = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      return formatDate(adjusted);
    }
    return formatDate(value);
  };

  if (!Number.isFinite(settlementId)) {
    return <div>Invalid settlement id.</div>;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Settlement not found'}</p>
        <button className="btn btn-outline btn-sm mt-3" onClick={() => navigate(basePath)}>
          Back to settlements
        </button>
      </div>
    );
  }

  const canFinalize = !readOnly && settlement.status === 'DRAFT';
  const canMarkPaid = !readOnly && settlement.status === 'FINALIZED' && settlement.paymentStatus === 'UNPAID';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={basePath} className="text-blue-600 text-sm">
            &larr; Back to settlements
          </Link>
          <h2 className="text-xl font-semibold mt-2">Settlement #{settlement.id}</h2>
          <p className="text-sm text-gray-500">
            Period: {formatDate(settlement.periodStart)} - {formatPeriodEnd(settlement.periodEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          {!readOnly && (
            <>
              <button className="btn btn-outline btn-sm" disabled={!canFinalize || processing} onClick={handleFinalize}>
                Finalize
              </button>
              <button className="btn btn-primary btn-sm" disabled={!canMarkPaid || processing} onClick={handleMarkPaid}>
                Mark Paid
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error! </strong>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500">Gross Collected</div>
          <div className="text-xl font-semibold">{formatCurrency(settlement.grossCollected)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">Net Collected</div>
          <div className="text-xl font-semibold">{formatCurrency(settlement.netCollected)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">Net Payable</div>
          <div className="text-xl font-semibold">{formatCurrency(settlement.netPayable)}</div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Snapshot Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Revenue Share %</div>
            <div className="font-medium">{settlement.revenueSharePercent}%</div>
          </div>
          <div>
            <div className="text-gray-500">Revenue Share Amount</div>
            <div className="font-medium">{formatCurrency(settlement.revenueShareAmount)}</div>
          </div>
          <div>
            <div className="text-gray-500">Refunds</div>
            <div className="font-medium">{formatCurrency(settlement.refunds)}</div>
          </div>
          <div>
            <div className="text-gray-500">Adjustments</div>
            <div className="font-medium">{formatCurrency(settlement.adjustments)}</div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Status &amp; Payment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Status</div>
            <div className="font-medium">{statusChip(settlement.status, settlement.status === 'DRAFT' ? 'yellow' : 'blue')}</div>
          </div>
          <div>
            <div className="text-gray-500">Payment Status</div>
            <div className="font-medium">{statusChip(settlement.paymentStatus, settlement.paymentStatus === 'PAID' ? 'green' : 'yellow')}</div>
          </div>
          <div>
            <div className="text-gray-500">Computed At</div>
            <div className="font-medium">{formatDateTime(settlement.computedAt)}</div>
          </div>
          <div>
            <div className="text-gray-500">Finalized At</div>
            <div className="font-medium">{formatDateTime(settlement.finalizedAt)}</div>
          </div>
          <div>
            <div className="text-gray-500">Finalized By</div>
            <div className="font-medium">{settlement.finalizedByUserId ?? '-'}</div>
          </div>
          <div>
            <div className="text-gray-500">Paid At</div>
            <div className="font-medium">{formatDateTime(settlement.paidAt)}</div>
          </div>
          <div>
            <div className="text-gray-500">Paid By</div>
            <div className="font-medium">{settlement.paidByUserId ?? '-'}</div>
          </div>
          <div>
            <div className="text-gray-500">Payment Reference</div>
            <input
              className="form-control w-full mt-1"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Optional"
              disabled={!canMarkPaid}
            />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Collections Count</div>
            <div className="font-medium">{settlement.breakdown?.collectionsCount ?? 0}</div>
          </div>
          <div>
            <div className="text-gray-500">Dues Raised</div>
            <div className="font-medium">{formatCurrency(settlement.breakdown?.duesRaised ?? 0)}</div>
          </div>
          <div>
            <div className="text-gray-500">Outstanding Amount</div>
            <div className="font-medium">{formatCurrency(settlement.breakdown?.outstandingAmount ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Warnings</h3>
        {settlement.warnings && settlement.warnings.length > 0 ? (
          <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
            {settlement.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No warnings detected.</p>
        )}
      </div>
    </div>
  );
};

export default FinanceSettlementDetail;
