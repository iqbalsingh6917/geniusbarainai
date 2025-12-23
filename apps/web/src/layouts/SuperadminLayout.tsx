import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FRONTEND_PERMISSIONS } from '../lib/roles';

const SuperadminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('saSidebarCollapsed');
    return stored ? stored === 'true' : false;
  });
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('saCompactMode');
    return stored ? stored === 'true' : false;
  });
  
  // Check if user is authenticated and has SUPERADMIN role
  useEffect(() => {
    if (!user || user.role !== 'SUPERADMIN') {
      navigate('/login');
    }
  }, [user, navigate]);
  
  const permissions = user ? FRONTEND_PERMISSIONS[user.role as keyof typeof FRONTEND_PERMISSIONS] || FRONTEND_PERMISSIONS.SUPERADMIN : FRONTEND_PERMISSIONS.SUPERADMIN;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = (path: string) => {
    const active = location.pathname.startsWith(path);
    return `app-nav-link ${active ? 'badge-neutral' : ''}`;
  };

  const navStyle = (path: string) => {
    const active = location.pathname.startsWith(path);
    return active
      ? {
          borderLeft: '3px solid var(--color-primary, #4f46e5)',
          background: 'var(--color-bg-soft, #f4f4f5)',
        }
      : {};
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('saSidebarCollapsed', String(next));
      return next;
    });
  };

  const toggleCompactMode = () => {
    setCompactMode((prev) => {
      const next = !prev;
      localStorage.setItem('saCompactMode', String(next));
      return next;
    });
  };

  const icon = (label: string) => (
    <span style={{ marginRight: sidebarCollapsed ? 0 : 8, fontSize: '0.95rem' }}>
      {label}
    </span>
  );

  const navItem = (to: string, label: string, symbol: string) => (
    <Link
      to={to}
      className={navClass(to)}
      style={{
        ...navStyle(to),
        display: 'flex',
        alignItems: 'center',
        gap: sidebarCollapsed ? 0 : 8,
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
      }}
      title={label}
    >
      {icon(symbol)}
      {!sidebarCollapsed && <span>{label}</span>}
    </Link>
  );

  const pageMeta = useMemo(() => {
    const map: Record<string, { title: string; crumbs: string[]; action?: string }> = {
      '/superadmin/dashboard': { title: 'Dashboard', crumbs: ['Home', 'Dashboard'], action: 'Refresh' },
      '/superadmin/activity': { title: 'Activity', crumbs: ['Home', 'Activity'], action: 'Refresh' },
      '/superadmin/abacus-course-studio': { title: 'Abacus Course Studio', crumbs: ['Curriculum', 'Course Studio'] },
      '/superadmin/abacus-builder': { title: 'Abacus Curriculum Builder', crumbs: ['Curriculum', 'Builder'] },
      '/superadmin/abacus-students': { title: 'Abacus Students', crumbs: ['People', 'Students'] },
      '/superadmin/abacus-enrollments': { title: 'Abacus Enrollments', crumbs: ['People', 'Enrollments'] },
      '/superadmin/org-management': { title: 'Organization Units', crumbs: ['Admin', 'Org Units'] },
      '/superadmin/users': { title: 'Users', crumbs: ['Admin', 'Users'] },
      '/superadmin/reports': { title: 'Reports', crumbs: ['Reports'] },
      '/superadmin/finance-settings': { title: 'Finance Settings', crumbs: ['Finance', 'Settings'] },
      '/superadmin/finance-dues': { title: 'Finance Dues', crumbs: ['Finance', 'Dues'] },
      '/superadmin/finance-transactions': { title: 'Finance Transactions', crumbs: ['Finance', 'Transactions'] },
      '/superadmin/finance-settlements': { title: 'Finance Settlements', crumbs: ['Finance', 'Settlements'] },
      '/superadmin/licensing': { title: 'Licensing', crumbs: ['Finance', 'Licensing'] },
      '/superadmin/license-orders': { title: 'License Orders', crumbs: ['Finance', 'License Orders'] },
      '/superadmin/licensing/allocations': { title: 'Seat Allocations', crumbs: ['Finance', 'Seat Allocations'] },
      '/superadmin/commercial-history': { title: 'Commercial History', crumbs: ['Finance', 'Commercial History'] },
      '/superadmin/sales': { title: 'Sales / Lead Console', crumbs: ['Finance', 'Sales / Leads'] },
    };
    const entry = Object.entries(map).find(([key]) => location.pathname.startsWith(key));
    if (entry) return entry[1];
    return { title: 'Overview', crumbs: ['Home'] };
  }, [location.pathname]);

  return (
    <div className={`app-shell ${compactMode ? 'compact-mode' : ''}`}>
      <header className="app-topbar">
        <div className="topbar-left">
          <span className="app-brand">Beats LMS</span>
          <span className="app-chip">Superadmin</span>
          <span className="app-muted" style={{ marginLeft: 8 }}>Operations Console</span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={toggleSidebar}>
            {sidebarCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleCompactMode}>
            {compactMode ? 'Comfortable' : 'Compact'}
          </button>
          <span className="app-muted">Welcome, {user?.username}</span>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside
          className="app-sidebar"
          style={{
            width: sidebarCollapsed ? '70px' : '220px',
            transition: 'width 0.2s ease',
          }}
        >
          <nav>
            <div className="app-nav-section-label">{sidebarCollapsed ? '' : 'Overview'}</div>
            {navItem('/superadmin/dashboard', 'Dashboard', '🏠')}
            {navItem('/superadmin/activity', 'Activity', '🛰️')}
            <div className="app-nav-section-label">{sidebarCollapsed ? '' : 'Curriculum'}</div>
            {permissions.showAbacusCourseStudio && navItem('/superadmin/abacus-course-studio', 'Course Studio', '📚')}
            {permissions.showAbacusCurriculumBuilder && navItem('/superadmin/abacus-builder', 'Curriculum Builder', '🛠️')}
            <div className="app-nav-section-label">{sidebarCollapsed ? '' : 'People'}</div>
            {permissions.showAbacusStudentsPage && navItem('/superadmin/abacus-students', 'Students', '👥')}
            {permissions.showAbacusEnrollmentsPage && navItem('/superadmin/abacus-enrollments', 'Enrollments', '🧭')}
            <div className="app-nav-section-label">{sidebarCollapsed ? '' : 'Finance'}</div>
            {navItem('/superadmin/finance-settings', 'Finance Settings', '⚙️')}
            {navItem('/superadmin/finance-dues', 'Dues', '💳')}
            {navItem('/superadmin/finance-transactions', 'Transactions', '📄')}
            {navItem('/superadmin/finance-settlements', 'Settlements', '$')}
            {navItem('/superadmin/licensing', 'Licensing', '??')}
            {user?.role === 'SUPERADMIN' && navItem('/superadmin/license-orders', 'License Orders', '🧾')}
            {user?.role === 'SUPERADMIN' && navItem('/superadmin/licensing/allocations', 'Seat Allocations', '📦')}
            {user?.role === 'SUPERADMIN' && navItem('/superadmin/commercial-history', 'Commercial History', '📊')}
            {user?.role === 'SUPERADMIN' && navItem('/superadmin/sales', 'Sales / Leads', '📈')}
            <div className="app-nav-section-label">{sidebarCollapsed ? '' : 'Admin'}</div>
            {permissions.showOrgManagement && navItem('/superadmin/org-management', 'Org Units', '🏢')}
            {permissions.showOrgManagement && navItem('/superadmin/users', 'Users', '🧑‍💼')}
            {navItem('/superadmin/reports', 'Reports', '📊')}
          </nav>
        </aside>
        <main className="app-main">
          <div className="page-header">
            <div>
              <p className="breadcrumb">
                {pageMeta.crumbs.map((crumb, idx) => (
                  <span key={crumb}>
                    {crumb}
                    {idx < pageMeta.crumbs.length - 1 && ' / '}
                  </span>
                ))}
              </p>
              <h1 className="page-title">{pageMeta.title}</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
                {pageMeta.action || 'Refresh'}
              </button>
            </div>
          </div>
          <div className="card">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperadminLayout;

