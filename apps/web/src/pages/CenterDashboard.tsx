import React from 'react';

const CenterDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Center Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Students & Enrollments</h2>
        <p>Welcome, Center Manager! This is your dashboard where you can:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Create and manage students</li>
          <li>Create and manage enrollments</li>
          <li>View curriculum</li>
          <li>Update student progress</li>
        </ul>
        <p className="mt-4 text-gray-600">Note: This is a placeholder page. Full functionality will be implemented in later phases.</p>
      </div>
    </div>
  );
};

export default CenterDashboard;