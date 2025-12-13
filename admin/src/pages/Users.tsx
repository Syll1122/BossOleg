import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Account } from '../types';
import { getAllAccounts, updateAccount, deleteAccount, getRegistrationHistory, RegistrationHistory } from '../services/api';
import { getAdminSession } from '../services/auth';
import './Users.css';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'resident' | 'collector'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [deletedAccounts, setDeletedAccounts] = useState<RegistrationHistory[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  // Load deleted history when modal opens
  useEffect(() => {
    if (showHistory) {
      loadDeletedHistory();
    }
  }, [showHistory]);

  const loadUsers = async () => {
    try {
      const data = await getAllAccounts();
      // Filter out admin accounts - they won't be shown in user management
      const nonAdminUsers = data.filter(account => account.role !== 'admin');
      setUsers(nonAdminUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadDeletedHistory = async () => {
    try {
      const history = await getRegistrationHistory();
      // Filter only deleted accounts
      const deleted = history.filter(item => item.status === 'deleted');
      setDeletedAccounts(deleted);
    } catch (error) {
      console.error('Failed to load deleted history:', error);
    }
  };

  const handleDelete = async (id: string, userRole: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const admin = getAdminSession();
      if (!admin) {
        alert('Admin session expired. Please log in again.');
        return;
      }

      // Delete account (will record in history if collector)
      await deleteAccount(id, admin.id, admin.name);
      
      // Update UI immediately
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      
      // Reload deleted history if history modal is open
      if (showHistory) {
        await loadDeletedHistory();
      }
      
      console.log('Account deleted successfully');
      alert('Account deleted successfully.');
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleShowHistory = async () => {
    setShowHistory(true);
    await loadDeletedHistory();
  };

  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => u.role === filter);
  
  // Count users by role (excluding admins)
  const residentsCount = users.filter(u => u.role === 'resident').length;
  const collectorsCount = users.filter(u => u.role === 'collector').length;

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users Management</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-group">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({users.length})
            </button>
            <button
              className={`filter-btn ${filter === 'resident' ? 'active' : ''}`}
              onClick={() => setFilter('resident')}
            >
              Residents ({residentsCount})
            </button>
            <button
              className={`filter-btn ${filter === 'collector' ? 'active' : ''}`}
              onClick={() => setFilter('collector')}
            >
              Collectors ({collectorsCount})
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/create-user')}
            >
              ➕ Create User
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleShowHistory}
            >
              📋 History
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Truck No</th>
              <th>Barangay</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.username}</td>
                  <td>
                    <span className={`badge badge-${user.role === 'admin' ? 'danger' : user.role === 'collector' ? 'info' : 'success'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.truckNo || '-'}</td>
                  <td>{user.barangay || '-'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(user.id, user.role)}
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

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Deleted Accounts History</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            
            {deletedAccounts.length === 0 ? (
              <div className="empty-state">No deleted accounts</div>
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
                    {deletedAccounts.map((item) => (
                      <tr key={item.id}>
                        <td>{item.collectorName}</td>
                        <td>{item.collectorEmail}</td>
                        <td>
                          <span className="badge badge-danger">Deleted</span>
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
        </div>
      )}
    </div>
  );
}
