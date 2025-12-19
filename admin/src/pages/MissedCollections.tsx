import { useState, useEffect } from 'react';
import { getAllAccounts, getAllReports } from '../services/api';
import { supabase } from '../lib/supabase';
import './MissedCollections.css';

interface MissedCollection {
  id: string;
  collectorId: string;
  collectorName: string;
  truckNo: string;
  barangay: string;
  street: string;
  scheduledDate: string;
  scheduledDay: string;
  status: 'missed' | 'completed';
  source: 'schedule' | 'report';
  reportId?: string;
  reportedBy?: string;
  reportDate?: string;
}

export default function MissedCollections() {
  const [missedCollections, setMissedCollections] = useState<MissedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadMissedCollections();
  }, [dateRange]);

  const loadMissedCollections = async () => {
    setLoading(true);
    try {
      // Get all collectors
      const collectors = await getAllAccounts();
      const collectorAccounts = collectors.filter(c => c.role === 'collector');

      // Get reports with "Missed collection" issue
      const allReports = await getAllReports();
      const missedCollectionReports = allReports.filter(r => 
        r.issue.toLowerCase().includes('missed collection') &&
        new Date(r.createdAt).toISOString().split('T')[0] >= dateRange.start &&
        new Date(r.createdAt).toISOString().split('T')[0] <= dateRange.end
      );

      // Get collection schedules
      const { data: schedules, error: scheduleError } = await supabase
        .from('collection_schedules')
        .select('*');

      if (scheduleError) {
        console.error('Error loading schedules:', scheduleError);
      }

      // Get truck status updates to determine actual collections
      const { data: truckStatuses, error: truckError } = await supabase
        .from('truck_status')
        .select('*')
        .gte('updatedAt', dateRange.start)
        .lte('updatedAt', dateRange.end + 'T23:59:59');

      const missed: MissedCollection[] = [];

      // Add reports with "Missed collection" issue
      missedCollectionReports.forEach((report) => {
        missed.push({
          id: `report-${report.id}`,
          collectorId: report.collectorId || '',
          collectorName: 'N/A',
          truckNo: report.truckNo || 'N/A',
          barangay: report.barangay,
          street: 'N/A',
          scheduledDate: new Date(report.createdAt).toISOString().split('T')[0],
          scheduledDay: new Date(report.createdAt).toLocaleDateString('en-US', { weekday: 'short' }),
          status: 'missed',
          source: 'report',
          reportId: report.id,
          reportedBy: report.userName,
          reportDate: report.createdAt
        });
      });

      // Check each schedule against actual collections
      schedules?.forEach((schedule: any) => {
        const collector = collectorAccounts.find(c => c.id === schedule.collectorId);
        if (!collector) return;

        const days = Array.isArray(schedule.days) ? schedule.days : [];
        const streets = Array.isArray(schedule.street_name) ? schedule.street_name : [schedule.street_name];
        const barangays = Array.isArray(schedule.barangay_name) ? schedule.barangay_name : [schedule.barangay_name];

        // Check each day in the schedule
        days.forEach((day: string) => {
          const dayMap: { [key: string]: number } = {
            'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
          };
          
          // Find dates in range that match this day
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === dayMap[day]) {
              // Check if there was collection activity on this date
              const dateStr = d.toISOString().split('T')[0];
              const hadActivity = truckStatuses?.some(ts => {
                const tsDate = new Date(ts.updatedAt).toISOString().split('T')[0];
                return tsDate === dateStr && ts.isCollecting;
              });

              streets.forEach((street: string, idx: number) => {
                if (!hadActivity) {
                  // Check if this is already reported by a resident
                  const alreadyReported = missedCollectionReports.some(r => 
                    r.barangay === (barangays[idx] || schedule.barangay) &&
                    new Date(r.createdAt).toISOString().split('T')[0] === dateStr
                  );

                  if (!alreadyReported) {
                    missed.push({
                      id: `${schedule.id}-${day}-${dateStr}-${idx}`,
                      collectorId: schedule.collectorId,
                      collectorName: collector.name,
                      truckNo: collector.truckNo || 'N/A',
                      barangay: barangays[idx] || schedule.barangay || 'N/A',
                      street: street || 'N/A',
                      scheduledDate: dateStr,
                      scheduledDay: day,
                      status: 'missed',
                      source: 'schedule'
                    });
                  }
                }
              });
            }
          }
        });
      });

      setMissedCollections(missed.sort((a, b) => 
        new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
      ));
    } catch (error) {
      console.error('Failed to load missed collections:', error);
      alert('Failed to load missed collections');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    const reportData = missedCollections.map(mc => ({
      'Collector': mc.collectorName,
      'Truck No': mc.truckNo,
      'Barangay': mc.barangay,
      'Street': mc.street,
      'Scheduled Day': mc.scheduledDay,
      'Scheduled Date': mc.scheduledDate,
      'Status': mc.status
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
    a.download = `missed-collections-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Loading missed collections...</div>;
  }

  return (
    <div className="missed-collections-page">
      <div className="page-header">
        <h1>📋 Missed Collections Report</h1>
        <p>Generate reports on missed waste collection schedules</p>
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
          <button className="btn btn-primary" onClick={loadMissedCollections}>
            Refresh
          </button>
          <button className="btn btn-success" onClick={generateReport} disabled={missedCollections.length === 0}>
            Generate CSV Report
          </button>
        </div>
      </div>

      <div className="table-container">
        {missedCollections.length === 0 ? (
          <div className="empty-state">
            <p>✅ No missed collections found for the selected date range.</p>
            <p>All scheduled collections were completed successfully.</p>
          </div>
        ) : (
          <>
            <div className="summary">
              <strong>Total Missed Collections: {missedCollections.length}</strong>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Collector</th>
                  <th>Truck No</th>
                  <th>Barangay</th>
                  <th>Street</th>
                  <th>Date</th>
                  <th>Reported By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {missedCollections.map((collection) => (
                  <tr key={collection.id}>
                    <td>
                      <span className={`badge ${collection.source === 'report' ? 'badge-info' : 'badge-secondary'}`}>
                        {collection.source === 'report' ? 'Report' : 'Schedule'}
                      </span>
                    </td>
                    <td>{collection.collectorName}</td>
                    <td>{collection.truckNo}</td>
                    <td>{collection.barangay}</td>
                    <td>{collection.street}</td>
                    <td>{new Date(collection.scheduledDate).toLocaleDateString()}</td>
                    <td>{collection.reportedBy || '-'}</td>
                    <td>
                      <span className="badge badge-warning">Missed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

