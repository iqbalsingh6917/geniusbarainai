import React from 'react';
import LeadsPageBase from '../components/leads/LeadsPageBase';
import {
  createLead,
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
      createLead={createLead}
      updateLead={updateLead}
      updateStage={(id, stage) => updateLeadStage(id, { stage })}
    />
  );
};

export default CenterLeadsPage;
