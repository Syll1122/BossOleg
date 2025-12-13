import { useState, useEffect } from 'react';
import { Account } from '../types';
import { 
  getPendingRegistrations, 
  approveRegistration, 
  rejectRegistration, 
  getRegistrationHistory,
  RegistrationHistory 
} from '../services/api';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService';
import { getAdminSession } from '../services/auth';
import './Registrations.css';

export default function Registrations() {
  const [pendingRegistrations, setPendingRegistrations] = useState<Account[]>([]);
  const [history, setHistory] = useState<RegistrationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<Account | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [pending, historyData] = await Promise.all([
        getPendingRegistrations(),
        getRegistrationHistory(),
      ]);
      setPendingRegistrations(pending);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load registrations:', error);
      alert('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (collector: Account) => {
    if (!confirm(`Approve registration for ${collector.name} (${collector.email})?`)) {
      return;
    }

    setProcessingId(collector.id);
    try {
      const admin = getAdminSession();
      if (!admin) {
        alert('Admin session expired. Please log in again.');
        return;
      }

      // Approve registration
      await approveRegistration(collector.id, admin.id, admin.name);

      // Send approval email
      await sendApprovalEmail({
        toEmail: collector.email,
        userName: collector.name,
        collectorName: collector.name,
      });

      // Reload data
      await loadData();
      alert('Registration approved and email sent successfully!');
    } catch (error) {
      console.error('Failed to approve registration:', error);
      alert('Failed to approve registration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedCollector) return;

    setProcessingId(selectedCollector.id);
    try {
      const admin = getAdminSession();
      if (!admin) {
        alert('Admin session expired. Please log in again.');
        return;
      }

      // Reject registration
      await rejectRegistration(
        selectedCollector.id,
        admin.id,
        admin.name,
        rejectionNotes || undefined
      );

      // Send rejection email
      await sendRejectionEmail({
        toEmail: selectedCollector.email,
        userName: selectedCollector.name,
        collectorName: selectedCollector.name,
      });

      // Reload data
      await loadData();
      alert('Registration rejected and email sent successfully!');
      
      // Close modal and reset
      setShowRejectModal(false);
      setSelectedCollector(null);
      setRejectionNotes('');
    } catch (error) {
      console.error('Failed to reject registration:', error);
      alert('Failed to reject registration');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (collector: Account) => {
    setSelectedCollector(collector);
    setRejectionNotes('');
    setShowRejectModal(true);
  };

  if (loading) {
    return <div className="loading">Loading registrations...</div>;
  }

  return (
    <div className="registrations-page">
      <div className="page-header">
        <h1>Registration Approvals</h1>
        <div className="badge badge-info" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
          Pending: {pendingRegistrations.length}
        </div>
      </div>

      {/* Pending Registrations */}
      <div className="section">
        <h2>Pending Registrations</h2>
        {pendingRegistrations.length === 0 ? (
          <div className="empty-state">No pending registrations</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Truck No</th>
                  <th>Barangay</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRegistrations.map((collector) => (
                  <tr key={collector.id}>
                    <td>{collector.name}</td>
                    <td>{collector.email}</td>
                    <td>{collector.username}</td>
                    <td>{collector.truckNo || '-'}</td>
                    <td>{collector.barangay || '-'}</td>
                    <td>{collector.phoneNumber || '-'}</td>
                    <td>{new Date(collector.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-success btn-small"
                          onClick={() => handleApprove(collector)}
                          disabled={processingId === collector.id}
                        >
                          {processingId === collector.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => openRejectModal(collector)}
                          disabled={processingId === collector.id}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="section">
        <h2>History</h2>
        {history.length === 0 ? (
          <div className="empty-state">No approval history</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Collector Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Date</th>
                  <th>Truck No</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.collectorName}</td>
                    <td>{item.collectorEmail}</td>
                    <td>
                      <span className={`badge ${
                        item.status === 'approved' 
                          ? 'badge-success' 
                          : item.status === 'deleted' 
                          ? 'badge-danger' 
                          : 'badge-warning'
                      }`}>
                        {item.status === 'approved' 
                          ? 'Approved' 
                          : item.status === 'deleted' 
                          ? 'Deleted' 
                          : 'Rejected'}
                      </span>
                    </td>
                    <td>{item.reviewedByName}</td>
                    <td>{new Date(item.reviewedAt).toLocaleString()}</td>
                    <td>{item.truckNo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedCollector && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Registration</h3>
            <p>Are you sure you want to reject {selectedCollector.name}'s registration?</p>
            <div className="input-group">
              <label>Rejection Notes (Optional)</label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Add a reason for rejection..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedCollector(null);
                  setRejectionNotes('');
                }}
                disabled={processingId === selectedCollector.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={processingId === selectedCollector.id}
              >
                {processingId === selectedCollector.id ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

