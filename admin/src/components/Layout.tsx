import { Link, useLocation } from 'react-router-dom';
import { Account } from '../types';
import LeafLogo from './LeafLogo';
import './Layout.css';

interface LayoutProps {
  admin: Account;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ admin, onLogout, children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊', color: 'var(--accent-blue)' },
    { path: '/registrations', label: 'Registrations', icon: '✅', color: 'var(--accent-yellow)' },
    { path: '/users', label: 'Users', icon: '👥', color: 'var(--accent-purple)' },
    { path: '/create-user', label: 'Create User', icon: '➕', color: 'var(--primary)' },
    { path: '/schedules', label: 'Schedules', icon: '📅', color: 'var(--accent-teal)' },
    { path: '/reports', label: 'Reports', icon: '📝', color: 'var(--accent-orange)' },
    { path: '/trucks', label: 'Trucks', icon: '🚛', color: 'var(--accent-blue)' },
    { path: '/collection-status', label: 'Collection Status', icon: '📊', color: 'var(--accent-green, #16a34a)' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <LeafLogo size="medium" />
            <div className="sidebar-brand">
              <h1>W.A.T.C.H.</h1>
              <p>Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              style={location.pathname === item.path ? { '--accent-color': item.color } as React.CSSProperties : {}}
            >
              <span className="nav-icon" style={{ color: item.color }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{admin.name}</div>
              <div className="user-role">{admin.role}</div>
            </div>
          </div>
          <button onClick={onLogout} className="btn btn-danger btn-small logout-btn">
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
