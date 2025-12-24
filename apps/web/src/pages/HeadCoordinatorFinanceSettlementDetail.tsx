import React from 'react';
import FinanceSettlementDetail from './FinanceSettlementDetail';

const HeadCoordinatorFinanceSettlementDetail: React.FC = () => {
  return (
    <FinanceSettlementDetail basePath="/head-coordinator/finance/settlements" readOnly />
  );
};

export default HeadCoordinatorFinanceSettlementDetail;
