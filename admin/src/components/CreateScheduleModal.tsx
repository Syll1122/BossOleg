import { useState, useEffect, useRef } from 'react';
import { Account } from '../types';
import { getAllAccounts } from '../services/api';
import { supabase } from '../lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './CreateScheduleModal.css';

interface Schedule {
  id: string;
  collector_id: string;
  barangay_id: string;
  street_ids?: string[];
  days: string[];
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
  time?: string; // Collection time in HH:MM format
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleCreated: () => void;
}

export default function CreateScheduleModal({ isOpen, onClose, onScheduleCreated }: CreateScheduleModalProps) {
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCollector, setSelectedCollector] = useState<string>('');
  const [routeMode, setRouteMode] = useState(false);
  const routeModeRef = useRef(false);
  const [routeStartPoint, setRouteStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeStartPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [routeEndPoint, setRouteEndPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeEndPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  
  const [temporaryRoutes, setTemporaryRoutes] = useState<TemporaryRoute[]>([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{
    coordinates: Array<[number, number]>;
    startPoint: { lat: number; lng: number };
    endPoint: { lat: number; lng: number };
    polyline: L.Polyline;
  } | null>(null);
  const [routeModalDays, setRouteModalDays] = useState<string[]>([]);
  const [routeModalTime, setRouteModalTime] = useState<string>('08:00');
  
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    place_id: number;
  }>>([]);
  const [showLocationSearchDropdown, setShowLocationSearchDropdown] = useState(false);
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string; latitude?: number; longitude?: number }>>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadBarangays();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Delay map initialization to ensure container is rendered
      const timer = setTimeout(() => {
        if (mapContainerRef.current && !mapRef.current) {
          initializeMap();
        } else if (mapRef.current) {
          // Invalidate size if map already exists
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          }, 100);
        }
      }, 100);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      // Clean up map when modal closes
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsData, schedulesData] = await Promise.all([
        getAllAccounts(),
        supabase.from('collection_schedules').select('*').order('created_at', { ascending: false })
      ]);

      const collectorAccounts = accountsData.filter(a => a.role === 'collector');
      setCollectors(collectorAccounts);

      if (schedulesData.data) {
        setSchedules(schedulesData.data as Schedule[]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBarangays = async () => {
    try {
      let { data, error } = await supabase
        .from('barangays')
        .select('id, name, latitude, longitude')
        .order('name', { ascending: true });

      if (error) {
        const result = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });
        data = result.data as any;
      }

      if (data) {
        setBarangays(data.map((bg: any) => ({
          id: bg.id,
          name: bg.name,
          latitude: bg.latitude || undefined,
          longitude: bg.longitude || undefined,
        })));
      }
    } catch (error) {
      console.error('Error loading barangays:', error);
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

      mapRef.current.on('click', async (e: L.LeafletMouseEvent) => {
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
            const polyline = L.polyline(routeCoordinates as [number, number][], {
              color: '#3b82f6',
              weight: 6,
              opacity: 0.7
            }).addTo(mapRef.current!);
            
            setPendingRoute({
              coordinates: routeCoordinates as [number, number][],
              startPoint: start,
              endPoint: endPoint,
              polyline
            });
            
            setShowRouteModal(true);
          } else {
            alert('Failed to fetch route. Please try clicking the points again.');
            resetRoutePoints();
          }
        }
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

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'WasteCollectionApp/1.0'
          }
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=ph`,
        {
          headers: {
            'User-Agent': 'WasteCollectionApp/1.0'
          }
        }
      );
      const data = await response.json();
      setLocationSearchResults(data);
      setShowLocationSearchDropdown(data.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
    }
  };

  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationSearch(value);
    searchLocations(value);
  };

  const handleLocationSelect = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    if (!isNaN(lat) && !isNaN(lng) && mapRef.current) {
      mapRef.current.setView([lat, lng], 15);
      setLocationSearch('');
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
    }
  };

  const startRouteMode = () => {
    routeModeRef.current = true;
    setRouteMode(true);
    resetRoutePoints();
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = 'crosshair';
    }
  };

  const cancelRouteMode = () => {
    routeModeRef.current = false;
    setRouteMode(false);
    resetRoutePoints();
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = '';
    }
  };

  const resetRoutePoints = () => {
    if (startMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    if (pendingRoute && mapRef.current) {
      if (mapRef.current.hasLayer(pendingRoute.polyline)) {
        mapRef.current.removeLayer(pendingRoute.polyline);
      }
      setPendingRoute(null);
    }
    routeStartPointRef.current = null;
    routeEndPointRef.current = null;
    setRouteStartPoint(null);
    setRouteEndPoint(null);
  };

  const handleSaveRouteFromModal = () => {
    if (!pendingRoute || routeModalDays.length === 0) {
      alert('Please select at least one collection day');
      return;
    }

    if (!routeModalTime || !routeModalTime.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) {
      alert('Please enter a valid time in HH:MM format');
      return;
    }

    if (!selectedCollector) {
      alert('Please select a collector first');
      return;
    }

    reverseGeocode(pendingRoute.startPoint.lat, pendingRoute.startPoint.lng).then(addressData => {
      let detectedBarangay = '';
      let detectedBarangayObj = null;
      let detectedStreet = '';
      
      if (addressData && addressData.address) {
        const address = addressData.address;
        detectedStreet = address.road || address.pedestrian || '';
        
        const possibleBarangayFields = [
          address.suburb,
          address.neighbourhood,
          address.city_district,
          address.quarter,
          address.village,
          address.city,
        ].filter(Boolean);
        
        for (const field of possibleBarangayFields) {
          if (!field || field.toLowerCase().includes('district')) continue;
          
          const match = barangays.find(b => 
            b.name.toLowerCase() === field.toLowerCase()
          );
          
          if (match) {
            detectedBarangay = match.name;
            detectedBarangayObj = match;
            break;
          }
          
          const partialMatch = barangays.find(b => 
            field.toLowerCase().includes(b.name.toLowerCase()) ||
            b.name.toLowerCase().includes(field.toLowerCase())
          );
          
          if (partialMatch) {
            detectedBarangay = partialMatch.name;
            detectedBarangayObj = partialMatch;
            break;
          }
        }
      }
      
      if (!detectedBarangay || !detectedBarangayObj || !detectedBarangayObj.id) {
        alert('Could not detect barangay. Please select manually.');
        return;
      }
      
      const tempRoute: TemporaryRoute = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        barangay: detectedBarangay,
        barangayId: detectedBarangayObj.id,
        street: detectedStreet,
        coordinates: pendingRoute.coordinates,
        polyline: pendingRoute.polyline,
        days: routeModalDays,
        time: routeModalTime,
        startPoint: pendingRoute.startPoint,
        endPoint: pendingRoute.endPoint
      };
      
      setTemporaryRoutes(prev => [...prev, tempRoute]);
      
      routeModeRef.current = false;
      setRouteMode(false);
      resetRoutePoints();
      setShowRouteModal(false);
      setPendingRoute(null);
      setRouteModalDays([]);
      setRouteModalTime('08:00'); // Reset to default
    });
  };

  const removeTempRoute = (id: string) => {
    setTemporaryRoutes(prev => {
      const toRemove = prev.find(r => r.id === id);
      if (toRemove && mapRef.current) {
        if (mapRef.current.hasLayer(toRemove.polyline)) {
          mapRef.current.removeLayer(toRemove.polyline);
        }
      }
      return prev.filter(r => r.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCollector) {
      alert('Please select a collector');
      return;
    }

    if (temporaryRoutes.length === 0) {
      alert('Please create at least one route by clicking "Start Route" and selecting start and end points on the map');
      return;
    }

    try {
      const collector = collectors.find(c => c.id === selectedCollector);
      if (!collector) {
        alert('Collector not found');
        return;
      }

      const schedulesToCreate: any[] = [];

      for (const tempRoute of temporaryRoutes) {
        if (!tempRoute.barangayId || tempRoute.barangayId.trim() === '') {
          alert(`Cannot create schedule: Barangay "${tempRoute.barangay || 'Unknown'}" not found in database.`);
          continue;
        }

        const latitudes: number[] = tempRoute.coordinates.map(coord => coord[0]);
        const longitudes: number[] = tempRoute.coordinates.map(coord => coord[1]);

        const scheduleData = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          collector_id: collector.id,
          barangay_id: tempRoute.barangayId,
          street_ids: tempRoute.street ? [tempRoute.street] : null,
          days: tempRoute.days,
          collection_time: tempRoute.time || '08:00',
          latitude: latitudes.length > 0 ? latitudes : null,
          longitude: longitudes.length > 0 ? longitudes : null,
          truck_no: collector.truckNo || null,
          barangay_name: tempRoute.barangay ? [tempRoute.barangay] : null,
          street_name: tempRoute.street ? [tempRoute.street] : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        schedulesToCreate.push(scheduleData);
      }

      if (schedulesToCreate.length > 0) {
        const { error } = await supabase
          .from('collection_schedules')
          .insert(schedulesToCreate);

        if (error) throw error;

        alert(`Successfully created ${schedulesToCreate.length} schedule(s)!`);
        
        // Reset form
        setSelectedCollector('');
        setTemporaryRoutes([]);
        resetRoutePoints();
        if (routeMode) {
          cancelRouteMode();
        }
        
        onScheduleCreated();
      }
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      alert(error.message || 'Failed to create schedule(s). Please try again.');
    }
  };

  const handleClose = () => {
    // Clean up
    if (mapRef.current) {
      mapRef.current.off('click');
      resetRoutePoints();
      temporaryRoutes.forEach(route => {
        if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
          mapRef.current.removeLayer(route.polyline);
        }
      });
    }
    setSelectedCollector('');
    setTemporaryRoutes([]);
    setRouteMode(false);
    routeModeRef.current = false;
    resetRoutePoints();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-large" onClick={handleClose}>
      <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Schedule</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="schedule-modal-content">
          <form onSubmit={handleSubmit} className="schedule-form">
            <div className="form-group">
              <label>Assign To *</label>
              <select
                value={selectedCollector}
                onChange={(e) => {
                  setSelectedCollector(e.target.value);
                  setTemporaryRoutes([]);
                  resetRoutePoints();
                  if (routeMode) {
                    cancelRouteMode();
                  }
                }}
                required
                className="form-select"
              >
                <option value="">Select Collector/Truck</option>
                {collectors.map(collector => (
                  <option key={collector.id} value={collector.id}>
                    {collector.name} ({collector.truckNo || 'No Truck'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Route Creation</label>
              {!routeMode ? (
                <button
                  type="button"
                  onClick={startRouteMode}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginBottom: '1rem' }}
                >
                  🛣️ Start Route
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelRouteMode}
                    className="btn btn-warning"
                    style={{ width: '100%', marginBottom: '1rem' }}
                  >
                    Cancel Route Creation
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
                      'Route fetched! Please complete the route metadata in the modal.'
                    )}
                  </div>
                </>
              )}
              {temporaryRoutes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    temporaryRoutes.forEach(route => {
                      if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
                        mapRef.current.removeLayer(route.polyline);
                      }
                    });
                    setTemporaryRoutes([]);
                  }}
                  className="btn btn-secondary btn-small"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Clear All Routes ({temporaryRoutes.length})
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Created Routes *</label>
              {temporaryRoutes.length === 0 ? (
                <div style={{ 
                  color: '#9ca3af',
                  fontSize: '0.875rem'
                }}>
                  Create routes by clicking "Start Route" and selecting start/end points on the map
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {temporaryRoutes.map((route, index) => (
                    <div
                      key={route.id}
                      style={{
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        backgroundColor: '#f9fafb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                            Route {index + 1}: {route.barangay}
                          </div>
                          {route.street && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                              {route.street}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span>Days: {route.days.join(', ')}</span>
                            {route.time && <span>Time: {route.time}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTempRoute(route.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            padding: '0',
                            lineHeight: 1,
                            fontWeight: 'bold',
                            marginLeft: '0.5rem'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                Create Schedule
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
            </div>
          </form>

          <div className="map-section">
            <h3>Schedule Map View</h3>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Search Location</label>
              <div className="autocomplete-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search for a location (e.g., Quezon City, Manila, Street Name)"
                  value={locationSearch}
                  onChange={handleLocationSearchChange}
                  onFocus={() => {
                    if (locationSearchResults.length > 0) {
                      setShowLocationSearchDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowLocationSearchDropdown(false);
                    }, 200);
                  }}
                />
                {showLocationSearchDropdown && locationSearchResults.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {locationSearchResults.map((result) => (
                      <div
                        key={result.place_id}
                        className="autocomplete-item"
                        onClick={() => handleLocationSelect(result)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                          {result.display_name.split(',')[0]}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {result.display_name.split(',').slice(1).join(',').trim()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div ref={mapContainerRef} className="schedule-map" style={{ height: '400px', width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Route Metadata Modal */}
      {showRouteModal && pendingRoute && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Route Metadata</h2>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Collection Days *</label>
              <div className="days-grid">
                {DAYS_OF_WEEK.map(day => {
                  const isChecked = routeModalDays.includes(day);
                  return (
                    <label 
                      key={day} 
                      className="day-checkbox"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.75rem',
                        border: `2px solid ${isChecked ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: isChecked ? '#eef2ff' : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setRouteModalDays(prev => prev.filter(d => d !== day));
                          } else {
                            setRouteModalDays(prev => [...prev, day]);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span style={{ 
                        color: isChecked ? '#3b82f6' : '#374151',
                        fontWeight: isChecked ? 600 : 400,
                        fontSize: '0.875rem'
                      }}>
                        {day}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Collection Time */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Collection Time *</label>
              <input
                type="time"
                value={routeModalTime}
                onChange={(e) => setRouteModalTime(e.target.value)}
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
                Select the time when collection should start for this route
              </small>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowRouteModal(false);
                  cancelRouteMode();
                  setPendingRoute(null);
                  setRouteModalDays([]);
                  setRouteModalTime('08:00');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRouteFromModal}
                className="btn btn-primary"
              >
                Save Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

