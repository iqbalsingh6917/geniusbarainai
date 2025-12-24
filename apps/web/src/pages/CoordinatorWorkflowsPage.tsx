import React from 'react';
import { Link } from 'react-router-dom';

const CoordinatorWorkflowsPage: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Coordinator Workflows</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Centers Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Centers</h2>
          <p className="text-gray-600 mb-4">View assigned centers under your organization unit</p>
          <Link 
            to="/coordinator/centers" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Centers
          </Link>
        </div>

        {/* Teachers Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Teachers</h2>
          <p className="text-gray-600 mb-4">View teachers under assigned centers</p>
          <Link 
            to="/coordinator/teachers" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Teachers
          </Link>
        </div>

        {/* Students Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Students</h2>
          <p className="text-gray-600 mb-4">View students under assigned teachers</p>
          <Link 
            to="/coordinator/students" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Students
          </Link>
        </div>

        {/* Attendance Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Attendance Summary</h2>
          <p className="text-gray-600 mb-4">View attendance summaries for assigned students</p>
          <Link 
            to="/coordinator/attendance-summary" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Summary
          </Link>
        </div>

        {/* Progress Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Progress Summary</h2>
          <p className="text-gray-600 mb-4">View student progress summaries</p>
          <Link 
            to="/coordinator/progress-summary" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Summary
          </Link>
        </div>

        {/* Teacher Assignments Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Teacher Assignments</h2>
          <p className="text-gray-600 mb-4">Assign teachers to students/classes</p>
          <Link 
            to="/coordinator/teacher-assignments" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Manage Assignments
          </Link>
        </div>

        {/* Flag Attendance Issue Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Flag Attendance Issue</h2>
          <p className="text-gray-600 mb-4">Flag attendance-related issues for students</p>
          <Link 
            to="/coordinator/flag-attendance-issue" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Flag Issue
          </Link>
        </div>

        {/* Flag Progress Issue Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Flag Progress Issue</h2>
          <p className="text-gray-600 mb-4">Flag progress-related issues for students</p>
          <Link 
            to="/coordinator/flag-progress-issue" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Flag Issue
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorWorkflowsPage;