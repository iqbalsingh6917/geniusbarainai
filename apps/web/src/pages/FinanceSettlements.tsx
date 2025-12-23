import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StandardTable from '../components/ui/StandardTable';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../utils/apiClient';
import { parseErrorMessage } from '../utils/errorHandling';
import { formatCurrency, formatDate, formatDateTime, statusChip } from '../utils/formatters';
import { fetchOrgUnits, OrgUnit } from '../api/orgUnitsClient';
import {
  Settlement,
  SettlementPaymentStatus,
  SettlementPreview,
  SettlementStatus,
  createSettlement,
  finalizeSettlement,
  listSettlements,
  markSettlementPaid,
  previewSettlement,
} from '../api/settlementsClient';

type DraftFormState = {
  orgUnitId: string;
  periodStart: string;
  periodEnd: string;
  revenueSharePercent: string;
};

type FilterState = {
  orgUnitId: string;
  status: SettlementStatus | '';
  paymentStatus: SettlementPaymentStatus | '';
  periodStart: string;
  periodEnd: string;
};

type OrgUnitMode = 'select' | 'locked';

type FinanceSettlementsProps = {
  basePath?: string;
  orgUnitMode?: OrgUnitMode;
  lockedOrgUnitId?: number | null;
  orgUnitsLoader?: () => Promise<OrgUnit[]>;
};

const PAGE_SIZE = 20;

