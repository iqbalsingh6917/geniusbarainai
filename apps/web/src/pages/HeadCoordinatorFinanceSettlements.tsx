import React from 'react';
import FinanceSettlements from './FinanceSettlements';
import { fetchScopedOrgUnits } from '../api/orgUnitsClient';

const HeadCoordinatorFinanceSettlements: React.FC = () => {
  return (
    <FinanceSettlements
      basePath="/head-coordinator/finance/settlements"
      orgUnitMode="select"
      orgUnitsLoader={fetchScopedOrgUnits}
      readOnly
    />
  );
};

export default HeadCoordinatorFinanceSettlements;
