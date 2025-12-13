import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, DashboardStats } from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
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
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', bgColor: 'var(--blue-bg)' },
    { label: 'Residents', value: stats.totalResidents, icon: '🏠', bgColor: 'var(--green-bg)' },
    { label: 'Collectors', value: stats.totalCollectors, icon: '🚛', bgColor: 'var(--orange-bg)' },
    { label: 'Admins', value: stats.totalAdmins, icon: '👑', bgColor: 'var(--purple-bg)' },
    { label: 'Pending Registrations', value: stats.pendingRegistrations, icon: '⏸️', bgColor: 'var(--yellow-bg)' },
    { label: 'Total Reports', value: stats.totalReports, icon: '📝', bgColor: 'var(--blue-bg)' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: '⏳', bgColor: 'var(--yellow-bg)' },
    { label: 'Resolved Reports', value: stats.resolvedReports, icon: '✅', bgColor: 'var(--green-bg)' },
    { label: 'Active Trucks', value: stats.activeTrucks, icon: '🚚', bgColor: 'var(--blue-bg)' },
    { label: 'Total Trucks', value: stats.totalTrucks, icon: '🚛', bgColor: 'var(--gray-bg)' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Overview of your waste collection management system</p>
        {stats.pendingRegistrations > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <Link 
              to="/registrations" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--warning)',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 600,
                boxShadow: 'var(--shadow)',
              }}
            >
              ⚠️ {stats.pendingRegistrations} Pending Registration{stats.pendingRegistrations !== 1 ? 's' : ''}
            </Link>
          </div>
        )}
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: card.bgColor }}>
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
