import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

const CoordinatorLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const permissions =
    user
      ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] ||
        FRONTEND_PERMISSIONS.COORDINATOR
      : FRONTEND_PERMISSIONS.COORDINATOR;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Beats LMS - Coordinator</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span>Welcome, {user?.username}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-64 pr-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Navigation</h2>
              <ul className="space-y-2">
                <li>
                  <Link to="/coordinator/workflows" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Workflows
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/dashboard" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Dashboard
                  </Link>
                </li>
                {/* Removed leads link - coordinators should not access sales leads */}
                <li>
                  <Link to="/coordinator/leads" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Leads
                  </Link>
                </li>
                {permissions.showAbacusEnrollmentsPage && (
                  <li>
                    <Link to="/coordinator/enrollments" className="block py-2 px-4 rounded hover:bg-gray-100">
                      Enrollments
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/coordinator/attendance" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Attendance
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/attendance-summary" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Attendance Summary
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/progress-summary" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Progress Summary
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/centers" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Centers
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/teachers" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Teachers
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/students" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Students
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/teacher-assignments" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Teacher Assignments
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/flag-attendance-issue" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Flag Attendance Issue
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/flag-progress-issue" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Flag Progress Issue
                  </Link>
                </li>
                <li>
                  <Link to="/coordinator/reports" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Reports
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow p-6">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorLayout;
