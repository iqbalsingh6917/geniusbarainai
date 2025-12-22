import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  assignLead,
  createLead,
  fetchLead,
  fetchLeadSummary,
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
      fetchLead={fetchLead}
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, payload) => updateLeadStage(id, payload)}
      assignLead={assignLead}
    />
  );
};

export default CenterLeadsPage;
