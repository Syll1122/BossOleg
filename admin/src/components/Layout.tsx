import { Link, useLocation } from 'react-router-dom';
import { Account } from '../types';
import './Layout.css';

interface LayoutProps {
  admin: Account;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ admin, onLogout, children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/registrations', label: 'Registrations', icon: '✅' },
    { path: '/users', label: 'Users', icon: '👥' },
    { path: '/create-user', label: 'Create User', icon: '➕' },
    { path: '/schedules', label: 'Schedules', icon: '📅' },
    { path: '/reports', label: 'Reports', icon: '📝' },
    { path: '/trucks', label: 'Trucks', icon: '🚛' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Admin Panel</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{admin.name}</div>
            <div className="user-role">{admin.role}</div>
          </div>
          <button onClick={onLogout} className="btn btn-danger btn-small">
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
