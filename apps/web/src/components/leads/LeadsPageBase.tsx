import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LeadAssistResult,
  LeadAssistSummaryItem,
  LeadDetail,
  LeadFollowUpFilter,
  LeadListFilters,
  LeadListItem,
  LeadMetricsSummary,
  LeadPayload,
  LeadStage,
  LeadSummary,
} from '../../api/salesLeadsClient';
import LeadDetailDrawer from './LeadDetailDrawer';
import Skeleton from '../ui/Skeleton';
import { useToast } from '../../contexts/ToastContext';
import { handleErrorToast, parseErrorMessage, parseFieldErrors } from '../../utils/errorHandling';
import { useAuth } from '../../contexts/AuthContext';

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'];
const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  TRIAL_BOOKED: 'Demo scheduled',
  TRIAL_DONE: 'Demo done',
  CONVERTED: 'Enrolled',
  LOST: 'Lost',
};
const STAGE_FLOW: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED'];

const getNextStage = (current: LeadStage) => {
  const idx = STAGE_FLOW.indexOf(current);
  if (idx === -1 || idx === STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[idx + 1];
};

const getStageOptions = (current: LeadStage) => {
  const options: LeadStage[] = [current];
  const next = getNextStage(current);
  if (next && !options.includes(next)) options.push(next);
  if (current !== 'LOST' && !options.includes('LOST')) options.push('LOST');
  return options;
};

const tierClasses: Record<'HOT' | 'WARM' | 'COLD', string> = {
  HOT: 'text-red-600',
  WARM: 'text-yellow-600',
  COLD: 'text-gray-500',
};

const getFollowUpStatus = (lead: LeadListItem) => {
  if (!lead.nextFollowUpAt) return null;
  if (lead.stage === 'CONVERTED' || lead.stage === 'LOST') return null;

  const followUpDate = new Date(lead.nextFollowUpAt);
  if (Number.isNaN(followUpDate.getTime())) return null;

  const now = new Date();
  if (followUpDate < now) {
    return { label: 'Overdue', className: 'text-red-600' };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (followUpDate >= start && followUpDate <= end) {
    return { label: 'Due today', className: 'text-yellow-600' };
  }

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (followUpDate <= nextWeek) {
    return { label: 'Next 7 days', className: 'text-blue-600' };
  }

  return null;
};

type LeadsPageBaseProps = {
  title: string;
  summaryLoader: () => Promise<LeadSummary>;
  listLoader: (filters?: LeadListFilters) => Promise<{
    items: LeadListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  metricsLoader?: (filters?: Pick<LeadListFilters, 'stage' | 'assignedTo'>) => Promise<LeadMetricsSummary>;
  assistLoader: (filters?: LeadListFilters) => Promise<{
    items: LeadAssistSummaryItem[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  fetchLead: (id: number) => Promise<LeadDetail>;
  fetchLeadAssist: (id: number) => Promise<LeadAssistResult>;
  createLead: (payload: LeadPayload) => Promise<LeadListItem>;
  updateLead: (id: number, payload: Partial<LeadPayload>) => Promise<LeadListItem>;
  updateStage: (id: number, payload: { stage: LeadStage; lostReason?: string }) => Promise<LeadListItem>;
  assignLead: (id: number, assignedToUserId: number | null) => Promise<LeadListItem>;
  snoozeLead: (id: number, days: 1 | 3 | 7) => Promise<LeadListItem>;
  convertLead?: (id: number, data: { 
    studentData: { 
      firstName: string; 
      lastName?: string; 
      contactEmail?: string; 
      contactPhone?: string; 
      age?: number; 
      parentName?: string; 
      parentContact?: string; 
    }; 
    enrollmentData: { 
      courseId: number; 
      startDate?: string; 
      endDate?: string; 
      currentModuleId?: number; 
      currentLevelId?: number; 
      teacherUserId?: number; 
    }; 
  }) => Promise<{ lead: LeadListItem; student: any; enrollment: any }>;
};

const LeadsPageBase: React.FC<LeadsPageBaseProps> = ({
  title,
  summaryLoader,
  listLoader,
  metricsLoader,
  assistLoader,
  fetchLead,
  fetchLeadAssist,
  createLead,
  updateLead,
  updateStage,
  assignLead,
  snoozeLead,
  convertLead,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [assistMap, setAssistMap] = useState<Record<number, LeadAssistSummaryItem>>({});
  const [assistLoading, setAssistLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get('stage') || '');
  const [followUpFilter, setFollowUpFilter] = useState<LeadFollowUpFilter | ''>('');
  const [search, setSearch] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'me' | 'unassigned'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<LeadMetricsSummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [selectedAssist, setSelectedAssist] = useState<LeadAssistResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<LeadPayload>({ firstName: '', stage: 'NEW', lostReason: '' });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [snoozingId, setSnoozingId] = useState<number | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [stageFilter, assignedFilter]);

  useEffect(() => {
    setPage(1);
  }, [stageFilter, followUpFilter, search, assignedFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadList();
  }, [page, stageFilter, search, assignedFilter, dateFrom, dateTo]);

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const summaryRes = await summaryLoader();
      setSummary(summaryRes);
    } catch (err) {
      console.error('Failed to load lead summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadMetrics = async () => {
    if (!metricsLoader) return;
    try {
      setLoadingMetrics(true);
      const metricsRes = await metricsLoader({
        stage: stageFilter ? (stageFilter as LeadStage) : undefined,
        assignedTo: assignedFilter === 'all' ? undefined : assignedFilter,
      });
      setMetrics(metricsRes);
    } catch (err) {
      console.error('Failed to load lead follow-up metrics', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadList = async () => {
    try {
      setLoading(true);
      setAssistLoading(true);
      const filters: LeadListFilters = {
        stage: stageFilter ? (stageFilter as LeadStage) : undefined,
        assignedTo: assignedFilter === 'all' ? undefined : assignedFilter,
        followUp: followUpFilter ? followUpFilter : undefined,
        q: search.trim() || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        pageSize,
      };
      const listRes = await listLoader(filters);
      setLeads(listRes.items);
      setTotal(listRes.total);
      try {
        const assistRes = await assistLoader(filters);
        const map: Record<number, LeadAssistSummaryItem> = {};
        assistRes.items.forEach((item) => {
          map[item.id] = item;
        });
        setAssistMap(map);
      } catch (assistErr) {
        console.error('Failed to load lead assist summary', assistErr);
        setAssistMap({});
      }
      setError(null);
    } catch (err: any) {
      console.error('Failed to load leads', err);
      setError(parseErrorMessage(err, 'Failed to load leads. Please try again.'));
    } finally {
      setLoading(false);
      setAssistLoading(false);
    }
  };

  const refreshSummary = async () => {
    await loadSummary();
  };

  const refreshMetrics = async () => {
    await loadMetrics();
  };

  const handleCreate = async () => {
    setCreating(true);
  };

  const openDrawer = async (lead: LeadListItem) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
    setSelectedAssist(null);
    try {
      const [detail, assist] = await Promise.all([fetchLead(lead.id), fetchLeadAssist(lead.id)]);
      setSelectedLead(detail);
      setSelectedAssist(assist);
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not load lead details');
    }
  };

  const handleSave = async (payload: Partial<LeadPayload>) => {
    if (!selectedLead) return;
    try {
      const updated = await updateLead(selectedLead.id, payload);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setSelectedLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      await refreshAssistForLead(updated.id);
      await refreshSummary();
      await refreshMetrics();
      showToast('Lead updated', 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update lead');
      throw err;
    }
  };

  const handleStageChange = async (stage: LeadStage, leadId?: number, lostReasonOverride?: string) => {
    const targetId = leadId ?? selectedLead?.id;
    if (!targetId) return;
    let lostReason: string | undefined;
    if (stage === 'LOST') {
      const reason = lostReasonOverride ?? window.prompt('Enter lost reason');
      if (!reason) {
        showToast('Lost reason is required', 'error');
        return;
      }
      lostReason = reason;
    }
    try {
      const updated = await updateStage(targetId, { stage, lostReason });
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setSelectedLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      await refreshAssistForLead(updated.id);
      await refreshSummary();
      await refreshMetrics();
      showToast(`Stage set to ${STAGE_LABELS[stage]}`, 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update lead stage');
      throw err;
    }
  };

  const handleAssignToMe = async (leadId: number) => {
    if (!user?.id) return;
    try {
      const updated = await assignLead(leadId, user.id);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setSelectedLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      await refreshAssistForLead(updated.id);
      await refreshMetrics();
      showToast('Lead assigned', 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not assign lead');
    }
  };

  const handleAssign = async (assignedToUserId: number | null) => {
    if (!selectedLead) return;
    try {
      const updated = await assignLead(selectedLead.id, assignedToUserId);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setSelectedLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      await refreshAssistForLead(updated.id);
      await refreshMetrics();
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update assignment');
    }
  };

  const handleSnooze = async (leadId: number, days: 1 | 3 | 7) => {
    setSnoozingId(leadId);
    try {
      const updated = await snoozeLead(leadId, days);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setSelectedLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      await refreshAssistForLead(updated.id);
      await refreshMetrics();
      showToast(`Snoozed ${days} day${days === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not snooze follow-up');
    } finally {
      setSnoozingId(null);
    }
  };

  const submitCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});
    if (!createForm.firstName.trim()) {
      setCreateErrors({ firstName: 'Name is required' });
      return;
    }
    if (createForm.stage === 'LOST' && !createForm.lostReason?.trim()) {
      setCreateErrors({ lostReason: 'Lost reason is required' });
      return;
    }
    try {
      const created = await createLead(createForm);
      setLeads((prev) => [created, ...prev]);
      await refreshSummary();
      await refreshMetrics();
      showToast('Lead created', 'success');
      setCreateForm({ firstName: '', lastName: '', contactEmail: '', contactPhone: '', stage: 'NEW', lostReason: '' });
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

  const formatAssignedLabel = (lead: LeadListItem) => {
    if (!lead.assignedToUserId) return 'Unassigned';
    if (lead.assignedToUserId === user?.id) return 'Me';
    return `User #${lead.assignedToUserId}`;
  };

  const refreshAssistForLead = async (leadId: number) => {
    try {
      const assist = await fetchLeadAssist(leadId);
      if (selectedLead?.id === leadId) {
        setSelectedAssist(assist);
      }
      setAssistMap((prev) => {
        const existing = prev[leadId];
        return {
          ...prev,
          [leadId]: {
            id: leadId,
            stage: existing?.stage,
            nextFollowUpAt: existing?.nextFollowUpAt,
            score: assist.score,
            tier: assist.tier,
            topReason: assist.reasons[0] ?? null,
            reasons: assist.reasons.slice(0, 2),
          },
        };
      });
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not refresh AI assist');
    }
  };

  const getAssistReasons = (item?: LeadAssistSummaryItem) => {
    if (!item) return [];
    const reasons = item.reasons && item.reasons.length ? item.reasons : item.topReason ? [item.topReason] : [];
    return reasons.slice(0, 2);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Add a function to handle lead conversion
  const handleConvertLead = async (id: number, data: { 
    studentData: { 
      firstName: string; 
      lastName?: string; 
      contactEmail?: string; 
      contactPhone?: string; 
      age?: number; 
      parentName?: string; 
      parentContact?: string; 
    }; 
    enrollmentData: { 
      courseId: number; 
      startDate?: string; 
      endDate?: string; 
      currentModuleId?: number; 
      currentLevelId?: number; 
      teacherUserId?: number; 
    }; 
  }): Promise<{ lead: LeadDetail; student: any; enrollment: any } | undefined> => {
    if (!convertLead) {
      showToast('Convert lead functionality not available', 'error');
      return undefined;
    }
    
    try {
      const result = await convertLead(id, data);
      setLeads((prev) => prev.map((l) => (l.id === result.lead.id ? { ...l, ...result.lead } : l)));
      setSelectedLead((prev) => (prev && prev.id === result.lead.id ? { ...prev, ...result.lead } : prev));
      await refreshAssistForLead(result.lead.id);
      await refreshSummary();
      await refreshMetrics();
      showToast('Lead converted successfully', 'success');
      return result;
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not convert lead');
      throw err;
    }
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
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value as 'all' | 'me' | 'unassigned')}
          >
            <option value="all">All assignments</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            className="form-control"
            value={stageFilter}
            onChange={(e) => setStageFromCard(e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value as LeadFollowUpFilter | '')}
          >
            <option value="">All follow-ups</option>
            <option value="overdue">Overdue</option>
            <option value="due_today">Due today</option>
            <option value="due_next_7_days">Due next 7 days</option>
            <option value="none">No follow-up</option>
          </select>
          <input
            className="form-control"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Updated from date"
          />
          <input
            className="form-control"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Updated to date"
          />
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
            <div className="text-sm text-gray-600">{STAGE_LABELS[s]}</div>
            <div className="text-xl font-semibold">
              {loadingSummary ? '...' : summary?.byStage?.[s] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {metricsLoader && (
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
          <div className="bg-gray-50 rounded px-3 py-2">
            Overdue: <span className="font-semibold">{loadingMetrics ? '...' : metrics?.overdueCount ?? 0}</span>
          </div>
          <div className="bg-gray-50 rounded px-3 py-2">
            Due today: <span className="font-semibold">{loadingMetrics ? '...' : metrics?.dueTodayCount ?? 0}</span>
          </div>
          <div className="bg-gray-50 rounded px-3 py-2">
            Due next 7 days:{' '}
            <span className="font-semibold">{loadingMetrics ? '...' : metrics?.dueNext7DaysCount ?? 0}</span>
          </div>
          <div className="bg-gray-50 rounded px-3 py-2">
            Unassigned overdue:{' '}
            <span className="font-semibold">{loadingMetrics ? '...' : metrics?.unassignedOverdueCount ?? 0}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100 text-left text-sm text-gray-600">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">AI</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Next Follow-up</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-sm text-gray-500" colSpan={8}>
                    No leads match your filters. Adjust filters or add a new lead.
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t text-sm">
                  <td className="px-3 py-2 font-medium">
                    {lead.firstName} {lead.lastName || ''}
                  </td>
                  <td className="px-3 py-2">
                    <div>{lead.contactPhone || '-'}</div>
                    <div className="text-xs text-gray-500">{lead.contactEmail || ''}</div>
                  </td>
                  <td className="px-3 py-2">{lead.stage ? STAGE_LABELS[lead.stage] : 'New'}</td>
                  <td className="px-3 py-2">
                    {assistLoading ? (
                      <span className="text-xs text-gray-400">Loading...</span>
                    ) : (
                      (() => {
                        const assist = assistMap[lead.id];
                        if (!assist) return <span className="text-xs text-gray-400">-</span>;
                        const reasons = getAssistReasons(assist);
                        return (
                          <div>
                            <div className={`text-xs font-semibold ${tierClasses[assist.tier]}`}>
                              {assist.tier} {assist.score}
                            </div>
                            {reasons.length > 0 && (
                              <div className="text-[11px] text-gray-500">{reasons.join(' / ')}</div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </td>
                  <td className="px-3 py-2">{formatAssignedLabel(lead)}</td>
                  <td className="px-3 py-2">
                    <div>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : '-'}</div>
                    {(() => {
                      const status = getFollowUpStatus(lead);
                      if (!status) return null;
                      return <div className={`text-xs ${status.className}`}>{status.label}</div>;
                    })()}
                  </td>
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
                        {getStageOptions((lead.stage as LeadStage) || 'NEW').map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      {lead.stage !== 'CONVERTED' && lead.stage !== 'LOST' && (
                        <select
                          className="form-control form-control-sm"
                          defaultValue=""
                          disabled={snoozingId === lead.id}
                          onChange={(e) => {
                            const value = Number(e.target.value) as 1 | 3 | 7;
                            if (value) {
                              void handleSnooze(lead.id, value);
                              e.currentTarget.value = '';
                            }
                          }}
                        >
                          <option value="" disabled>
                            Snooze
                          </option>
                          <option value="1">Snooze 1d</option>
                          <option value="3">Snooze 3d</option>
                          <option value="7">Snooze 7d</option>
                        </select>
                      )}
                      {user?.id && lead.assignedToUserId !== user.id && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleAssignToMe(lead.id)}>
                          Assign to me
                        </button>
                      )}
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
        {leads.length === 0 && (
          <div className="p-6 text-center text-gray-600">
            <p className="mb-2">No leads match your filters yet.</p>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              Create your first lead
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
          <div>
            Page {page} of {totalPages} - {total} leads
          </div>
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

      <LeadDetailDrawer
        lead={selectedLead}
        assist={selectedAssist}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onStageChange={(stage, lostReason) => handleStageChange(stage, undefined, lostReason)}
        onAssign={handleAssign}
        onSnooze={(days) => (selectedLead ? handleSnooze(selectedLead.id, days) : Promise.resolve())}
        onConvertLead={convertLead ? handleConvertLead : undefined}
      />

      {creating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Create Lead</h3>
              <button className="text-gray-500" onClick={() => setCreating(false)} aria-label="Close create lead form">
                x
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
                            {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {createForm.stage === 'LOST' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lost reason</label>
                  <input
                    className="form-control mt-1"
                    value={createForm.lostReason || ''}
                    onChange={(e) => setCreateForm({ ...createForm, lostReason: e.target.value })}
                  />
                  {createErrors.lostReason && <p className="text-sm text-red-600 mt-1">{createErrors.lostReason}</p>}
                </div>
              )}
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
