import { useState, useEffect, useRef } from 'react';
import { Account } from '../types';
import { getAllAccounts } from '../services/api';
import { supabase } from '../lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Schedules.css';

interface Schedule {
  id: string;
  collector_id: string;
  barangay_id: string;
  street_ids?: string[];
  days: string[]; // Array of day abbreviations: ['Mon', 'Tue', 'Wed', etc.]
  collection_time?: string; // Collection time in HH:MM format
  created_at: string;
  updated_at: string;
  latitude?: number[];
  longitude?: number[];
  truck_no?: string;
  barangay_name?: string[];
  street_name?: string[];
}

interface TemporaryRoute {
  id: string;
  barangay: string;
  barangayId?: string;
  street?: string;
  coordinates: Array<[number, number]>;
  polyline: L.Polyline;
  days: string[];
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to get week dates (responsive to current date)
const getWeekDates = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
  monday.setHours(0, 0, 0, 0);
  
  const week = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    date.setHours(0, 0, 0, 0);
    week.push({
      day: DAYS_OF_WEEK[i],
      date: date.getDate(),
      fullDate: new Date(date),
      month: date.toLocaleString('default', { month: 'long' }),
      year: date.getFullYear(),
      isToday: date.getTime() === today.getTime(),
      isPast: date < today
    });
  }
  return week;
};

// Get schedule type color
const getScheduleTypeColor = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    'Hazardous': '#ef4444', // red
    'General': '#6b7280', // grey
    'Organic': '#eab308', // yellow
    'Recyclable': '#3b82f6', // blue
  };
  return typeMap[type] || '#6b7280';
};

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

