import { useState, useEffect } from 'react';
import { Report } from '../types';
import { getAllReports, updateReportStatus, deleteReport } from '../services/api';
import './Reports.css';

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('all');

  useEffect(() => {
    loadReports();
    const interval = setInterval(loadReports, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadReports = async () => {
    try {
      const data = await getAllReports();
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
      alert('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Report['status']) => {
    try {
      await updateReportStatus(id, newStatus);
      setReports(reports.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (error) {
      console.error('Failed to update report:', error);
      alert('Failed to update report status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await deleteReport(id);
      setReports(reports.filter(r => r.id !== id));
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('Failed to delete report');
    }
  };

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter);

  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports Management</h1>
        <div className="filter-group">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({reports.length})
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button
            className={`filter-btn ${filter === 'reviewed' ? 'active' : ''}`}
            onClick={() => setFilter('reviewed')}
          >
            Reviewed ({reports.filter(r => r.status === 'reviewed').length})
          </button>
          <button
            className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilter('resolved')}
          >
            Resolved ({reports.filter(r => r.status === 'resolved').length})
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>User</th>
              <th>Barangay</th>
              <th>Truck No</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No reports found
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="issue-content">
                      <strong>{report.issue}</strong>
                      <small>{report.reportType === 'select' ? 'Pre-selected' : 'Custom'}</small>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div>{report.userName}</div>
                      <small style={{ color: 'var(--text-light)' }}>{report.userEmail}</small>
                    </div>
                  </td>
                  <td>{report.barangay}</td>
                  <td>{report.truckNo}</td>
                  <td>
                    <select
                      value={report.status}
                      onChange={(e) => handleStatusChange(report.id, e.target.value as Report['status'])}
                      className="status-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                  <td>{new Date(report.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(report.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}




