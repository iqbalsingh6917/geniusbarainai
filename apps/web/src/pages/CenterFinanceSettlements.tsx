import React from 'react';
import FinanceSettlements from './FinanceSettlements';
import { fetchScopedOrgUnits } from '../api/orgUnitsClient';
import { useAuth } from '../contexts/AuthContext';

const CenterFinanceSettlements: React.FC = () => {
  const { user } = useAuth();

  return (
    <FinanceSettlements
      basePath="/center/finance/settlements"
      orgUnitMode="locked"
      lockedOrgUnitId={user?.orgUnitId ?? null}
      orgUnitsLoader={fetchScopedOrgUnits}
    />
  );
};

export default CenterFinanceSettlements;
