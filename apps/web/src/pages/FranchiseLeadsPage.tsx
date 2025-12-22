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

const FranchiseLeadsPage: React.FC = () => {
  return (
    <LeadsPageBase
      title="Leads (Franchise)"
      summaryLoader={() => fetchLeadSummary('franchise')}
      listLoader={listLeads}
      fetchLead={fetchLead}
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, payload) => updateLeadStage(id, payload)}
      assignLead={assignLead}
    />
  );
};

export default FranchiseLeadsPage;
