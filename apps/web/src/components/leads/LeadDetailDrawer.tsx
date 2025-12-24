import React, { useEffect, useState } from 'react';
import { LeadAssistResult, LeadDetail, LeadPayload, LeadStage, LeadSource } from '../../api/salesLeadsClient';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { handleErrorToast } from '../../utils/errorHandling';

type LeadDetailDrawerProps = {
  lead?: LeadDetail | null;
  assist?: LeadAssistResult | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<LeadPayload>) => Promise<void>;
  onStageChange: (stage: LeadStage, lostReason?: string) => Promise<void>;
  onAssign: (assignedToUserId: number | null) => Promise<void>;
  onSnooze: (days: 1 | 3 | 7) => Promise<void>;
  onConvertLead?: (id: number, data: { 
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
  }) => Promise<{ lead: LeadDetail; student: any; enrollment: any } | undefined>;
};

const SOURCES: LeadSource[] = ['CAMPAIGN', 'REFERRAL', 'WALK_IN', 'WHATSAPP', 'OTHER', 'ONLINE', 'SCHOOL'];
const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  TRIAL_BOOKED: 'Demo scheduled',
  TRIAL_DONE: 'Demo done',
  CONVERTED: 'Enrolled',
  LOST: 'Lost',
};
const STAGE_FLOW: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_DONE', 'CONVERTED'];
const tierClasses: Record<'HOT' | 'WARM' | 'COLD', string> = {
  HOT: 'text-red-600',
  WARM: 'text-yellow-600',
  COLD: 'text-gray-500',
};

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

