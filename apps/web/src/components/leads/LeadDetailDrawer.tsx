import React, { useEffect, useState } from 'react';
import { LeadListItem, LeadPayload, LeadStage, LeadSource } from '../../api/salesLeadsClient';

type LeadDetailDrawerProps = {
  lead?: LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<LeadPayload>) => Promise<void>;
  onStageChange: (stage: LeadStage) => Promise<void>;
};

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED', 'LOST'];
const SOURCES: LeadSource[] = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER'];

const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ lead, open, onClose, onSave, onStageChange }) => {
  const [form, setForm] = useState<Partial<LeadPayload>>({});
  const [saving, setSaving] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({
        firstName: lead.firstName,
        lastName: lead.lastName || '',
        contactEmail: lead.contactEmail || '',
        contactPhone: lead.contactPhone || '',
        source: (lead.source as LeadSource) || 'OTHER',
        stage: (lead.stage as LeadStage) || 'NEW',
        notes: lead.notes || '',
      });
    }
  }, [lead]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (stage: LeadStage) => {
    setStageUpdating(true);
    try {
      await onStageChange(stage);
    } finally {
      setStageUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl p-5 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Lead Details</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">First name</label>
            <input
              className="form-control"
              value={form.firstName ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Last name</label>
            <input
              className="form-control"
              value={form.lastName ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Phone</label>
            <input
              className="form-control"
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              className="form-control"
              type="email"
              value={form.contactEmail ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Source</label>
            <select
              className="form-control"
              value={form.source ?? 'OTHER'}
              onChange={(e) => setForm((p) => ({ ...p, source: e.target.value as LeadSource }))}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Stage</label>
            <select
              className="form-control"
              value={form.stage ?? 'NEW'}
              onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as LeadStage }))}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2 flex-wrap">
              {STAGES.map((s) => (
                <button
                  key={s}
                  className="btn btn-outline btn-xs"
                  onClick={() => handleStageChange(s)}
                  disabled={stageUpdating}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600">Notes</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailDrawer;
