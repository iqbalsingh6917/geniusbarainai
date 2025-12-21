import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  createLead,
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
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, stage) => updateLeadStage(id, { stage })}
    />
  );
};

export default BpLeadsPage;
