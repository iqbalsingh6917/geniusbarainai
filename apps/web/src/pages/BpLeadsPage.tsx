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

const BpLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Business Partner)"
      summaryLoader={() => fetchLeadSummary('bp')}
      listLoader={listLeads}
      fetchLead={fetchLead}
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, payload) => updateLeadStage(id, payload)}
      assignLead={assignLead}
    />
  );
};

export default BpLeadsPage;
