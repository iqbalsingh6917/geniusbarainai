import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';
import { isCenterManager, isAdmissions } from '../lib/roles';

const CenterLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.CENTER_MANAGER : FRONTEND_PERMISSIONS.CENTER_MANAGER;

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
              <h1 className="text-xl font-bold">Beats LMS - Center</h1>
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
                  <Link to="/center/dashboard" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Dashboard
                  </Link>
                </li>
                {permissions.showAbacusStudentsPage && (
                  <li>
                    <Link to="/center/students" className="block py-2 px-4 rounded hover:bg-gray-100">
                      Students
                    </Link>
                  </li>
                )}
                {permissions.showAbacusEnrollmentsPage && (
                  <li>
                    <Link to="/center/enrollments" className="block py-2 px-4 rounded hover:bg-gray-100">
                      Enrollments
                    </Link>
                  </li>
                )}
                {(isCenterManager(user) || isAdmissions(user)) && (
                  <li>
                    <Link to="/center/teacher-assignments" className="block py-2 px-4 rounded hover:bg-gray-100">
                      Teacher Assignments
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/center/schedule" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Schedule
                  </Link>
                </li>
                <li>
                  <Link to="/center/attendance" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Attendance
                  </Link>
                </li>
                <li>
                  <Link to="/center/finance" className="block py-2 px-4 rounded hover:bg-gray-100">
                    Finance
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

export default CenterLayout;