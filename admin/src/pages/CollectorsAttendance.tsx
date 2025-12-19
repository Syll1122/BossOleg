import { useState, useEffect } from 'react';
import { getAllAccounts, getAllTruckStatuses } from '../services/api';
import './CollectorsAttendance.css';

interface AttendanceRecord {
  collectorId: string;
  collectorName: string;
  truckNo: string;
  date: string;
  startTime: string;
  endTime: string | null;
  duration: string;
  status: 'active' | 'completed';
  totalCollections: number;
}

export default function CollectorsAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAttendance();
  }, [dateRange]);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      // Get all collectors
      const collectors = await getAllAccounts();
      const collectorAccounts = collectors.filter(c => c.role === 'collector');

      // Get truck statuses for the date range
      const truckStatuses = await getAllTruckStatuses();

      // Group truck statuses by collector and date
      const attendanceMap = new Map<string, AttendanceRecord>();

      truckStatuses.forEach((status) => {
        // Find collector by truck number or status ID
        const collector = collectorAccounts.find(c => 
          c.truckNo === status.id || c.id === status.updatedBy
        );

        if (!collector) return;

        const statusDate = new Date(status.updatedAt);
        const dateStr = statusDate.toISOString().split('T')[0];
        
        // Check if date is in range
        if (dateStr < dateRange.start || dateStr > dateRange.end) return;

        const key = `${collector.id}-${dateStr}`;

        if (!attendanceMap.has(key)) {
          attendanceMap.set(key, {
            collectorId: collector.id,
            collectorName: collector.name,
            truckNo: collector.truckNo || 'N/A',
            date: dateStr,
            startTime: statusDate.toLocaleTimeString(),
            endTime: null,
            duration: '0h 0m',
            status: status.isCollecting ? 'active' : 'completed',
            totalCollections: 0
          });
        }

        const record = attendanceMap.get(key)!;
        
        // Update end time if status changed to not collecting
        if (!status.isCollecting && record.status === 'active') {
          record.endTime = statusDate.toLocaleTimeString();
          record.status = 'completed';
          
          // Calculate duration
          const start = new Date(`${dateStr}T${record.startTime}`);
          const end = statusDate;
          const diffMs = end.getTime() - start.getTime();
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          record.duration = `${hours}h ${minutes}m`;
        }

        // Count collections (when isCollecting becomes true)
        if (status.isCollecting) {
          record.totalCollections += 1;
        }
      });

      // Convert map to array and sort by date (newest first)
      const attendanceArray = Array.from(attendanceMap.values()).sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.collectorName.localeCompare(b.collectorName);
      });

      setAttendance(attendanceArray);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      alert('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    const reportData = attendance.map(record => ({
      'Collector': record.collectorName,
      'Truck No': record.truckNo,
      'Date': record.date,
      'Start Time': record.startTime,
      'End Time': record.endTime || 'N/A',
      'Duration': record.duration,
      'Status': record.status,
      'Total Collections': record.totalCollections
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
    a.download = `collectors-attendance-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary statistics
  const totalDays = attendance.length;
  const activeCollectors = new Set(attendance.filter(a => a.status === 'active').map(a => a.collectorId)).size;
  const totalHours = attendance.reduce((sum, a) => {
    const [hours] = a.duration.split('h').map(Number);
    return sum + (hours || 0);
  }, 0);

  if (loading) {
    return <div className="loading">Loading attendance records...</div>;
  }

  return (
    <div className="collectors-attendance-page">
      <div className="page-header">
        <h1>👤 Collectors' Attendance</h1>
        <p>Track collector attendance and work hours</p>
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
          <button className="btn btn-primary" onClick={loadAttendance}>
            Refresh
          </button>
          <button className="btn btn-success" onClick={generateReport} disabled={attendance.length === 0}>
            Generate CSV Report
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{totalDays}</div>
          <div className="summary-label">Total Records</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{activeCollectors}</div>
          <div className="summary-label">Active Collectors</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{totalHours}h</div>
          <div className="summary-label">Total Hours</div>
        </div>
      </div>

      <div className="table-container">
        {attendance.length === 0 ? (
          <div className="empty-state">
            <p>No attendance records found for the selected date range.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Truck No</th>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Collections</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record, idx) => (
                <tr key={`${record.collectorId}-${record.date}-${idx}`}>
                  <td>{record.collectorName}</td>
                  <td>{record.truckNo}</td>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{record.startTime}</td>
                  <td>{record.endTime || '-'}</td>
                  <td>{record.duration}</td>
                  <td>
                    <span className={`badge ${record.status === 'active' ? 'badge-success' : 'badge-info'}`}>
                      {record.status === 'active' ? 'Active' : 'Completed'}
                    </span>
                  </td>
                  <td>{record.totalCollections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

