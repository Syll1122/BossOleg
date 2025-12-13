import { useState, useEffect } from 'react';
import { TruckStatus } from '../types';
import { getAllTruckStatuses, updateTruckStatus } from '../services/api';
import './Trucks.css';

export default function Trucks() {
  const [trucks, setTrucks] = useState<TruckStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrucks();
    const interval = setInterval(loadTrucks, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTrucks = async () => {
    try {
      const data = await getAllTruckStatuses();
      setTrucks(data);
    } catch (error) {
      console.error('Failed to load trucks:', error);
      alert('Failed to load truck statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCollecting = async (truck: TruckStatus) => {
    try {
      await updateTruckStatus(truck.id, { isCollecting: !truck.isCollecting });
      setTrucks(trucks.map(t => 
        t.id === truck.id ? { ...t, isCollecting: !t.isCollecting } : t
      ));
    } catch (error) {
      console.error('Failed to update truck:', error);
      alert('Failed to update truck status');
    }
  };

  const handleToggleFull = async (truck: TruckStatus) => {
    try {
      await updateTruckStatus(truck.id, { isFull: !truck.isFull });
      setTrucks(trucks.map(t => 
        t.id === truck.id ? { ...t, isFull: !t.isFull } : t
      ));
    } catch (error) {
      console.error('Failed to update truck:', error);
      alert('Failed to update truck status');
    }
  };

  if (loading) {
    return <div className="loading">Loading trucks...</div>;
  }

  return (
    <div className="trucks-page">
      <div className="page-header">
        <h1>Truck Status Monitoring</h1>
        <p>Real-time status of waste collection trucks</p>
      </div>

      <div className="trucks-grid">
        {trucks.length === 0 ? (
          <div className="empty-state">No trucks found in the system</div>
        ) : (
          trucks.map((truck) => (
            <div key={truck.id} className="truck-card">
              <div className="truck-header">
                <h3>Truck {truck.id}</h3>
                <div className="truck-badges">
                  {truck.isCollecting && (
                    <span className="badge badge-success">Collecting</span>
                  )}
                  {truck.isFull && (
                    <span className="badge badge-warning">Full</span>
                  )}
                </div>
              </div>

              <div className="truck-info">
                {truck.latitude && truck.longitude ? (
                  <div className="truck-location">
                    <strong>📍 Location:</strong>
                    <div className="coordinates">
                      <div>Lat: {truck.latitude.toFixed(6)}</div>
                      <div>Lng: {truck.longitude.toFixed(6)}</div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${truck.latitude},${truck.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="map-link"
                    >
                      View on Map
                    </a>
                  </div>
                ) : (
                  <div className="truck-location">
                    <strong>📍 Location:</strong> Not available
                  </div>
                )}

                <div className="truck-meta">
                  <div>
                    <strong>Last Updated:</strong>
                    <div>{new Date(truck.updatedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <strong>Updated By:</strong>
                    <div>{truck.updatedBy}</div>
                  </div>
                </div>
              </div>

              <div className="truck-actions">
                <button
                  className={`btn btn-small ${truck.isCollecting ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => handleToggleCollecting(truck)}
                >
                  {truck.isCollecting ? 'Stop Collecting' : 'Start Collecting'}
                </button>
                <button
                  className={`btn btn-small ${truck.isFull ? 'btn-success' : 'btn-warning'}`}
                  onClick={() => handleToggleFull(truck)}
                >
                  {truck.isFull ? 'Mark as Not Full' : 'Mark as Full'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


