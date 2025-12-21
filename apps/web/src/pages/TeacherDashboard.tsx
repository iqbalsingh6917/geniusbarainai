import React from 'react';

const TeacherDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">My Students & Enrollments</h2>
        <p>Welcome, Teacher! This is your dashboard where you can:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>View your assigned students</li>
          <li>View student enrollments</li>
          <li>Update student progress</li>
          <li>Add assessments</li>
          <li>View curriculum and worksheets</li>
        </ul>
        <p className="mt-4 text-gray-600">Note: This is a placeholder page. Full functionality will be implemented in later phases.</p>
      </div>
    </div>
  );
};

export default TeacherDashboard;