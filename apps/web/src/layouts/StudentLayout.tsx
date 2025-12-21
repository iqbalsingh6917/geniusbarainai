import React, { useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'STUDENT') {
      // Redirect other roles to their dashboards
      switch (user.role) {
        case 'SUPERADMIN':
          navigate('/superadmin/dashboard');
          break;
        case 'BUSINESS_PARTNER':
          navigate('/business-partner/dashboard');
          break;
        case 'FRANCHISE':
          navigate('/franchise/dashboard');
          break;
        case 'CENTER_MANAGER':
        case 'ADMISSIONS':
          navigate('/center/dashboard');
          break;
        case 'TEACHER':
          navigate('/teacher/dashboard');
          break;
        default:
          navigate('/login');
      }
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = (path: string) =>
    `app-nav-link ${location.pathname.startsWith(path) ? 'badge-neutral' : ''}`;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <span className="app-brand">Beats LMS</span>
          <span className="app-chip">Student</span>
        </div>
        <div className="topbar-right">
          <span className="app-muted">Welcome, {user?.username}</span>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <nav>
            <Link to="/student/dashboard" className={navLinkClass('/student/dashboard')}>
              Dashboard
            </Link>
          <Link to="/student/courses" className={navLinkClass('/student/courses')}>
            My courses
          </Link>
          <Link to="/student/worksheets" className={navLinkClass('/student/worksheets')}>
            My worksheets
          </Link>
          <Link to="/student/attempts" className={navLinkClass('/student/attempts')}>
            My attempts
          </Link>
        </nav>
      </aside>
        <main className="app-main">
          <div className="card">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentLayout;
