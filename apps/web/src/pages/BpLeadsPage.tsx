import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  assignLead,
  createLead,
  fetchLead,
  fetchLeadAssist,
  fetchLeadSummary,
  listLeadAssistSummary,
  listLeads,
  updateLead,
  updateLeadStage,
} from '../api/salesLeadsClient';

const BpLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Business Partner)"
      summaryLoader={() => fetchLeadSummary('bp')}
      listLoader={listLeads}
      assistLoader={listLeadAssistSummary}
      fetchLead={fetchLead}
      fetchLeadAssist={fetchLeadAssist}
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, payload) => updateLeadStage(id, payload)}
      assignLead={assignLead}
    />
  );
};

export default BpLeadsPage;
