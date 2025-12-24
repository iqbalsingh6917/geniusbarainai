import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

const TeacherLayout: React.FC = () => {
  const { user } = useAuth();
  
  // Helper function to check if user has a specific permission
  const hasPermission = (permission: string) => {
    if (!user) return false;
    const userRole = user.role as keyof typeof FRONTEND_PERMISSIONS;
    const permissions = FRONTEND_PERMISSIONS[userRole] || FRONTEND_PERMISSIONS.TEACHER;
    // Check if permissions is an array and includes the permission
    if (Array.isArray(permissions)) {
      return permissions.includes(permission);
    }
    // If it's an object with boolean flags, return the value of the permission key
    return Boolean((permissions as any)[permission]);
  };

  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-white shadow-md">
        <div className="p-4">
          <h1 className="text-xl font-bold">Teacher Portal</h1>
        </div>
        <ul className="mt-6">
          {hasPermission('VIEW_DASHBOARD') && (
            <li>
              <Link to="/teacher/dashboard" className="block py-2 px-4 rounded hover:bg-gray-100">
                Dashboard
              </Link>
            </li>
          )}
          {hasPermission('VIEW_STUDENTS') && (
            <li>
              <Link to="/teacher/my-students" className="block py-2 px-4 rounded hover:bg-gray-100">
                My Students
              </Link>
            </li>
          )}
          {hasPermission('VIEW_WORKSHEETS') && (
            <li>
              <Link to="/teacher/worksheets" className="block py-2 px-4 rounded hover:bg-gray-100">
                Worksheets
              </Link>
            </li>
          )}
          {hasPermission('VIEW_EXAMS') && (
            <li>
              <Link to="/teacher/exams" className="block py-2 px-4 rounded hover:bg-gray-100">
                Exams
              </Link>
            </li>
          )}
          {hasPermission('VIEW_SUBMISSIONS') && (
            <li>
              <Link to="/teacher/submissions" className="block py-2 px-4 rounded hover:bg-gray-100">
                Submissions
              </Link>
            </li>
          )}
          {hasPermission('REVIEW_ATTEMPTS') && (
            <li>
              <Link to="/teacher/worksheet-attempts" className="block py-2 px-4 rounded hover:bg-gray-100">
                Review Attempts
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
};

export default TeacherLayout;