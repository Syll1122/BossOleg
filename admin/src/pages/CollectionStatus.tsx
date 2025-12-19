import { useState, useEffect } from 'react';
import { getAllAccounts } from '../services/api';
import { supabase } from '../lib/supabase';
import './CollectionStatus.css';

interface CollectionStatus {
  id: string;
  collectorId: string;
  collectorName: string;
  truckNo: string;
  street: string;
  barangay: string;
  status: 'done' | 'skipped' | 'collected';
  collectionDate: string;
  updatedAt: string;
}

export default function CollectionStatus() {
  const [statuses, setStatuses] = useState<CollectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filter, setFilter] = useState<'all' | 'done' | 'skipped' | 'collected'>('all');

  useEffect(() => {
    loadCollectionStatuses();
  }, [dateRange, filter]);

  const loadCollectionStatuses = async () => {
    setLoading(true);
    try {
      // Get all collectors for name lookup
      const collectors = await getAllAccounts();
      const collectorMap = new Map(collectors.map(c => [c.id, c.name]));

      // Get collection statuses
      let query = supabase
        .from('collection_status')
        .select('*')
        .gte('collectionDate', dateRange.start)
        .lte('collectionDate', dateRange.end)
        .order('collectionDate', { ascending: false })
        .order('updatedAt', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading collection statuses:', error);
        setLoading(false);
        return;
      }

      // Map collector names
      const statusesWithNames: CollectionStatus[] = (data || []).map((status: any) => ({
        ...status,
        collectorName: collectorMap.get(status.collectorId) || 'Unknown',
      }));

      setStatuses(statusesWithNames);
    } catch (error) {
      console.error('Failed to load collection statuses:', error);
      alert('Failed to load collection statuses');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    const reportData = statuses.map(s => ({
      'Collector': s.collectorName,
      'Truck No': s.truckNo,
      'Street': s.street,
      'Barangay': s.barangay,
      'Status': s.status,
      'Collection Date': s.collectionDate,
      'Updated At': new Date(s.updatedAt).toLocaleString()
    }));

    // Convert to CSV
    const headers = Object.keys(reportData[0] || {});
    const csv = [
      headers.join(','),
      ...reportData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-status-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary statistics
  const total = statuses.length;
  const done = statuses.filter(s => s.status === 'done').length;
  const skipped = statuses.filter(s => s.status === 'skipped').length;
  const collected = statuses.filter(s => s.status === 'collected').length;

  if (loading) {
    return <div className="loading">Loading collection statuses...</div>;
  }

  return (
    <div className="collection-status-page">
      <div className="page-header">
        <h1>📊 Collection Status</h1>
        <p>View all collection statuses, missed collections, and skipped routes</p>
      </div>

      <div className="filter-section">
        <div className="date-range">
          <label>
            Start Date:
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </label>
          <label>
            End Date:
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({total})
            </button>
            <button
              className={`filter-btn ${filter === 'done' ? 'active' : ''}`}
              onClick={() => setFilter('done')}
            >
              Done ({done})
            </button>
            <button
              className={`filter-btn ${filter === 'skipped' ? 'active' : ''}`}
              onClick={() => setFilter('skipped')}
            >
              Skipped ({skipped})
            </button>
            <button
              className={`filter-btn ${filter === 'collected' ? 'active' : ''}`}
              onClick={() => setFilter('collected')}
            >
              Collected ({collected})
            </button>
          </div>
          <button className="btn btn-primary" onClick={loadCollectionStatuses}>
            Refresh
          </button>
          <button className="btn btn-success" onClick={generateReport} disabled={statuses.length === 0}>
            Generate CSV Report
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{total}</div>
          <div className="summary-label">Total Records</div>
        </div>
        <div className="summary-card success">
          <div className="summary-value">{done}</div>
          <div className="summary-label">Done</div>
        </div>
        <div className="summary-card warning">
          <div className="summary-value">{skipped}</div>
          <div className="summary-label">Skipped</div>
        </div>
        <div className="summary-card info">
          <div className="summary-value">{collected}</div>
          <div className="summary-label">Collected</div>
        </div>
      </div>

      <div className="table-container">
        {statuses.length === 0 ? (
          <div className="empty-state">
            <p>No collection statuses found for the selected date range.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Truck No</th>
                <th>Street</th>
                <th>Barangay</th>
                <th>Status</th>
                <th>Collection Date</th>
                <th>Updated At</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => (
                <tr key={status.id}>
                  <td>{status.collectorName}</td>
                  <td>{status.truckNo}</td>
                  <td>{status.street}</td>
                  <td>{status.barangay}</td>
                  <td>
                    <span className={`badge ${
                      status.status === 'done' ? 'badge-success' :
                      status.status === 'collected' ? 'badge-info' : 'badge-warning'
                    }`}>
                      {status.status}
                    </span>
                  </td>
                  <td>{new Date(status.collectionDate).toLocaleDateString()}</td>
                  <td>{new Date(status.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

