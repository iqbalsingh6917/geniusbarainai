import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  assignLead,
  createLead,
  fetchLead,
  fetchLeadAssist,
  fetchLeadMetricsSummary,
  fetchLeadSummary,
  listLeadAssistSummary,
  listLeads,
  snoozeLead,
  updateLead,
  updateLeadStage,
} from '../api/salesLeadsClient';

const CenterLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Center)"
      summaryLoader={() => fetchLeadSummary('center')}
      listLoader={listLeads}
      metricsLoader={fetchLeadMetricsSummary}
      assistLoader={listLeadAssistSummary}
      fetchLead={fetchLead}
      fetchLeadAssist={fetchLeadAssist}
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, payload) => updateLeadStage(id, payload)}
      assignLead={assignLead}
      snoozeLead={snoozeLead}
    />
  );
};

export default CenterLeadsPage;
