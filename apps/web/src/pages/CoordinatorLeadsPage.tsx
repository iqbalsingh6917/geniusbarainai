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
  convertLead,
} from '../api/salesLeadsClient';

const CoordinatorLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Coordinator)"
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
      convertLead={convertLead}
    />
  );
};

export default CoordinatorLeadsPage;