import React from 'react';

const BusinessPartnerDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Business Partner Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Franchises & Centers</h2>
        <p>Welcome, Business Partner! This is your dashboard where you can:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>View your franchises</li>
          <li>View centers under your franchises</li>
          <li>Monitor key metrics</li>
        </ul>
        <p className="mt-4 text-gray-600">Note: This is a placeholder page. Full functionality will be implemented in later phases.</p>
      </div>
    </div>
  );
};

export default BusinessPartnerDashboard;