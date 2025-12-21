import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  createLead,
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
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, stage) => updateLeadStage(id, { stage })}
    />
  );
};

export default FranchiseLeadsPage;