const getStageActionOptions = (current: LeadStage) => {
  const options: LeadStage[] = [];
  const next = getNextStage(current);
  if (next) options.push(next);
  if (current !== 'LOST') options.push('LOST');
  return options;
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  assist,
  open,
  onClose,
  onSave,
  onStageChange,
  onAssign,
  onSnooze,
  onConvertLead,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<Partial<LeadPayload>>({});
  const [saving, setSaving] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [assistMessage, setAssistMessage] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [studentData, setStudentData] = useState({
    firstName: '',
    lastName: '',
    contactEmail: '',
    contactPhone: '',
    age: undefined as number | undefined,
    parentName: '',
    parentContact: '',
  });
  const [enrollmentData, setEnrollmentData] = useState({
    courseId: 0,
    startDate: '',
    endDate: '',
    currentModuleId: undefined as number | undefined,
    currentLevelId: undefined as number | undefined,
    teacherUserId: undefined as number | undefined,
  });

  useEffect(() => {
    if (lead) {
      setForm({
        firstName: lead.firstName,
        lastName: lead.lastName || '',
        contactEmail: lead.contactEmail || '',
        contactPhone: lead.contactPhone || '',
        city: lead.city || '',
        source: (lead.source as LeadSource) || 'OTHER',
        stage: (lead.stage as LeadStage) || 'NEW',
        nextFollowUpAt: toDateTimeLocal(lead.nextFollowUpAt),
        lostReason: lead.lostReason || '',
        notes: lead.notes || '',
      });
      
      // Pre-populate student data from lead
      setStudentData({
        firstName: lead.firstName,
        lastName: lead.lastName || '',
        contactEmail: lead.contactEmail || '',
        contactPhone: lead.contactPhone || '',
        age: undefined,
        parentName: '',
        parentContact: '',
      });
    }
  }, [lead]);

  useEffect(() => {
    setAssistMessage(assist?.suggestedMessage || '');
  }, [assist]);

  // Function to handle lead conversion
  const handleConvertLead = async () => {
    if (!lead || !onConvertLead) return;
    
    try {
      // Call the API to convert the lead
      await onConvertLead(lead.id, { studentData, enrollmentData });
      showToast('Lead converted successfully', 'success');
      onClose();
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not convert lead');
    }
  };

  if (!open) return null;

  const assignedLabel = lead?.assignedToUserId
    ? lead.assignedToUserId === user?.id
      ? 'Me'
      : `User #${lead.assignedToUserId}`
    : 'Unassigned';
  const currentStage = (form.stage as LeadStage) ?? (lead?.stage as LeadStage) ?? 'NEW';
  const stageOptions = getStageOptions(currentStage);
  const stageActionOptions = getStageActionOptions(currentStage);

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
      const lostReason = stage === 'LOST' ? (form.lostReason as string | undefined) : undefined;
      await onStageChange(stage, lostReason);
    } finally {
      setStageUpdating(false);
    }
  };

  const handleAssign = async (assignedToUserId: number | null) => {
    setAssigning(true);
    try {
      await onAssign(assignedToUserId);
      showToast(assignedToUserId ? 'Lead assigned' : 'Lead unassigned', 'success');
    } catch (err) {
      handleErrorToast(err, showToast, 'Could not update assignment');
    } finally {
      setAssigning(false);
    }
  };

  const handleSnooze = async (days: 1 | 3 | 7) => {
    setSnoozing(true);
    try {
      await onSnooze(days);
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="w-full max-w-md bg-white shadow-xl p-5 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Lead Details</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded p-3 mb-3">
            <div>
              <div className="text-xs text-gray-500">Assigned</div>
              <div className="text-sm font-medium">{assignedLabel}</div>
            </div>
            <div className="flex gap-2">
              {user?.id && lead?.assignedToUserId !== user.id && (
                <button className="btn btn-outline btn-xs" onClick={() => handleAssign(user.id)} disabled={assigning}>
                  Assign to me
                </button>
              )}
              {lead?.assignedToUserId && lead.assignedToUserId === user?.id && (
                <button className="btn btn-outline btn-xs" onClick={() => handleAssign(null)} disabled={assigning}>
                  Unassign
                </button>
              )}
            </div>
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
              <label className="text-sm text-gray-600">City</label>
              <input
                className="form-control"
                value={form.city ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
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
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2 flex-wrap">
                {stageActionOptions.map((s) => (
                  <button
                    key={s}
                    className="btn btn-outline btn-xs"
                    onClick={() => handleStageChange(s)}
                    disabled={stageUpdating}
                  >
                    {STAGE_LABELS[s]}
                  </button>
                ))}
                {stageActionOptions.length === 0 && (
                  <span className="text-xs text-gray-500">No further stage actions.</span>
                )}
                
                {/* Convert button for leads that are not yet converted or lost */}
                {currentStage !== 'CONVERTED' && currentStage !== 'LOST' && (
                  <button
                    className="btn btn-success btn-xs"
                    onClick={() => setShowConvertModal(true)}
                    disabled={stageUpdating}
                  >
                    Convert to Student
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Next follow-up</label>
              <input
                className="form-control"
                type="datetime-local"
                value={form.nextFollowUpAt ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
              />
              {currentStage !== 'CONVERTED' && currentStage !== 'LOST' && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button className="btn btn-outline btn-xs" onClick={() => handleSnooze(1)} disabled={snoozing}>
                    Snooze 1d
                  </button>
                  <button className="btn btn-outline btn-xs" onClick={() => handleSnooze(3)} disabled={snoozing}>
                    Snooze 3d
                  </button>
                  <button className="btn btn-outline btn-xs" onClick={() => handleSnooze(7)} disabled={snoozing}>
                    Snooze 7d
                  </button>
                </div>
              )}
            </div>
            {(form.stage === 'LOST' || form.lostReason) && (
              <div>
                <label className="text-sm text-gray-600">Lost reason</label>
                <input
                  className="form-control"
                  value={form.lostReason ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, lostReason: e.target.value }))}
                />
              </div>
            )}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Assist</h3>
              {assist ? (
                <div className="space-y-2 text-sm text-gray-600">
                  <div>
                    <span className={`font-semibold ${tierClasses[assist.tier]}`}>
                      {assist.tier} {assist.score}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Reasons</div>
                    <ul className="list-disc list-inside">
                      {assist.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Suggested next action</div>
                    <div className="font-medium">{assist.nextAction}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Suggested message</div>
                    <textarea
                      className="form-control mt-1"
                      rows={3}
                      value={assistMessage}
                      onChange={(e) => setAssistMessage(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">AI assist not available.</p>
              )}
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
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent activity</h3>
              {lead?.activities && lead.activities.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-600">
                  {lead.activities.map((activity) => (
                    <li key={activity.id} className="flex justify-between gap-2">
                      <span>
                        {activity.fromStage ? STAGE_LABELS[activity.fromStage] : 'Created'}{' '}
                        {activity.toStage ? `-> ${STAGE_LABELS[activity.toStage]}` : ''}
                        {activity.note ? ` - ${activity.note}` : ''}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Convert Lead Modal */}
      {showConvertModal && lead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConvertModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Convert Lead to Student</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConvertModal(false)}>
                Close
              </button>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Student Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">First Name *</label>
                  <input
                    className="form-control"
                    value={studentData.firstName}
                    onChange={(e) => setStudentData({...studentData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Last Name</label>
                  <input
                    className="form-control"
                    value={studentData.lastName}
                    onChange={(e) => setStudentData({...studentData, lastName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    value={studentData.contactEmail}
                    onChange={(e) => setStudentData({...studentData, contactEmail: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <input
                    className="form-control"
                    value={studentData.contactPhone}
                    onChange={(e) => setStudentData({...studentData, contactPhone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Age</label>
                  <input
                    className="form-control"
                    type="number"
                    value={studentData.age || ''}
                    onChange={(e) => setStudentData({...studentData, age: e.target.value ? parseInt(e.target.value) : undefined})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Parent Name</label>
                  <input
                    className="form-control"
                    value={studentData.parentName}
                    onChange={(e) => setStudentData({...studentData, parentName: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-600">Parent Contact</label>
                  <input
                    className="form-control"
                    value={studentData.parentContact}
                    onChange={(e) => setStudentData({...studentData, parentContact: e.target.value})}
                  />
                </div>
              </div>
              
              <h4 className="font-medium mt-4">Enrollment Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Course ID *</label>
                  <input
                    className="form-control"
                    type="number"
                    value={enrollmentData.courseId || ''}
                    onChange={(e) => setEnrollmentData({...enrollmentData, courseId: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Start Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={enrollmentData.startDate}
                    onChange={(e) => setEnrollmentData({...enrollmentData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">End Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={enrollmentData.endDate}
                    onChange={(e) => setEnrollmentData({...enrollmentData, endDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Current Module ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={enrollmentData.currentModuleId || ''}
                    onChange={(e) => setEnrollmentData({...enrollmentData, currentModuleId: e.target.value ? parseInt(e.target.value) : undefined})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Current Level ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={enrollmentData.currentLevelId || ''}
                    onChange={(e) => setEnrollmentData({...enrollmentData, currentLevelId: e.target.value ? parseInt(e.target.value) : undefined})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Teacher User ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={enrollmentData.teacherUserId || ''}
                    onChange={(e) => setEnrollmentData({...enrollmentData, teacherUserId: e.target.value ? parseInt(e.target.value) : undefined})}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setShowConvertModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={handleConvertLead}
                >
                  Convert Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadDetailDrawer;
