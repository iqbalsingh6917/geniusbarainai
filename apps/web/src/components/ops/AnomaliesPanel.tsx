import React from 'react';
import Skeleton from '../ui/Skeleton';
import { OpsAnomalySummary, OpsAnomalySeverity } from '../../api/opsAnomaliesClient';

type AnomaliesPanelProps = {
  title?: string;
  summary: OpsAnomalySummary | null;
  loading: boolean;
  error: string | null;
  maxItems?: number;
};

const severityClass = (severity: OpsAnomalySeverity) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';
    case 'WARN':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const AnomaliesPanel: React.FC<AnomaliesPanelProps> = ({
  title = 'Anomalies',
  summary,
  loading,
  error,
  maxItems = 5,
}) => {
  const items = summary?.anomalies ?? [];
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {summary ? <span className="text-xs text-gray-500">Last {summary.windowDays} days</span> : null}
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
        <div className="text-sm text-gray-500">No anomalies detected.</div>
      )}

      {!loading && !error && displayItems.length > 0 && (
        <div className="space-y-3">
          {displayItems.map((item, idx) => (
            <div key={`${item.code}-${idx}`} className="border border-gray-100 rounded p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${severityClass(item.severity)}`}>
                  {item.severity}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-2">{item.suggestedAction}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnomaliesPanel;
