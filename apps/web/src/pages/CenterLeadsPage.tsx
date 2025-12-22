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

const CenterLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Center)"
      summaryLoader={() => fetchLeadSummary('center')}
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

export default CenterLeadsPage;
