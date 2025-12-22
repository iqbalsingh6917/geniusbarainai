import React from 'react';
import Skeleton from '../ui/Skeleton';
import { RetentionSignal, RetentionSeverity } from '../../api/retentionAssistClient';

type RetentionSignalsPanelProps = {
  title: string;
  signals: RetentionSignal[];
  loading: boolean;
  error: string | null;
  maxItems?: number;
  showDetails?: boolean;
  showDrafts?: boolean;
};

const severityClass = (severity: RetentionSeverity) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';
    case 'WARN':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const RetentionSignalsPanel: React.FC<RetentionSignalsPanelProps> = ({
  title,
  signals,
  loading,
  error,
  maxItems = 5,
  showDetails = false,
  showDrafts = false,
}) => {
  const displayItems = signals.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: Math.min(maxItems, 3) }).map((_, idx) => (
            <Skeleton key={idx} className="h-6" />
          ))}
        </div>
      )}

      {!loading && error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && displayItems.length === 0 && (
        <div className="text-sm text-gray-500">No signals detected.</div>
      )}

      {!loading && !error && displayItems.length > 0 && (
        <div className="space-y-3">
          {displayItems.map((item, idx) => (
            <div key={`${item.code}-${item.studentId ?? 'scope'}-${idx}`} className="border border-gray-100 rounded p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {item.title}
                    {item.studentName ? <span className="text-xs text-gray-500"> • {item.studentName}</span> : null}
                  </div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${severityClass(item.severity)}`}>
                  {item.severity}
                </span>
              </div>
              {showDetails && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {item.reasons?.length ? (
                    <ul className="list-disc pl-5">
                      {item.reasons.map((reason, reasonIdx) => (
                        <li key={`${item.code}-reason-${reasonIdx}`}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="text-xs text-gray-500">
                    {Object.entries(item.evidence || {}).map(([key, value]) => (
                      <span key={`${item.code}-${key}`} className="inline-block mr-3">
                        {key}: {value ?? '-'}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-700">{item.suggestedAction}</div>
                </div>
              )}
              {showDrafts && (item.draftMessageTeacherToParent || item.draftMessageTeacherToStudent) && (
                <div className="mt-3 space-y-2">
                  {item.draftMessageTeacherToParent && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Draft to parent</div>
                      <textarea
                        className="w-full text-xs border rounded p-2"
                        rows={3}
                        defaultValue={item.draftMessageTeacherToParent}
                      />
                    </div>
                  )}
                  {item.draftMessageTeacherToStudent && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Draft to student</div>
                      <textarea
                        className="w-full text-xs border rounded p-2"
                        rows={3}
                        defaultValue={item.draftMessageTeacherToStudent}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RetentionSignalsPanel;