export default function Schedules() {
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collectionStatuses, setCollectionStatuses] = useState<CollectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editingDays, setEditingDays] = useState<string[]>([]);
  const [editingTime, setEditingTime] = useState<string>('08:00');
  const [showRouteEditModal, setShowRouteEditModal] = useState(false);
  
  // Route editing state
  const [routeMode, setRouteMode] = useState(false);
  const routeModeRef = useRef(false);
  const [routeStartPoint, setRouteStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeStartPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [routeEndPoint, setRouteEndPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeEndPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const [editingRouteCoordinates, setEditingRouteCoordinates] = useState<Array<[number, number]>>([]);
  const [editingRoutePolyline, setEditingRoutePolyline] = useState<L.Polyline | null>(null);
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const weekDates = getWeekDates();

  useEffect(() => {
    loadData();
    // Set selected date to today
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      initializeMap();
    }
    return () => {
      // Don't remove map on unmount, keep it for modals
    };
  }, []);

  // Re-initialize map when route edit modal opens
  useEffect(() => {
    if (showRouteEditModal && mapContainerRef.current) {
      if (!mapRef.current) {
        initializeMap();
      } else {
        // Invalidate size to ensure proper rendering
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      }
    }
  }, [showRouteEditModal]);

  const loadData = async () => {
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const weekAhead = new Date(today);
      weekAhead.setDate(today.getDate() + 7);
      
      const [accountsData, schedulesData, collectionStatusData] = await Promise.all([
        getAllAccounts(),
        supabase.from('collection_schedules').select('*').order('created_at', { ascending: false }),
        supabase
          .from('collection_status')
          .select('*')
          .gte('collectionDate', weekAgo.toISOString().split('T')[0])
          .lte('collectionDate', weekAhead.toISOString().split('T')[0])
      ]);

      const collectorAccounts = accountsData.filter(a => a.role === 'collector');
      setCollectors(collectorAccounts);

      if (schedulesData.data) {
        setSchedules(schedulesData.data as Schedule[]);
      }
      
      if (collectionStatusData.data) {
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
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapContainerRef.current) return;

    try {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [14.6760, 121.0437],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  // Get schedules for a specific day
  const getSchedulesForDay = (date: Date): Schedule[] => {
    if (!date) return [];
    
    const dayAbbr = DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1];
    return schedules.filter(schedule => schedule.days.includes(dayAbbr));
  };

  // Get route count for a day
  const getRouteCountForDay = (dayAbbr: string): number => {
    return schedules.filter(schedule => schedule.days.includes(dayAbbr)).length;
  };

  // Get schedule type (mock - you can enhance this based on your data)
  const getScheduleType = (schedule: Schedule): string => {
    // You can add logic here to determine type based on schedule data
    // For now, returning a default
    return 'General';
  };

  // Get schedule status based on collection status and date
  const getScheduleStatus = (schedule: Schedule, scheduleDate: Date): 'completed' | 'pending' | 'skipped' | 'in-progress' => {
    const collector = collectors.find(c => c.id === schedule.collector_id);
    const truckNo = schedule.truck_no || collector?.truckNo;
    const barangayName = Array.isArray(schedule.barangay_name) 
      ? schedule.barangay_name[0] 
      : schedule.barangay_name || '';
    const streetName = Array.isArray(schedule.street_name) 
      ? schedule.street_name[0] 
      : schedule.street_name || '';
    
    const dateStr = scheduleDate.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDateOnly = new Date(scheduleDate);
    scheduleDateOnly.setHours(0, 0, 0, 0);
    
    // Check if schedule date is in the past
    const isPastDate = scheduleDateOnly < today;
    
    // Find collection status for this schedule on this date using updated schema
    // Schema uses scheduleId + streetName + collectionDate as unique key
    const collectionStatus = collectionStatuses.find(cs => {
      const matchesSchedule = cs.scheduleId === schedule.id;
      const matchesDate = cs.collectionDate === dateStr;
      const matchesStreet = cs.streetName === streetName || 
                           (cs.streetId && schedule.street_ids && Array.isArray(schedule.street_ids) && 
                            schedule.street_ids.includes(cs.streetId));
      const matchesBarangay = cs.barangayName === barangayName;
      return matchesSchedule && matchesDate && matchesStreet && matchesBarangay;
    });
    
    if (collectionStatus) {
      if (collectionStatus.status === 'collected') {
        return 'completed';
      } else if (collectionStatus.status === 'skipped') {
        return 'skipped';
      } else if (collectionStatus.status === 'missed') {
        return 'skipped'; // Display missed as skipped in UI
      } else if (collectionStatus.status === 'pending') {
        return 'pending';
      }
    }
    
    // If date is past and no collection status (or status is not collected), mark as missed/skipped
    if (isPastDate) {
      return 'skipped';
    }
    
    return 'pending';
  };

  // Get schedule time
  const getScheduleTime = (schedule: Schedule): string => {
    return schedule.collection_time || '08:00';
  };

  // Handle day selection
  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Handle edit schedule
  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setEditingDays([...schedule.days]);
    setEditingTime(schedule.collection_time || '08:00');
    setShowEditModal(true);
  };

  // Handle save edited days and time
  const handleSaveDays = async () => {
    if (!editingSchedule || editingDays.length === 0) {
      alert('Please select at least one day');
      return;
    }

    if (!editingTime || !editingTime.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) {
      alert('Please enter a valid time in HH:MM format');
      return;
    }

    try {
      const { error } = await supabase
        .from('collection_schedules')
        .update({ 
          days: editingDays, 
          collection_time: editingTime,
          updated_at: new Date().toISOString() 
        })
        .eq('id', editingSchedule.id);

      if (error) throw error;

      alert('Schedule updated successfully!');
      setShowEditModal(false);
      setEditingSchedule(null);
      setEditingDays([]);
      setEditingTime('08:00');
      await loadData();
    } catch (error: any) {
      console.error('Failed to update schedule:', error);
      alert('Failed to update schedule');
    }
  };

  // Handle edit route
  const handleEditRoute = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowRouteEditModal(true);
    
    // Load existing route coordinates after modal opens
    setTimeout(() => {
      if (schedule.latitude && schedule.longitude && Array.isArray(schedule.latitude) && schedule.latitude.length > 1) {
        const routeCoordinates: [number, number][] = schedule.latitude.map((lat, index) => {
          const lng = schedule.longitude?.[index];
          return [lat, lng] as [number, number];
        }).filter(coord => coord[0] !== undefined && coord[1] !== undefined);
        
        setEditingRouteCoordinates(routeCoordinates);
        
        // Draw existing route on map
        if (mapRef.current && routeCoordinates.length > 1) {
          // Clear existing polyline
          if (editingRoutePolyline && mapRef.current.hasLayer(editingRoutePolyline)) {
            mapRef.current.removeLayer(editingRoutePolyline);
          }
          
          const polyline = L.polyline(routeCoordinates, {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.7
          }).addTo(mapRef.current);
          
          setEditingRoutePolyline(polyline);
          
          // Center map on route
          const bounds = L.latLngBounds(routeCoordinates);
          mapRef.current.fitBounds(bounds);
        }
      }
    }, 200);
  };

  // Start route editing mode
  const startRouteEditMode = () => {
    routeModeRef.current = true;
    setRouteMode(true);
    routeStartPointRef.current = null;
    routeEndPointRef.current = null;
    setRouteStartPoint(null);
    setRouteEndPoint(null);
    
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = 'crosshair';
    }
  };

  // Cancel route editing
  const cancelRouteEditMode = () => {
    routeModeRef.current = false;
    setRouteMode(false);
    
    if (startMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    
    routeStartPointRef.current = null;
    routeEndPointRef.current = null;
    setRouteStartPoint(null);
    setRouteEndPoint(null);
    
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = '';
    }
  };

  // Fetch route from OSRM
  const fetchOSRMRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<Array<[number, number]> | null> => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        return coordinates;
      }
      
      return null;
    } catch (error) {
      console.error('OSRM route fetch error:', error);
      return null;
    }
  };

  // Setup map click handler for route editing
  useEffect(() => {
    if (!mapRef.current || !showRouteEditModal) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!routeModeRef.current) return;
      
      const { lat, lng } = e.latlng;
      
      const startIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      
      const endIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      
      if (!routeStartPointRef.current) {
        const startPoint = { lat, lng };
        routeStartPointRef.current = startPoint;
        setRouteStartPoint(startPoint);
        
        if (startMarkerRef.current && mapRef.current) {
          mapRef.current.removeLayer(startMarkerRef.current);
        }
        
        const marker = L.marker([lat, lng], { icon: startIcon })
          .addTo(mapRef.current!)
          .bindPopup('Start Point')
          .openPopup();
        
        startMarkerRef.current = marker;
        
      } else if (!routeEndPointRef.current) {
        const endPoint = { lat, lng };
        routeEndPointRef.current = endPoint;
        setRouteEndPoint(endPoint);
        
        if (endMarkerRef.current && mapRef.current) {
          mapRef.current.removeLayer(endMarkerRef.current);
        }
        
        const marker = L.marker([lat, lng], { icon: endIcon })
          .addTo(mapRef.current!)
          .bindPopup('End Point')
          .openPopup();
        
        endMarkerRef.current = marker;
        
        const start = routeStartPointRef.current;
        const routeCoordinates = await fetchOSRMRoute(
          start.lat,
          start.lng,
          lat,
          lng
        );
        
        if (routeCoordinates && routeCoordinates.length > 0) {
          // Remove old polyline
          if (editingRoutePolyline && mapRef.current) {
            mapRef.current.removeLayer(editingRoutePolyline);
          }
          
          const polyline = L.polyline(routeCoordinates, {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.7
          }).addTo(mapRef.current!);
          
          setEditingRoutePolyline(polyline);
          setEditingRouteCoordinates(routeCoordinates);
          
          cancelRouteEditMode();
        } else {
          alert('Failed to fetch route. Please try clicking the points again.');
          cancelRouteEditMode();
        }
      }
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [showRouteEditModal, routeMode, editingRoutePolyline]);

  // Handle save edited route
  const handleSaveRoute = async () => {
    if (!editingSchedule || editingRouteCoordinates.length === 0) {
      alert('Please create a route first');
      return;
    }

    try {
      const latitudes = editingRouteCoordinates.map(coord => coord[0]);
      const longitudes = editingRouteCoordinates.map(coord => coord[1]);

      const { error } = await supabase
        .from('collection_schedules')
        .update({
          latitude: latitudes,
          longitude: longitudes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSchedule.id);

      if (error) throw error;

      alert('Route updated successfully!');
      setShowRouteEditModal(false);
      setEditingSchedule(null);
      setEditingRouteCoordinates([]);
      if (editingRoutePolyline && mapRef.current) {
        mapRef.current.removeLayer(editingRoutePolyline);
      }
      setEditingRoutePolyline(null);
      cancelRouteEditMode();
      await loadData();
    } catch (error: any) {
      console.error('Failed to update route:', error);
      alert('Failed to update route');
    }
  };

  // Handle delete schedule
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const { error } = await supabase
        .from('collection_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Schedule deleted successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  if (loading) {
    return <div className="loading">Loading schedules...</div>;
  }

  const selectedSchedules = selectedDate ? getSchedulesForDay(selectedDate) : [];
  const selectedDateObj = selectedDate ? weekDates.find(w => 
    w.fullDate.getDate() === selectedDate.getDate() &&
    w.fullDate.getMonth() === selectedDate.getMonth() &&
    w.fullDate.getFullYear() === selectedDate.getFullYear()
  ) : null;

  return (
    <div className="schedules-page">
      <div className="page-header">
        <h1>Collection Schedules</h1>
      </div>

      {/* This Week's Schedule */}
      <div className="weekly-schedule-section">
        <h2>This Week's Schedule</h2>
        <div className="week-days">
          {weekDates.map((weekDay) => {
            const isSelected = selectedDate && 
              weekDay.fullDate.getDate() === selectedDate.getDate() &&
              weekDay.fullDate.getMonth() === selectedDate.getMonth() &&
              weekDay.fullDate.getFullYear() === selectedDate.getFullYear();
            const routeCount = getRouteCountForDay(weekDay.day);
            
            return (
              <div
                key={weekDay.day}
                className={`day-card ${isSelected ? 'selected' : ''} ${(weekDay as any).isToday ? 'today' : ''} ${(weekDay as any).isPast ? 'past' : ''}`}
                onClick={() => handleDaySelect(weekDay.fullDate)}
              >
                <div className="day-name">{weekDay.day}</div>
                <div className="day-date">{weekDay.date}</div>
                <div className="day-routes">{routeCount} route{routeCount !== 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Schedules */}
      {selectedDate && selectedDateObj && (
        <div className="date-schedules-section">
          <h3>
            <span className="calendar-icon">📅</span>
            {selectedDateObj.month} {selectedDateObj.date}, {selectedDateObj.year}
          </h3>
          <div className="schedule-entries">
            {selectedSchedules.length === 0 ? (
              <div className="empty-state">No schedules for this day</div>
            ) : (
              selectedSchedules.map((schedule) => {
                const collector = collectors.find(c => c.id === schedule.collector_id);
                const barangayName = Array.isArray(schedule.barangay_name) 
                  ? schedule.barangay_name[0] 
                  : schedule.barangay_name || 'Unknown';
                const streetName = Array.isArray(schedule.street_name) 
                  ? schedule.street_name[0] 
                  : schedule.street_name || '';
                const type = getScheduleType(schedule);
                const status = getScheduleStatus(schedule, selectedDate!);
                const time = getScheduleTime(schedule);
                const color = getScheduleTypeColor(type);

                return (
                  <div key={schedule.id} className="schedule-entry">
                    <div className="schedule-bar" style={{ backgroundColor: color }} />
                    <div className="schedule-content">
                      <div className="schedule-main">
                        <h4>{barangayName}</h4>
                        <div className="schedule-details">
                          <span className="location-icon">📍</span>
                          <span>{streetName || 'Zone'}</span>
                          <span className="time-icon">🕐</span>
                          <span>{time}</span>
                        </div>
                        <div className="schedule-tags">
                          <span className="type-tag">{type}</span>
                        </div>
                      </div>
                      <div className="schedule-actions">
                        {status === 'completed' ? (
                          <div className="status-completed">
                            <span className="check-icon">✓</span>
                            <span>completed</span>
                          </div>
                        ) : status === 'skipped' ? (
                          <div className="status-skipped">
                            <span className="warning-icon">⚠</span>
                            <span>missed</span>
                          </div>
                        ) : status === 'in-progress' ? (
                          <div className="status-in-progress">
                            <span className="clock-icon">🕐</span>
                            <span>in progress</span>
                          </div>
                        ) : (
                          <div className="status-pending">
                            <span className="clock-icon">🕐</span>
                            <span>pending</span>
                          </div>
                        )}
                        <button 
                          className="btn btn-edit"
                          onClick={() => handleEditSchedule(schedule)}
                          title="Edit Days"
                        >
                          Edit Days
                        </button>
                        <button 
                          className="btn btn-edit"
                          onClick={() => handleEditRoute(schedule)}
                          title="Edit Route"
                          style={{ background: '#10b981' }}
                        >
                          Edit Route
                        </button>
                        <button 
                          className="btn btn-delete"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Days Modal */}
      {showEditModal && editingSchedule && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Schedule</h2>
              <button className="modal-close" onClick={() => {
                setShowEditModal(false);
                setEditingSchedule(null);
                setEditingDays([]);
                setEditingTime('08:00');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Days *</label>
                <div className="days-grid">
                  {DAYS_OF_WEEK.map(day => {
                    const isChecked = editingDays.includes(day);
                    return (
                      <label 
                        key={day} 
                        className="day-checkbox"
                        style={{
                          border: `2px solid ${isChecked ? '#3b82f6' : '#e5e7eb'}`,
                          background: isChecked ? '#eef2ff' : 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditingDays(prev => prev.filter(d => d !== day));
                            } else {
                              setEditingDays(prev => [...prev, day]);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <span style={{ 
                          color: isChecked ? '#3b82f6' : '#374151',
                          fontWeight: isChecked ? 600 : 400,
                        }}>
                          {day}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>Collection Time *</label>
                <input
                  type="time"
                  value={editingTime}
                  onChange={(e) => setEditingTime(e.target.value)}
                  className="form-input"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                  }}
                />
                <small style={{ display: 'block', marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Select the time when collection should start
                </small>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                    setEditingDays([]);
                    setEditingTime('08:00');
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveDays}
                >
                  Save Days
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {showRouteEditModal && editingSchedule && (
        <div className="modal-overlay-large" onClick={() => setShowRouteEditModal(false)}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Route</h2>
              <button className="modal-close" onClick={() => setShowRouteEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Route Creation</label>
                {!routeMode ? (
                  <button
                    type="button"
                    onClick={startRouteEditMode}
                    className="btn btn-secondary"
                    style={{ width: '100%', marginBottom: '1rem' }}
                  >
                    🛣️ Start Route Editing
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={cancelRouteEditMode}
                      className="btn btn-warning"
                      style={{ width: '100%', marginBottom: '1rem' }}
                    >
                      Cancel Route Editing
                    </button>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#fef3c7', 
                      border: '1px solid #fbbf24',
                      borderRadius: '0.375rem',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      color: '#92400e'
                    }}>
                      {!routeStartPoint ? (
                        'Click on the map to set the START point of the route'
                      ) : !routeEndPoint ? (
                        'Click on the map to set the END point of the route'
                      ) : (
                        'Route fetched! Click "Save Route" to update.'
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="map-section">
                <div ref={mapContainerRef} className="schedule-map" style={{ height: '400px', width: '100%' }}></div>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowRouteEditModal(false);
                    cancelRouteEditMode();
                    if (editingRoutePolyline && mapRef.current) {
                      mapRef.current.removeLayer(editingRoutePolyline);
                    }
                    setEditingRoutePolyline(null);
                    setEditingRouteCoordinates([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveRoute}
                >
                  Save Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