const FinanceSettlements: React.FC<FinanceSettlementsProps> = ({
  basePath = '/superadmin/finance-settlements',
  orgUnitMode = 'select',
  lockedOrgUnitId = null,
  orgUnitsLoader = fetchOrgUnits,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const lockedOrgUnitValue =
    orgUnitMode === 'locked' && lockedOrgUnitId ? String(lockedOrgUnitId) : '';
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    orgUnitId: lockedOrgUnitValue,
    status: '',
    paymentStatus: '',
    periodStart: '',
    periodEnd: '',
  });
  const [draftForm, setDraftForm] = useState<DraftFormState>({
    orgUnitId: lockedOrgUnitValue,
    periodStart: '',
    periodEnd: '',
    revenueSharePercent: '',
  });

  const orgUnitMap = useMemo(() => {
    return new Map(orgUnits.map((unit) => [unit.id, unit]));
  }, [orgUnits]);

  useEffect(() => {
    if (orgUnitMode !== 'locked' || !lockedOrgUnitId) return;
    const value = String(lockedOrgUnitId);
    setFilters((prev) => (prev.orgUnitId === value ? prev : { ...prev, orgUnitId: value }));
    setDraftForm((prev) => (prev.orgUnitId === value ? prev : { ...prev, orgUnitId: value }));
  }, [orgUnitMode, lockedOrgUnitId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    const loadOrgUnits = async () => {
      try {
        const data = await orgUnitsLoader();
        setOrgUnits(data);
      } catch (err) {
        showToast(buildErrorMessage(err, 'Failed to load org units'), 'error');
      }
    };
    loadOrgUnits();
  }, [orgUnitsLoader, showToast]);

  useEffect(() => {
    fetchSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const buildErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      const message = err.message || fallback;
      return err.code ? `${message} [${err.code}]` : message;
    }
    return parseErrorMessage(err, fallback);
  };

  const getOrgUnitLabel = (orgUnitId?: number | null) => {
    if (!orgUnitId) return 'Unknown';
    const unit = orgUnitMap.get(orgUnitId);
    if (unit) return `${unit.code} - ${unit.name}`;
    return `#${orgUnitId}`;
  };

  const lockedOrgUnitLabel = lockedOrgUnitId ? getOrgUnitLabel(lockedOrgUnitId) : 'Unavailable';

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const data = await listSettlements({
        orgUnitId: filters.orgUnitId ? Number(filters.orgUnitId) : undefined,
        status: filters.status || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        periodStart: filters.periodStart || undefined,
        periodEnd: filters.periodEnd || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setSettlements(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to load settlements');
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
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

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setPage(1);
    const orgUnitId =
      orgUnitMode === 'locked' && lockedOrgUnitId ? String(lockedOrgUnitId) : '';
    setFilters({ orgUnitId, status: '', paymentStatus: '', periodStart: '', periodEnd: '' });
  };

  const validateDraft = () => {
    const nextErrors: Record<string, string> = {};
    if (!draftForm.orgUnitId) nextErrors.orgUnitId = 'Select an org unit';
    if (!draftForm.periodStart) nextErrors.periodStart = 'Select a period start';
    if (!draftForm.periodEnd) nextErrors.periodEnd = 'Select a period end';
    setDraftErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePreview = async () => {
    if (!validateDraft()) return;
    try {
      setPreviewing(true);
      setPreviewError(null);
      const data = await previewSettlement({
        orgUnitId: Number(draftForm.orgUnitId),
        periodStart: draftForm.periodStart,
        periodEnd: draftForm.periodEnd,
        revenueSharePercent: draftForm.revenueSharePercent
          ? Number(draftForm.revenueSharePercent)
          : undefined,
      });
      setPreview(data);
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to load settlement preview');
      setPreviewError(message);
      setPreview(null);
      showToast(message, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!validateDraft()) return;
    if (!preview) {
      showToast('Preview the settlement before creating a draft', 'warning');
      return;
    }
    try {
      setCreating(true);
      const created = await createSettlement({
        orgUnitId: Number(draftForm.orgUnitId),
        periodStart: draftForm.periodStart,
        periodEnd: draftForm.periodEnd,
        revenueSharePercent: draftForm.revenueSharePercent
          ? Number(draftForm.revenueSharePercent)
          : undefined,
      });
      showToast(`Draft created (#${created.id})`, 'success');
      setPreview(null);
      const orgUnitId =
        orgUnitMode === 'locked' && lockedOrgUnitId ? String(lockedOrgUnitId) : '';
      setDraftForm({ orgUnitId, periodStart: '', periodEnd: '', revenueSharePercent: '' });
      fetchSettlements();
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to create settlement draft');
      showToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleFinalize = async (settlement: Settlement) => {
    const confirmed = window.confirm('Finalize this settlement? This locks the snapshot.');
    if (!confirmed) return;
    try {
      setActionId(settlement.id);
      await finalizeSettlement(settlement.id);
      showToast('Settlement finalized', 'success');
      fetchSettlements();
    } catch (err) {
      showToast(buildErrorMessage(err, 'Failed to finalize settlement'), 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleMarkPaid = async (settlement: Settlement) => {
    const ref = window.prompt('Payment reference (optional):', settlement.paymentRef || '');
    if (ref === null) return;
    try {
      setActionId(settlement.id);
      await markSettlementPaid(settlement.id, ref || undefined);
      showToast('Settlement marked paid', 'success');
      fetchSettlements();
    } catch (err) {
      showToast(buildErrorMessage(err, 'Failed to mark settlement paid'), 'error');
    } finally {
      setActionId(null);
    }
  };

  const renderStatusChip = (status: SettlementStatus) => {
    switch (status) {
      case 'DRAFT':
        return statusChip('DRAFT', 'yellow');
      case 'FINALIZED':
        return statusChip('FINALIZED', 'blue');
      case 'PAID':
        return statusChip('PAID', 'green');
      default:
        return statusChip(status, 'gray');
    }
  };

  const renderPaymentChip = (status: SettlementPaymentStatus) =>
    status === 'PAID' ? statusChip('PAID', 'green') : statusChip('UNPAID', 'yellow');

  if (loading && settlements.length === 0) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error! </strong>
          <span>{error}</span>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settlement Filters</h2>
          <button className="btn btn-outline btn-sm" onClick={handleResetFilters}>
            Clear filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Org Unit</label>
            {orgUnitMode === 'locked' ? (
              <input className="form-control w-full" value={lockedOrgUnitLabel} disabled />
            ) : (
              <select
                className="form-control w-full"
                value={filters.orgUnitId}
                onChange={(e) => handleFilterChange('orgUnitId', e.target.value)}
              >
                <option value="">All</option>
                {orgUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select
              className="form-control w-full"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value as SettlementStatus)}
            >
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="FINALIZED">FINALIZED</option>
              <option value="PAID">PAID</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Payment Status</label>
            <select
              className="form-control w-full"
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value as SettlementPaymentStatus)}
            >
              <option value="">All</option>
              <option value="UNPAID">UNPAID</option>
              <option value="PAID">PAID</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Period Start</label>
            <input
              type="date"
              className="form-control w-full"
              value={filters.periodStart}
              onChange={(e) => handleFilterChange('periodStart', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Period End</label>
            <input
              type="date"
              className="form-control w-full"
              value={filters.periodEnd}
              onChange={(e) => handleFilterChange('periodEnd', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Settlement Draft</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Org Unit</label>
            {orgUnitMode === 'locked' ? (
              <input className="form-control w-full" value={lockedOrgUnitLabel} disabled />
            ) : (
              <select
                className="form-control w-full"
                value={draftForm.orgUnitId}
                onChange={(e) => setDraftForm((prev) => ({ ...prev, orgUnitId: e.target.value }))}
              >
                <option value="">Select</option>
                {orgUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            )}
            {draftErrors.orgUnitId && <p className="text-xs text-red-600 mt-1">{draftErrors.orgUnitId}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Period Start</label>
            <input
              type="date"
              className="form-control w-full"
              value={draftForm.periodStart}
              onChange={(e) => setDraftForm((prev) => ({ ...prev, periodStart: e.target.value }))}
            />
            {draftErrors.periodStart && <p className="text-xs text-red-600 mt-1">{draftErrors.periodStart}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Period End</label>
            <input
              type="date"
              className="form-control w-full"
              value={draftForm.periodEnd}
              onChange={(e) => setDraftForm((prev) => ({ ...prev, periodEnd: e.target.value }))}
            />
            {draftErrors.periodEnd && <p className="text-xs text-red-600 mt-1">{draftErrors.periodEnd}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Revenue Share %</label>
            <input
              type="number"
              min={0}
              max={100}
              className="form-control w-full"
              value={draftForm.revenueSharePercent}
              onChange={(e) => setDraftForm((prev) => ({ ...prev, revenueSharePercent: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline btn-sm" onClick={handlePreview} disabled={previewing}>
            {previewing ? 'Previewing...' : 'Preview'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleCreateDraft} disabled={creating}>
            {creating ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
        {previewError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
            {previewError}
          </div>
        )}
        {preview && (
          <div className="bg-gray-50 border rounded p-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <div className="text-xs text-gray-500">Gross Collected</div>
                <div className="font-semibold">{formatCurrency(preview.grossCollected)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Net Collected</div>
                <div className="font-semibold">{formatCurrency(preview.netCollected)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Net Payable</div>
                <div className="font-semibold">{formatCurrency(preview.netPayable)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Dues Raised</div>
                <div className="font-semibold">{formatCurrency(preview.breakdown.duesRaised)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Outstanding</div>
                <div className="font-semibold">{formatCurrency(preview.breakdown.outstandingAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Collections Count</div>
                <div className="font-semibold">{preview.breakdown.collectionsCount}</div>
              </div>
            </div>
            {preview.warnings.length > 0 ? (
              <div className="text-xs text-amber-700">
                <div className="font-semibold mb-1">Warnings</div>
                <ul className="list-disc list-inside space-y-1">
                  {preview.warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No warnings detected.</div>
            )}
          </div>
        )}
      </div>

      <StandardTable
        headers={[
          { key: 'orgUnit', label: 'Org Unit' },
          { key: 'period', label: 'Period' },
          { key: 'netPayable', label: 'Net Payable' },
          { key: 'status', label: 'Status' },
          { key: 'paymentStatus', label: 'Payment' },
          { key: 'computedAt', label: 'Computed' },
          { key: 'finalizedAt', label: 'Finalized' },
          { key: 'paidAt', label: 'Paid' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={settlements}
        renderCell={(settlement, headerKey) => {
          switch (headerKey) {
            case 'orgUnit': {
              const unit = orgUnitMap.get(settlement.orgUnitId);
              return unit ? (
                <div>
                  <div className="font-medium text-gray-900">{unit.code}</div>
                  <div className="text-xs text-gray-500">{unit.name}</div>
                </div>
              ) : (
                <span>#{settlement.orgUnitId}</span>
              );
            }
            case 'period':
              return (
                <div className="text-sm">
                  {formatDate(settlement.periodStart)} - {formatPeriodEnd(settlement.periodEnd)}
                </div>
              );
            case 'netPayable':
              return formatCurrency(settlement.netPayable);
            case 'status':
              return renderStatusChip(settlement.status);
            case 'paymentStatus':
              return renderPaymentChip(settlement.paymentStatus);
            case 'computedAt':
              return formatDateTime(settlement.computedAt);
            case 'finalizedAt':
              return formatDateTime(settlement.finalizedAt);
            case 'paidAt':
              return formatDateTime(settlement.paidAt);
            case 'actions': {
              const canFinalize = settlement.status === 'DRAFT';
              const canMarkPaid = settlement.status === 'FINALIZED' && settlement.paymentStatus === 'UNPAID';
              const isBusy = actionId === settlement.id;
              return (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => navigate(`${basePath}/${settlement.id}`)}
                  >
                    View
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={!canFinalize || isBusy}
                    onClick={() => handleFinalize(settlement)}
                  >
                    Finalize
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canMarkPaid || isBusy}
                    onClick={() => handleMarkPaid(settlement)}
                  >
                    Mark Paid
                  </button>
                </div>
              );
            }
            default:
              return null;
          }
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {rangeStart}–{rangeEnd} of {total}
        </p>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceSettlements;
