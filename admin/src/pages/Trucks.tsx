import { useState, useEffect } from 'react';
import { getAllTrucks, createTruck, updateTruck, deleteTruck, Truck } from '../services/api';
import './Trucks.css';

export default function Trucks() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [newTruckNo, setNewTruckNo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadTrucks();
  }, []);

  const loadTrucks = async () => {
    try {
      setLoading(true);
      const data = await getAllTrucks();
      setTrucks(data);
      setError('');
    } catch (error: any) {
      console.error('Failed to load trucks:', error);
      setError('Failed to load trucks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newTruckNo.trim()) {
      setError('Please enter a truck number');
      return;
    }

    try {
      await createTruck(newTruckNo.trim());
      setNewTruckNo('');
      setShowAddModal(false);
      await loadTrucks();
    } catch (error: any) {
      setError(error.message || 'Failed to add truck number');
    }
  };

  const handleEditTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editingTruck) return;

    const newTruckNo = (e.target as any).elements.truckNo.value.trim();
    if (!newTruckNo) {
      setError('Please enter a truck number');
      return;
    }

    try {
      await updateTruck(editingTruck.id, { truckNo: newTruckNo });
      setEditingTruck(null);
      setShowEditModal(false);
      await loadTrucks();
    } catch (error: any) {
      setError(error.message || 'Failed to update truck number');
    }
  };

  const handleToggleActive = async (truck: Truck) => {
    try {
      await updateTruck(truck.id, { isActive: !truck.isActive });
      await loadTrucks();
    } catch (error: any) {
      alert(error.message || 'Failed to update truck status');
    }
  };

  const handleDeleteTruck = async (truck: Truck) => {
    if (!confirm(`Are you sure you want to delete truck number "${truck.truckNo}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteTruck(truck.id);
      await loadTrucks();
    } catch (error: any) {
      alert(error.message || 'Failed to delete truck number');
    }
  };

  const openEditModal = (truck: Truck) => {
    setEditingTruck(truck);
    setError('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingTruck(null);
    setError('');
    setShowEditModal(false);
  };

  const openAddModal = () => {
    setNewTruckNo('');
    setError('');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setNewTruckNo('');
    setError('');
    setShowAddModal(false);
  };

  const activeTrucks = trucks.filter(t => t.isActive);
  const inactiveTrucks = trucks.filter(t => !t.isActive);

  if (loading) {
    return (
      <div className="trucks-page">
        <div className="loading">Loading trucks...</div>
      </div>
    );
  }

  return (
    <div className="trucks-page">
      <div className="page-header">
        <div>
          <h1>🚛 Truck Number Management</h1>
          <p>Manage truck numbers available for collector assignment</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          ➕ Add New Truck
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="trucks-section">
        <h2>Active Trucks ({activeTrucks.length})</h2>
        {activeTrucks.length === 0 ? (
          <div className="empty-state">
            No active trucks. Click "Add New Truck" to create one.
          </div>
        ) : (
          <div className="trucks-grid">
            {activeTrucks.map((truck) => (
              <div key={truck.id} className="truck-card">
                <div className="truck-header">
                  <h3>{truck.truckNo}</h3>
                  <span className="badge badge-success">Active</span>
                </div>
                <div className="truck-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => openEditModal(truck)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-small btn-warning"
                    onClick={() => handleToggleActive(truck)}
                  >
                    Deactivate
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteTruck(truck)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inactiveTrucks.length > 0 && (
        <div className="trucks-section" style={{ marginTop: '2rem' }}>
          <h2>Inactive Trucks ({inactiveTrucks.length})</h2>
          <div className="trucks-grid">
            {inactiveTrucks.map((truck) => (
              <div key={truck.id} className="truck-card truck-card-inactive">
                <div className="truck-header">
                  <h3>{truck.truckNo}</h3>
                  <span className="badge badge-secondary">Inactive</span>
                </div>
                <div className="truck-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => openEditModal(truck)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handleToggleActive(truck)}
                  >
                    Activate
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteTruck(truck)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Truck Number</h2>
              <button className="modal-close" onClick={closeAddModal}>×</button>
            </div>
            <form onSubmit={handleAddTruck}>
              <div className="form-group">
                <label htmlFor="newTruckNo">Truck Number</label>
                <input
                  type="text"
                  id="newTruckNo"
                  value={newTruckNo}
                  onChange={(e) => setNewTruckNo(e.target.value)}
                  placeholder="e.g., BCG 15*8"
                  autoFocus
                  required
                />
                <small>Enter a unique truck number (e.g., BCG 15*8)</small>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Truck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Truck Modal */}
      {showEditModal && editingTruck && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Truck Number</h2>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <form onSubmit={handleEditTruck}>
              <div className="form-group">
                <label htmlFor="editTruckNo">Truck Number</label>
                <input
                  type="text"
                  id="editTruckNo"
                  name="truckNo"
                  defaultValue={editingTruck.truckNo}
                  placeholder="e.g., BCG 15*8"
                  autoFocus
                  required
                />
                <small>Enter a unique truck number (e.g., BCG 15*8)</small>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
