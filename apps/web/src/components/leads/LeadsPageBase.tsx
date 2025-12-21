import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeadListItem, LeadPayload, LeadStage, LeadSummary } from '../../api/salesLeadsClient';
import LeadDetailDrawer from './LeadDetailDrawer';
import Skeleton from '../ui/Skeleton';
import { useToast } from '../../contexts/ToastContext';
import { handleErrorToast, parseErrorMessage, parseFieldErrors } from '../../utils/errorHandling';

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'];

type LeadsPageBaseProps = {
  title: string;
  summaryLoader: () => Promise<LeadSummary>;
  listLoader: (page?: number, pageSize?: number) => Promise<{
    items: LeadListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  createLead: (payload: LeadPayload) => Promise<LeadListItem>;
  updateLead: (id: number, payload: Partial<LeadPayload>) => Promise<LeadListItem>;
  updateStage: (id: number, stage: LeadStage) => Promise<LeadListItem>;
};

const LeadsPageBase: React.FC<LeadsPageBaseProps> = ({
  title,
  summaryLoader,
  listLoader,
  createLead,
  updateLead,
  updateStage,
}) => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get('stage') || '');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<LeadPayload>({ firstName: '', stage: 'NEW' });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, listRes] = await Promise.all([summaryLoader(), listLoader()]);
      setSummary(summaryRes);
      setLeads(listRes.items);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load leads', err);
      setError(parseErrorMessage(err, 'Failed to load leads. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await summaryLoader();
      setSummary(res);
    } catch (err) {
      console.error('Failed to refresh lead summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStage = stageFilter ? (lead.stage || '').toUpperCase() === stageFilter.toUpperCase() : true;
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        [lead.firstName, lead.lastName, lead.contactEmail, lead.contactPhone]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(term));
      return matchesStage && matchesSearch;
    });
  }, [leads, stageFilter, search]);

  const handleCreate = async () => {
    setCreating(true);
  };

  const openDrawer = (lead: LeadListItem) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const handleSave = async (payload: Partial<LeadPayload>) => {
    if (!selectedLead) return;
    try {
      const updated = await updateLead(selectedLead.id, payload);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      await refreshSummary();
      showToast('Lead updated', 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update lead');
      throw err;
    }
  };

  const handleStageChange = async (stage: LeadStage, leadId?: number) => {
    const targetId = leadId ?? selectedLead?.id;
    if (!targetId) return;
    try {
      const updated = await updateStage(targetId, stage);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      await refreshSummary();
      showToast(`Stage set to ${stage}`, 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update lead stage');
      throw err;
    }
  };

  const submitCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});
    if (!createForm.firstName.trim()) {
      setCreateErrors({ firstName: 'Name is required' });
      return;
    }
    try {
      const created = await createLead(createForm);
      setLeads((prev) => [created, ...prev]);
      await refreshSummary();
      showToast('Lead created', 'success');
      setCreateForm({ firstName: '', lastName: '', contactEmail: '', contactPhone: '', stage: 'NEW' });
      setCreating(false);
    } catch (err) {
      const fields = parseFieldErrors(err);
      if (Object.keys(fields).length) setCreateErrors(fields);
      handleErrorToast(err, showToast, 'Could not create lead');
    }
  };

  const setStageFromCard = (stage: string) => {
    setStageFilter(stage);
    setSearchParams((p) => {
      const params = new URLSearchParams(p);
      if (stage) params.set('stage', stage);
      else params.delete('stage');
      return params;
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20" />
          ))}
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded" role="alert" aria-live="assertive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex gap-2">
          <input
            className="form-control"
            placeholder="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-control"
            value={stageFilter}
            onChange={(e) => setStageFromCard(e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleCreate} aria-label="Create lead">
            New lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {STAGES.map((s) => (
          <div
            key={s}
            className={`bg-white rounded shadow p-3 cursor-pointer hover:ring-2 hover:ring-blue-300 ${
              stageFilter === s ? 'ring-2 ring-blue-400' : ''
            }`}
            onClick={() => setStageFromCard(s)}
          >
            <div className="text-sm text-gray-600">{s.replace('_', ' ')}</div>
            <div className="text-xl font-semibold">
              {loadingSummary ? '…' : summary?.byStage?.[s] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded shadow">
        <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm text-gray-600">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-sm text-gray-500" colSpan={6}>
                    No leads match your filters. Adjust stage/search or add a new lead.
                  </td>
                </tr>
              )}
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-t text-sm">
                  <td className="px-3 py-2 font-medium">
                    {lead.firstName} {lead.lastName || ''}
                  </td>
                  <td className="px-3 py-2">
                    <div>{lead.contactPhone || '-'}</div>
                    <div className="text-xs text-gray-500">{lead.contactEmail || ''}</div>
                  </td>
                  <td className="px-3 py-2">{lead.stage || 'NEW'}</td>
                  <td className="px-3 py-2">{lead.source || '-'}</td>
                  <td className="px-3 py-2">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <select
                        className="form-control form-control-sm"
                        value={lead.stage || 'NEW'}
                        onChange={async (e) => {
                          const newStage = e.target.value as LeadStage;
                          await handleStageChange(newStage, lead.id);
                        }}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-outline btn-sm" onClick={() => openDrawer(lead)}>
                        View / Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="p-6 text-center text-gray-600">
            <p className="mb-2">No leads match your filters yet.</p>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              Create your first lead
            </button>
          </div>
        )}
      </div>

      <LeadDetailDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onStageChange={(stage) => handleStageChange(stage)}
      />

      {creating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Create Lead</h3>
              <button className="text-gray-500" onClick={() => setCreating(false)} aria-label="Close create lead form">
                ✕
              </button>
            </div>
            <form onSubmit={submitCreateForm} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First name</label>
                <input
                  className="form-control mt-1"
                  value={createForm.firstName || ''}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  required
                />
                {createErrors.firstName && <p className="text-sm text-red-600 mt-1">{createErrors.firstName}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last name</label>
                  <input
                    className="form-control mt-1"
                    value={createForm.lastName || ''}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stage</label>
                  <select
                    className="form-control mt-1"
                    value={createForm.stage || 'NEW'}
                    onChange={(e) => setCreateForm({ ...createForm, stage: e.target.value as LeadStage })}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    className="form-control mt-1"
                    type="email"
                    value={createForm.contactEmail || ''}
                    onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                  />
                  {createErrors.contactEmail && <p className="text-sm text-red-600 mt-1">{createErrors.contactEmail}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    className="form-control mt-1"
                    value={createForm.contactPhone || ''}
                    onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="form-control mt-1"
                  rows={3}
                  value={createForm.notes || ''}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-outline" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPageBase;
