import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTrucks, createTruck, updateTruck, deleteTruck, Truck, getAllAccounts, getAllTruckStatuses, TruckStatus } from '../services/api';
import { supabase } from '../lib/supabase';
import { Account } from '../types';
import CreateScheduleModal from '../components/CreateScheduleModal';
import './Trucks.css';

interface Schedule {
  id: string;
  collector_id: string;
  barangay_id: string;
  days: string[];
  created_at: string;
  updated_at: string;
  latitude?: number[];
  longitude?: number[];
  truck_no?: string;
  barangay_name?: string[];
  street_name?: string[];
  collection_time?: string;
}

interface CollectionStatus {
  id: string;
  scheduleId: string;
  collectorId: string;
  streetName: string;
  streetId?: string | null;
  barangayName: string;
  status: 'pending' | 'collected' | 'skipped' | 'missed';
  collectionDate: string;
  updatedAt: string;
}

type RouteFilter = 'all' | 'active' | 'scheduled' | 'completed';

export default function Trucks() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [collectionStatuses, setCollectionStatuses] = useState<CollectionStatus[]>([]);
  const [truckStatuses, setTruckStatuses] = useState<TruckStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  const [showNewRouteModal, setShowNewRouteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [newTruckNo, setNewTruckNo] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<RouteFilter>('all');

  useEffect(() => {
    loadData();
    
    // Refresh truck locations every 30 seconds for real-time updates
    const interval = setInterval(() => {
      getAllTruckStatuses().then(data => {
        setTruckStatuses(data);
      }).catch(err => {
        console.error('Failed to refresh truck statuses:', err);
      });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Get current week date range (Monday to Sunday)
  const getCurrentWeekRange = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const weekRange = getCurrentWeekRange();
      
      const [trucksData, accountsData, schedulesData, collectionStatusData, truckStatusData] = await Promise.all([
        getAllTrucks(),
        getAllAccounts(),
        supabase.from('collection_schedules').select('*').order('created_at', { ascending: false }),
        supabase
          .from('collection_status')
          .select('*')
          .gte('collectionDate', weekRange.start)
          .lte('collectionDate', weekRange.end),
        getAllTruckStatuses()
      ]);

      setTrucks(trucksData);
      setCollectors(accountsData.filter(a => a.role === 'collector'));
      
      if (schedulesData.data) {
        setSchedules(schedulesData.data as Schedule[]);
      }
      
      if (collectionStatusData.data) {
        // Map the data to use updated schema (streetName, barangayName, scheduleId)
        const mappedStatuses = collectionStatusData.data.map((status: any) => ({
          id: status.id,
          scheduleId: status.scheduleId || status.schedule_id,
          collectorId: status.collectorId || status.collector_id,
          streetName: status.streetName || status.street_name || status.street || '',
          streetId: status.streetId || status.street_id || null,
          barangayName: status.barangayName || status.barangay_name || status.barangay || '',
          status: status.status || 'pending',
          collectionDate: status.collectionDate || status.collection_date,
          updatedAt: status.updatedAt || status.updated_at
        }));
        setCollectionStatuses(mappedStatuses as CollectionStatus[]);
      }
      
      setTruckStatuses(truckStatusData);
      
      setError('');
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError('Failed to load data. Please try again.');
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
      setShowAddTruckModal(false);
      await loadData();
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
      await loadData();
    } catch (error: any) {
      setError(error.message || 'Failed to update truck number');
    }
  };

  const handleToggleActive = async (truck: Truck) => {
    try {
      await updateTruck(truck.id, { isActive: !truck.isActive });
      await loadData();
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
      await loadData();
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

  const openAddTruckModal = () => {
    setNewTruckNo('');
    setError('');
    setShowAddTruckModal(true);
  };

  const closeAddTruckModal = () => {
    setNewTruckNo('');
    setError('');
    setShowAddTruckModal(false);
  };

  const handleScheduleCreated = () => {
    setShowNewRouteModal(false);
    loadData();
  };

  // Calculate stats
  const activeRoutes = schedules.filter(s => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    return s.days.includes(today);
  }).length;

  const totalRoutes = schedules.length;

  // Calculate scheduled collections for the current week
  const calculateScheduledCollections = (): number => {
    const weekRange = getCurrentWeekRange();
    const startDate = new Date(weekRange.start);
    const endDate = new Date(weekRange.end);
    
    const dayMap: { [key: string]: number } = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    
    let scheduledCount = 0;
    
    schedules.forEach(schedule => {
      if (!schedule.days || schedule.days.length === 0) return;
      
      schedule.days.forEach(day => {
        const dayOfWeek = dayMap[day];
        if (dayOfWeek === undefined) return;
        
        // Count occurrences of this day in the current week
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === dayOfWeek) {
            scheduledCount++;
          }
        }
      });
    });
    
    return scheduledCount;
  };

  // Calculate done collections for the current week
  const doneCollections = collectionStatuses.filter(cs => cs.status === 'collected').length;
  
  // Calculate scheduled collections for the week
  const scheduledCollections = calculateScheduledCollections();
  
  // Calculate completion rate
  const completionRate = scheduledCollections > 0 
    ? Math.round((doneCollections / scheduledCollections) * 100) 
    : 0;

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate progress along route based on truck's GPS location
  // PROXIMITY_THRESHOLD: Maximum distance (in km) from route line to consider truck "on route"
  const PROXIMITY_THRESHOLD = 0.1; // 100 meters = 0.1 km

  const calculateRouteProgress = (schedule: Schedule): { progress: number; completedStops: number; totalStops: number; isOnRoute: boolean; distanceFromRoute: number } => {
    // Get truck status for this schedule's truck
    const truckNo = schedule.truck_no;
    if (!truckNo) {
      return { progress: 0, completedStops: 0, totalStops: 0, isOnRoute: false, distanceFromRoute: Infinity };
    }

    // Find the truck status for this truck
    // First try to find collector by schedule's collector_id, then match by truck number
    const collector = collectors.find(c => c.id === schedule.collector_id);
    const collectorTruckNo = collector?.truckNo;
    
    const truckStatus = truckStatuses.find(ts => {
      // Match by truck number or collector ID
      if (collectorTruckNo && (ts.id === collectorTruckNo || (ts as any).truckNo === collectorTruckNo)) {
        return true;
      }
      if (truckNo && (ts.id === truckNo || (ts as any).truckNo === truckNo)) {
        return true;
      }
      // Also try matching by collector ID (updatedBy field)
      if (schedule.collector_id && ts.updatedBy === schedule.collector_id) {
        return true;
      }
      return false;
    });

    // If truck is not collecting or has no GPS data, return 0
    if (!truckStatus || !truckStatus.isCollecting || !truckStatus.latitude || !truckStatus.longitude) {
      return { progress: 0, completedStops: 0, totalStops: 0, isOnRoute: false, distanceFromRoute: Infinity };
    }

    // Get route coordinates
    const routeLatitudes = schedule.latitude || [];
    const routeLongitudes = schedule.longitude || [];

    if (routeLatitudes.length === 0 || routeLongitudes.length === 0) {
      return { progress: 0, completedStops: 0, totalStops: 0 };
    }

    // Build route points array
    const routePoints: Array<[number, number]> = [];
    const maxLength = Math.max(routeLatitudes.length, routeLongitudes.length);
    for (let i = 0; i < maxLength; i++) {
      const lat = routeLatitudes[i];
      const lng = routeLongitudes[i];
      if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        routePoints.push([lat, lng]);
      }
    }

    if (routePoints.length < 2) {
      return { progress: 0, completedStops: 0, totalStops: routePoints.length };
    }

    // Find the closest point on the route to the truck's current position
    let minDistance = Infinity;
    let closestSegmentIndex = 0;
    let closestPointOnSegment: [number, number] | null = null;

    const truckLat = truckStatus.latitude;
    const truckLng = truckStatus.longitude;

    // Check each segment of the route
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];

      // Calculate distance from truck to line segment
      const A = truckLat - p1[0];
      const B = truckLng - p1[1];
      const C = p2[0] - p1[0];
      const D = p2[1] - p1[1];

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = lenSq !== 0 ? dot / lenSq : -1;

      // Clamp param to [0, 1] to get point on segment
      param = Math.max(0, Math.min(1, param));

      const xx = p1[0] + param * C;
      const yy = p1[1] + param * D;

      const distance = calculateDistance(truckLat, truckLng, xx, yy);

      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
        closestPointOnSegment = [xx, yy];
      }
    }

    if (!closestPointOnSegment) {
      return { progress: 0, completedStops: 0, totalStops: routePoints.length, isOnRoute: false, distanceFromRoute: Infinity };
    }

    // Check if truck is within proximity threshold of the route
    const distanceFromRoute = minDistance; // in kilometers
    const isOnRoute = distanceFromRoute <= PROXIMITY_THRESHOLD;

    // If truck is not on route, return 0 progress but include distance info
    if (!isOnRoute) {
      return { 
        progress: 0, 
        completedStops: 0, 
        totalStops: routePoints.length, 
        isOnRoute: false, 
        distanceFromRoute: distanceFromRoute * 1000 // Convert to meters
      };
    }

    // Calculate total route length
    let totalRouteLength = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      totalRouteLength += calculateDistance(
        routePoints[i][0],
        routePoints[i][1],
        routePoints[i + 1][0],
        routePoints[i + 1][1]
      );
    }

    if (totalRouteLength === 0) {
      return { progress: 0, completedStops: 0, totalStops: routePoints.length, isOnRoute: true, distanceFromRoute: 0 };
    }

    // Calculate distance traveled along route (from start to closest point)
    let distanceTraveled = 0;
    for (let i = 0; i < closestSegmentIndex; i++) {
      distanceTraveled += calculateDistance(
        routePoints[i][0],
        routePoints[i][1],
        routePoints[i + 1][0],
        routePoints[i + 1][1]
      );
    }

    // Add distance along the current segment
    if (closestSegmentIndex < routePoints.length - 1) {
      distanceTraveled += calculateDistance(
        routePoints[closestSegmentIndex][0],
        routePoints[closestSegmentIndex][1],
        closestPointOnSegment[0],
        closestPointOnSegment[1]
      );
    }

    // Calculate progress percentage
    const progress = Math.min(100, Math.max(0, Math.round((distanceTraveled / totalRouteLength) * 100)));

    // Estimate stops based on progress (assuming stops are evenly distributed)
    const totalStops = routePoints.length;
    const completedStops = Math.round((progress / 100) * totalStops);

    return { 
      progress, 
      completedStops, 
      totalStops, 
      isOnRoute: true, 
      distanceFromRoute: distanceFromRoute * 1000 // Convert to meters
    };
  };

  // Filter routes
  const filteredRoutes = schedules.filter(schedule => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      return schedule.days.includes(today);
    }
    if (filter === 'scheduled') {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      return !schedule.days.includes(today);
    }
    if (filter === 'completed') {
      // This would check collection status
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="trucks-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="trucks-page">
      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">🚛</div>
          <div className="stat-content">
            <div className="stat-value">{activeRoutes}</div>
            <div className="stat-label">Active Routes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✈️</div>
          <div className="stat-content">
            <div className="stat-value">{totalRoutes}</div>
            <div className="stat-label">Total Routes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">{doneCollections}</div>
            <div className="stat-label">Done Collection</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-value">{completionRate}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
        </div>
      </div>

      {/* Collection Routes Section */}
      <div className="routes-section">
        <div className="routes-header">
          <h2>Collection Routes</h2>
          <div className="routes-actions">
            <button className="btn btn-secondary" onClick={openAddTruckModal}>
              ➕ New Truck
            </button>
            <button className="btn btn-primary" onClick={() => setShowNewRouteModal(true)}>
              ➕ New Route
            </button>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'scheduled' ? 'active' : ''}`}
            onClick={() => setFilter('scheduled')}
          >
            Scheduled
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>

        {/* Routes List */}
        <div className="routes-list">
          {filteredRoutes.length === 0 ? (
            <div className="empty-state">No routes found</div>
          ) : (
            filteredRoutes.map((schedule) => {
              const collector = collectors.find(c => c.id === schedule.collector_id);
              const collectorName = collector?.name || 'Unknown';
              const truckNo = schedule.truck_no || collector?.truckNo || 'N/A';
              const barangayName = Array.isArray(schedule.barangay_name) 
                ? schedule.barangay_name[0] 
                : schedule.barangay_name || 'Unknown';
              const streetName = Array.isArray(schedule.street_name) 
                ? schedule.street_name.join(', ') 
                : schedule.street_name || '';
              
              const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
              const isActive = schedule.days.includes(today);
              
              // Check if route is completed using updated schema (scheduleId + streetName + collectionDate)
              const todayDate = new Date().toISOString().split('T')[0];
              const streetNameFirst = Array.isArray(schedule.street_name) 
                ? schedule.street_name[0] 
                : schedule.street_name || '';
              const barangayNameFirst = Array.isArray(schedule.barangay_name) 
                ? schedule.barangay_name[0] 
                : schedule.barangay_name || '';
              
              const routeCollections = collectionStatuses.filter(cs => {
                const matchesSchedule = cs.scheduleId === schedule.id;
                const matchesDate = cs.collectionDate === todayDate;
                const matchesStreet = cs.streetName === streetNameFirst || 
                                     (cs.streetId && schedule.street_ids && Array.isArray(schedule.street_ids) && 
                                      schedule.street_ids.includes(cs.streetId));
                const matchesBarangay = cs.barangayName === barangayNameFirst;
                return matchesSchedule && matchesDate && matchesStreet && matchesBarangay;
              });
              
              const isCompleted = routeCollections.length > 0 && 
                routeCollections.every(cs => cs.status === 'collected');

              // Calculate real-time progress based on truck GPS location
              const { progress, completedStops, totalStops, isOnRoute, distanceFromRoute } = calculateRouteProgress(schedule);
              
              // Use collection status if available, otherwise use GPS-based progress
              // If route has coordinates, use GPS-based progress; otherwise use collection status
              const hasRouteCoordinates = schedule.latitude && schedule.latitude.length > 0 && 
                                         schedule.longitude && schedule.longitude.length > 0;
              
              let actualProgress = 0;
              let actualCompletedStops = 0;
              let actualTotalStops = totalStops || 1;
              let showProgressBar = false;
              
              if (isCompleted) {
                actualProgress = 100;
                actualCompletedStops = actualTotalStops;
                showProgressBar = true;
              } else if (hasRouteCoordinates && totalStops > 0) {
                // Only show GPS-based progress if truck is on route (within proximity threshold)
                if (isOnRoute) {
                  actualProgress = progress;
                  actualCompletedStops = completedStops;
                  actualTotalStops = totalStops;
                  showProgressBar = true;
                } else {
                  // Truck is not on route - show distance from route instead
                  actualProgress = 0;
                  actualCompletedStops = 0;
                  actualTotalStops = totalStops;
                  showProgressBar = false;
                }
              } else {
                // Fallback: estimate based on collection status
                const doneCount = routeCollections.filter(cs => cs.status === 'collected').length;
                actualTotalStops = Math.max(1, routeCollections.length || 1);
                actualCompletedStops = doneCount;
                actualProgress = actualTotalStops > 0 ? Math.round((doneCount / actualTotalStops) * 100) : 0;
                showProgressBar = actualProgress > 0;
              }

              return (
                <div key={schedule.id} className="route-card">
                  <div className="route-header">
                    <h3>{barangayName} {streetName ? `- ${streetName}` : ''}</h3>
                    <div className="route-badges">
                      {isActive && <span className="badge badge-active">active</span>}
                      {isCompleted && <span className="badge badge-completed">completed</span>}
                      <span className="badge badge-type">General</span>
                    </div>
                  </div>
                  <div className="route-details">
                    <div className="route-info">
                      <span>{collectorName}</span>
                      <span>•</span>
                      <span>{truckNo}</span>
                      <span>•</span>
                      <span>Start: {schedule.collection_time || '08:00'}</span>
                      {schedule.days && schedule.days.length > 0 && (
                        <>
                          <span>•</span>
                          <span>Days: {schedule.days.join(', ')}</span>
                        </>
                      )}
                      {!isCompleted && <span>• Est. 1h 45m remaining</span>}
                    </div>
                  </div>
                  <div className="route-progress">
                    <div className="progress-header">
                      <span>
                        {showProgressBar ? (
                          <>Progress: {actualCompletedStops} of {actualTotalStops} stops</>
                        ) : hasRouteCoordinates && !isOnRoute && distanceFromRoute !== Infinity ? (
                          <>Truck is {Math.round(distanceFromRoute)}m from route</>
                        ) : (
                          <>Progress: {actualCompletedStops} of {actualTotalStops} stops</>
                        )}
                      </span>
                      {showProgressBar && <span>{actualProgress}%</span>}
                    </div>
                    {showProgressBar && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${actualProgress}%` }}
                        />
                      </div>
                    )}
                    {!showProgressBar && hasRouteCoordinates && !isOnRoute && distanceFromRoute !== Infinity && (
                      <div className="progress-bar" style={{ background: '#fee2e2' }}>
                        <div className="progress-fill" style={{ width: '0%', background: '#ef4444' }} />
                      </div>
                    )}
                  </div>
                  {!isCompleted && (
                    <button 
                      className="btn btn-secondary btn-small track-btn"
                      onClick={() => navigate(`/dashboard?routeId=${schedule.id}`)}
                    >
                      Track Live
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Truck Modal */}
      {showAddTruckModal && (
        <div className="modal-overlay" onClick={closeAddTruckModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Truck Number</h2>
              <button className="modal-close" onClick={closeAddTruckModal}>×</button>
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
                <button type="button" className="btn btn-secondary" onClick={closeAddTruckModal}>
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

      {/* New Route Modal */}
      {showNewRouteModal && (
        <CreateScheduleModal
          isOpen={showNewRouteModal}
          onClose={() => setShowNewRouteModal(false)}
          onScheduleCreated={handleScheduleCreated}
        />
      )}
    </div>
  );
}
