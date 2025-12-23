import React from 'react';
import FinanceSettlements from './FinanceSettlements';
import { fetchScopedOrgUnits } from '../api/orgUnitsClient';

const BpFinanceSettlements: React.FC = () => {
  return (
    <FinanceSettlements
      basePath="/business-partner/finance/settlements"
      orgUnitMode="select"
      orgUnitsLoader={fetchScopedOrgUnits}
    />
  );
};

export default BpFinanceSettlements;
