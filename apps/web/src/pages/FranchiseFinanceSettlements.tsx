import React from 'react';
import FinanceSettlements from './FinanceSettlements';
import { fetchScopedOrgUnits } from '../api/orgUnitsClient';

const FranchiseFinanceSettlements: React.FC = () => {
  return (
    <FinanceSettlements
      basePath="/franchise/finance/settlements"
      orgUnitMode="select"
      orgUnitsLoader={fetchScopedOrgUnits}
    />
  );
};

export default FranchiseFinanceSettlements;
