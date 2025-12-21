import React from 'react';

const SuperadminDashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <h1>Welcome, Superadmin</h1>
      
      <div className="dashboard-cards">
        <div className="card">
          <h2>Abacus Courses</h2>
          <p>Total: 1</p>
        </div>
        
        <div className="card">
          <h2>Abacus Levels</h2>
          <p>Total: 3</p>
        </div>
      </div>
      
      <div className="welcome-message">
        <p>This is the Beats LMS v2 Superadmin Dashboard.</p>
        <p>Use the navigation menu to access the Abacus Course Studio and Curriculum Builder.</p>
      </div>
    </div>
  );
};

export default SuperadminDashboard;