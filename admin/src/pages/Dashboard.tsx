import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardStats, DashboardStats } from '../services/api';
import LeafLogo from '../components/LeafLogo';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="error">Failed to load dashboard data</div>;
  }

  const statCards = [
    { 
      label: 'Total Users', 
      value: stats.totalUsers, 
      icon: '👥', 
      bgColor: 'var(--blue-bg)',
      hoverColor: 'var(--blue-bg-hover)',
      accentColor: 'var(--accent-blue)'
    },
    { 
      label: 'Residents', 
      value: stats.totalResidents, 
      icon: '🏠', 
      bgColor: 'var(--green-bg)',
      hoverColor: 'var(--green-bg-hover)',
      accentColor: 'var(--primary)'
    },
    { 
      label: 'Collectors', 
      value: stats.totalCollectors, 
      icon: '🚛', 
      bgColor: 'var(--orange-bg)',
      hoverColor: 'var(--orange-bg-hover)',
      accentColor: 'var(--accent-orange)'
    },
    { 
      label: 'Admins', 
      value: stats.totalAdmins, 
      icon: '👑', 
      bgColor: 'var(--purple-bg)',
      hoverColor: 'var(--purple-bg-hover)',
      accentColor: 'var(--accent-purple)'
    },
    { 
      label: 'Pending Registrations', 
      value: stats.pendingRegistrations, 
      icon: '⏸️', 
      bgColor: 'var(--yellow-bg)',
      hoverColor: 'var(--yellow-bg-hover)',
      accentColor: 'var(--accent-yellow)'
    },
    { 
      label: 'Total Reports', 
      value: stats.totalReports, 
      icon: '📝', 
      bgColor: 'var(--blue-bg)',
      hoverColor: 'var(--blue-bg-hover)',
      accentColor: 'var(--accent-blue)'
    },
    { 
      label: 'Pending Reports', 
      value: stats.pendingReports, 
      icon: '⏳', 
      bgColor: 'var(--yellow-bg)',
      hoverColor: 'var(--yellow-bg-hover)',
      accentColor: 'var(--accent-yellow)',
      onClick: () => navigate('/reports?filter=pending')
    },
    { 
      label: 'Resolved Reports', 
      value: stats.resolvedReports, 
      icon: '✅', 
      bgColor: 'var(--green-bg)',
      hoverColor: 'var(--green-bg-hover)',
      accentColor: 'var(--success)',
      onClick: () => navigate('/reports?filter=resolved')
    },
    { 
      label: 'Active Trucks', 
      value: stats.activeTrucks, 
      icon: '🚚', 
      bgColor: 'var(--teal-bg)',
      hoverColor: 'var(--teal-bg-hover)',
      accentColor: 'var(--accent-teal)'
    },
    { 
      label: 'Total Trucks', 
      value: stats.totalTrucks, 
      icon: '🚛', 
      bgColor: 'var(--gray-bg)',
      hoverColor: '#e5e7eb',
      accentColor: 'var(--secondary)'
    },
    { 
      label: "Collectors' Attendance", 
      value: '-', 
      icon: '👤', 
      bgColor: 'var(--indigo-bg, #eef2ff)',
      hoverColor: 'var(--indigo-bg-hover, #e0e7ff)',
      accentColor: 'var(--accent-indigo, #6366f1)',
      onClick: () => navigate('/collectors-attendance')
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <div className="dashboard-logo">
            <LeafLogo size="medium" />
          </div>
          <div>
            <h1>Dashboard</h1>
            <p>Overview of your Waste Collection Management System</p>
          </div>
        </div>
        {stats.pendingRegistrations > 0 && (
          <div className="pending-alert">
            <Link 
              to="/registrations" 
              className="pending-link"
            >
              <span className="alert-icon">⚠️</span>
              <span>{stats.pendingRegistrations} Pending Registration{stats.pendingRegistrations !== 1 ? 's' : ''}</span>
            </Link>
          </div>
        )}
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <div 
            key={card.label} 
            className="stat-card"
            style={{
              '--card-bg': card.bgColor,
              '--card-hover': card.hoverColor,
              '--accent': card.accentColor,
              cursor: card.onClick ? 'pointer' : 'default'
            } as React.CSSProperties}
            onClick={card.onClick}
          >
            <div className="stat-icon">
              {card.icon}
            </div>
            <div className="stat-content">
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
