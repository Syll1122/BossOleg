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
  street_ids?: string[]; // Array of street IDs
  days: string[]; // Array of day abbreviations: ['Mon', 'Tue', 'Wed', etc.]
  created_at: string;
  updated_at: string;
  latitude?: number[]; // Array of latitude coordinates (route path)
  longitude?: number[]; // Array of longitude coordinates (route path)
  truck_no?: string;
  barangay_name?: string[]; // Array of barangay names
  street_name?: string[]; // Array of street names
}

interface TemporaryRoute {
  id: string;
  barangay: string;
  barangayId?: string;
  street?: string;
  coordinates: Array<[number, number]>; // Route path from OSRM
  polyline: L.Polyline;
  days: string[];
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


// Available marker colors (from leaflet-color-markers)
const MARKER_COLORS = [
  'blue',
  'red',
  'green',
  'orange',
  'yellow',
  'violet',
  'grey',
  'gold',
  'black',
  'pink',
  'cadetblue',
  'darkgreen',
  'darkblue',
  'darkred',
  'darkpurple',
  'lightblue',
  'lightgreen',
  'lightred',
];

// Helper function to create a colored marker icon
const createMarkerIcon = (color: string) => {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

export default function Schedules() {
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [selectedCollectorForPanel, setSelectedCollectorForPanel] = useState<string | null>(null);
  
  // Form state
  const [selectedCollector, setSelectedCollector] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string; latitude?: number; longitude?: number }>>([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedStreets, setSelectedStreets] = useState<string[]>([]);
  const [selectedBarangayCoords, setSelectedBarangayCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapSelectedLocation, setMapSelectedLocation] = useState<{ lat: number; lng: number; address?: any } | null>(null);
  
  // Route creation mode state
  const [routeMode, setRouteMode] = useState(false);
  const routeModeRef = useRef(false);
  const [routeStartPoint, setRouteStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeStartPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [routeEndPoint, setRouteEndPoint] = useState<{ lat: number; lng: number } | null>(null);
  const routeEndPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  
  // Temporary storage for routes (polylines)
  const [temporaryRoutes, setTemporaryRoutes] = useState<TemporaryRoute[]>([]);
  
  // Route metadata modal state
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{
    coordinates: Array<[number, number]>;
    startPoint: { lat: number; lng: number };
    endPoint: { lat: number; lng: number };
    polyline: L.Polyline;
  } | null>(null);
  const [routeModalDays, setRouteModalDays] = useState<string[]>([]);
  
  // Edit route days modal state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteDays, setEditingRouteDays] = useState<string[]>([]);
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    place_id: number;
  }>>([]);
  const [showLocationSearchDropdown, setShowLocationSearchDropdown] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadBarangays();
  }, []);

  // Reverse geocoding function using Nominatim (OpenStreetMap)
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

  // Forward geocoding - search for locations by name
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

  // Fetch route from OSRM API
  const fetchOSRMRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<Array<[number, number]> | null> => {
    try {
      // OSRM expects coordinates as [lng, lat]
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
        return coordinates;
      }
      
      return null;
    } catch (error) {
      console.error('OSRM route fetch error:', error);
      return null;
    }
  };

  // Handle location search input change
  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationSearch(value);
    searchLocations(value);
  };

  // Handle selecting a location from search results
  const handleLocationSelect = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    if (!isNaN(lat) && !isNaN(lng) && mapRef.current) {
      // Center map on selected location only (no marker)
      mapRef.current.setView([lat, lng], 15);
      
      // Clear search
      setLocationSearch('');
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
    }
  };

  // Remove temporary route by ID
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

  // Initialize Leaflet map
  useEffect(() => {
    // Early return if already initialized
    if (mapRef.current) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 30;
    let timeoutId: NodeJS.Timeout | null = null;
    let rafId: number | null = null;
    let isMounted = true;
    
    // Wait for container to be available and have dimensions
    const initMap = () => {
      if (!isMounted) {
        return;
      }

      if (!mapContainerRef.current) {
        retryCount++;
        if (retryCount < maxRetries) {
          rafId = requestAnimationFrame(() => {
            timeoutId = setTimeout(initMap, 150);
          });
        } else {
          console.error('Failed to initialize map: container not found after max retries');
        }
        return;
      }
      
      // Check if container has dimensions using getBoundingClientRect
      const container = mapContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = rect.width || container.offsetWidth || container.clientWidth;
      const height = rect.height || container.offsetHeight || container.clientHeight;
      
      if (width === 0 || height === 0) {
        retryCount++;
        if (retryCount < maxRetries) {
          rafId = requestAnimationFrame(() => {
            timeoutId = setTimeout(initMap, 150);
          });
        } else {
          console.error(`Failed to initialize map: container has no dimensions after max retries (${width}x${height})`);
        }
        return;
      }

      // Container is ready, initialize map

      try {
        // Initialize map centered on Quezon City
        mapRef.current = L.map(container, {
          center: [14.6760, 121.0437],
          zoom: 12,
          zoomControl: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        // Fix Leaflet default icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        // Invalidate size after a brief delay to ensure proper rendering
        setTimeout(() => {
          if (mapRef.current && isMounted) {
            mapRef.current.invalidateSize();
          }
        }, 100);

        // Map click handler for route creation
        mapRef.current.on('click', async (e: L.LeafletMouseEvent) => {
          if (!routeModeRef.current) return;
          
          const { lat, lng } = e.latlng;
          
          // Create marker icons
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
            // First click - set start point
            const startPoint = { lat, lng };
            routeStartPointRef.current = startPoint;
            setRouteStartPoint(startPoint);
            
            // Remove previous start marker if exists
            if (startMarkerRef.current && mapRef.current) {
              mapRef.current.removeLayer(startMarkerRef.current);
            }
            
            const marker = L.marker([lat, lng], { icon: startIcon })
              .addTo(mapRef.current!)
              .bindPopup('Start Point')
              .openPopup();
            
            startMarkerRef.current = marker;
            
          } else if (!routeEndPointRef.current) {
            // Second click - set end point and fetch route
            const endPoint = { lat, lng };
            routeEndPointRef.current = endPoint;
            setRouteEndPoint(endPoint);
            
            // Remove previous end marker if exists
            if (endMarkerRef.current && mapRef.current) {
              mapRef.current.removeLayer(endMarkerRef.current);
            }
            
            const marker = L.marker([lat, lng], { icon: endIcon })
              .addTo(mapRef.current!)
              .bindPopup('End Point')
              .openPopup();
            
            endMarkerRef.current = marker;
            
            // Fetch route from OSRM using ref values
            const start = routeStartPointRef.current;
            const routeCoordinates = await fetchOSRMRoute(
              start.lat,
              start.lng,
              lat,
              lng
            );
            
            if (routeCoordinates && routeCoordinates.length > 0) {
              // Draw polyline on map
              const polyline = L.polyline(routeCoordinates as [number, number][], {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.7
              }).addTo(mapRef.current!);
              
              // Store pending route and open modal
              setPendingRoute({
                coordinates: routeCoordinates as [number, number][],
                startPoint: start,
                endPoint: endPoint,
                polyline
              });
              
              // Open modal for route metadata
              setShowRouteModal(true);
              
            } else {
              alert('Failed to fetch route. Please try clicking the points again.');
              // Reset route points
              routeStartPointRef.current = null;
              routeEndPointRef.current = null;
              setRouteStartPoint(null);
              setRouteEndPoint(null);
              if (startMarkerRef.current && mapRef.current) {
                mapRef.current.removeLayer(startMarkerRef.current);
                startMarkerRef.current = null;
              }
              if (endMarkerRef.current && mapRef.current) {
                mapRef.current.removeLayer(endMarkerRef.current);
                endMarkerRef.current = null;
              }
            }
          }
        });
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    // Start initialization after a small delay to ensure DOM is ready
    rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(initMap, 100);
    });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (mapRef.current) {
        mapRef.current.off('click');
        if (startMarkerRef.current) {
          mapRef.current.removeLayer(startMarkerRef.current);
        }
        if (endMarkerRef.current) {
          mapRef.current.removeLayer(endMarkerRef.current);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array - setup once


  // Update map markers and polylines when schedules change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing schedule markers and polylines, but keep temporary routes and route creation markers
    const temporaryPolylineIds = new Set(temporaryRoutes.map(r => (r.polyline as any)._leaflet_id));
    const routeCreationMarkerIds = new Set([
      (startMarkerRef.current as any)?._leaflet_id,
      (endMarkerRef.current as any)?._leaflet_id
    ].filter(Boolean) as number[]);
    
    mapRef.current.eachLayer((layer) => {
      // Keep temporary route polylines
      if (layer instanceof L.Polyline && temporaryPolylineIds.has((layer as any)._leaflet_id)) {
        return;
      }
      // Keep route creation markers
      if (layer instanceof L.Marker && routeCreationMarkerIds.has((layer as any)._leaflet_id)) {
        return;
      }
      // Keep pending route polyline
      if (layer instanceof L.Polyline && pendingRoute && layer === pendingRoute.polyline) {
        return;
      }
      // Remove all other markers and polylines
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Build a map of unique collector IDs to assign unique colors
    const uniqueCollectorIds = new Set<string>();
    schedules.forEach(schedule => {
      if (schedule.collector_id) {
        uniqueCollectorIds.add(schedule.collector_id);
      }
    });
    
    // Assign colors sequentially to collectors for uniqueness
    const collectorColorMap = new Map<string, string>();
    const collectorIdsArray = Array.from(uniqueCollectorIds).sort(); // Sort for consistent ordering
    collectorIdsArray.forEach((collectorId, index) => {
      collectorColorMap.set(collectorId, MARKER_COLORS[index % MARKER_COLORS.length]);
    });

    // Add polylines for all schedules with route coordinates
    schedules.forEach(schedule => {
      const collector = collectors.find(c => c.id === schedule.collector_id);
      const collectorName = collector?.name || 'Unknown';
      const color = collectorColorMap.get(schedule.collector_id) || 'blue';
      
      // Handle array format for latitude/longitude (route paths)
      if (schedule.latitude && schedule.longitude && Array.isArray(schedule.latitude) && Array.isArray(schedule.longitude)) {
        // If we have multiple coordinates, it's a route path - draw as polyline
        if (schedule.latitude.length > 1) {
          const routeCoordinates: [number, number][] = schedule.latitude.map((lat, index) => {
            const lng = schedule.longitude?.[index];
            return [lat, lng] as [number, number];
          }).filter(coord => coord[0] !== undefined && coord[1] !== undefined);
          
          if (routeCoordinates.length > 1) {
            // Convert collector color to hex if needed (using a simple mapping)
            const polylineColor = color === 'blue' ? '#3b82f6' : 
                                  color === 'red' ? '#ef4444' :
                                  color === 'green' ? '#10b981' :
                                  color === 'orange' ? '#f59e0b' :
                                  '#3b82f6'; // Default blue
            
            const polyline = L.polyline(routeCoordinates, {
              color: polylineColor,
              weight: 6,
              opacity: 0.7
            }).addTo(mapRef.current!);
            
            // Get metadata for popup
            const barangayName = Array.isArray(schedule.barangay_name) 
              ? schedule.barangay_name[0] 
              : schedule.barangay_name || 'N/A';
            
            const streetName = Array.isArray(schedule.street_name) 
              ? schedule.street_name.join(', ') 
              : schedule.street_name || '';
            
                  polyline.bindPopup(`
              <strong>${collectorName}</strong><br/>
              Truck: ${schedule.truck_no || 'N/A'}<br/>
              Barangay: ${barangayName}${streetName ? `<br/>Street: ${streetName}` : ''}<br/>
              Days: ${schedule.days.join(', ')}
            `);
          }
        } else if (schedule.latitude.length === 1) {
          // Single point - show as marker for backward compatibility
          const lat = schedule.latitude[0];
          const lng = schedule.longitude?.[0];
          if (lat !== undefined && lng !== undefined) {
            const markerIcon = createMarkerIcon(color);
            const marker = L.marker([lat, lng], { icon: markerIcon })
              .addTo(mapRef.current!);
            
            const barangayName = Array.isArray(schedule.barangay_name) 
              ? schedule.barangay_name[0] 
              : schedule.barangay_name || 'N/A';
            
            const streetName = Array.isArray(schedule.street_name) 
              ? schedule.street_name.join(', ') 
              : schedule.street_name || '';
            
            marker.bindPopup(`
              <strong>${collectorName}</strong><br/>
              Truck: ${schedule.truck_no || 'N/A'}<br/>
              Barangay: ${barangayName}${streetName ? `<br/>Street: ${streetName}` : ''}<br/>
              Days: ${schedule.days.join(', ')}
            `);
          }
        }
      } else if (schedule.latitude && schedule.longitude && !Array.isArray(schedule.latitude) && typeof schedule.latitude === 'number' && typeof schedule.longitude === 'number') {
        // Fallback for single values (backward compatibility with old data)
        const markerIcon = createMarkerIcon(color);
        const marker = L.marker([schedule.latitude, schedule.longitude], { icon: markerIcon })
          .addTo(mapRef.current!);
        
        const barangayName = Array.isArray(schedule.barangay_name) 
          ? schedule.barangay_name[0] 
          : schedule.barangay_name || 'N/A';
        
        const streetName = Array.isArray(schedule.street_name) 
          ? schedule.street_name.join(', ') 
          : schedule.street_name || '';
        
        marker.bindPopup(`
          <strong>${collectorName}</strong><br/>
          Truck: ${schedule.truck_no || 'N/A'}<br/>
          Barangay: ${barangayName}${streetName ? `<br/>Street: ${streetName}` : ''}<br/>
          Days: ${schedule.days.join(', ')}
        `);
      }
    });

    // Update view if coordinates are available
    if (selectedBarangayCoords && mapRef.current) {
      mapRef.current.setView([selectedBarangayCoords.lat, selectedBarangayCoords.lng], 15);
    }
  }, [schedules, selectedBarangayCoords, selectedBarangay, collectors, temporaryRoutes, pendingRoute]);


  const loadData = async () => {
    try {
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
      // First try to select with latitude/longitude
      let { data, error } = await supabase
        .from('barangays')
        .select('id, name, latitude, longitude')
        .order('name', { ascending: true });

      // If that fails (400 error), try without latitude/longitude
      if (error) {
        console.log('Latitude/longitude columns not found, loading without them');
        const result = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });
        
        data = result.data as any;
        error = result.error;
      }

      if (!error && data) {
        setBarangays(data.map((bg: any) => ({
          id: bg.id,
          name: bg.name,
          latitude: bg.latitude || undefined,
          longitude: bg.longitude || undefined,
        })));
      } else if (error) {
        console.error('Error loading barangays:', error);
      }
    } catch (error) {
      console.error('Error loading barangays:', error);
      // Try loading without latitude/longitude as fallback
      try {
        const { data, error: fallbackError } = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });

        if (!fallbackError && data) {
          setBarangays(data.map((bg: any) => ({
            id: bg.id,
            name: bg.name,
            latitude: undefined,
            longitude: undefined,
          })));
        }
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr);
      }
    }
  };

  // Get days already scheduled for the selected collector (excluding current schedule if editing)
  const getScheduledDaysForCollector = (): string[] => {
    if (!selectedCollector) return [];
    
    const scheduledDays: string[] = [];
    schedules
      .filter(schedule => 
        schedule.collector_id === selectedCollector && 
        schedule.id !== editingScheduleId // Exclude current schedule if editing
      )
      .forEach(schedule => {
        if (schedule.days && Array.isArray(schedule.days)) {
          scheduledDays.push(...schedule.days);
        }
      });
    
    // Return unique days
    return [...new Set(scheduledDays)];
  };

  const handleDayToggle = (day: string) => {
    // Allow unchecking (removing) a day even if it's scheduled elsewhere
    const currentlySelected = selectedDays.includes(day);
    if (currentlySelected) {
      // Allow unchecking
      setSelectedDays(prev => prev.filter(d => d !== day));
      return;
    }
    
    // When checking (adding), prevent if day is already scheduled for this collector in another schedule
    const scheduledDays = getScheduledDaysForCollector();
    if (scheduledDays.includes(day)) {
      return; // Don't allow selecting a day that's already scheduled
    }
    
    // Allow checking
    setSelectedDays(prev => [...prev, day]);
  };


  // Route creation mode handlers
  const startRouteMode = () => {
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

  const cancelRouteMode = () => {
    routeModeRef.current = false;
    setRouteMode(false);
    
    // Remove start and end markers
    if (startMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    
    // Remove pending route polyline if exists
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
    
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = '';
    }
  };

  // Check for duplicate route
  const checkDuplicateRoute = (
    collectorId: string,
    barangayId: string,
    barangayName: string,
    streetName: string | undefined,
    days: string[]
  ): Schedule | null => {
    return schedules.find(schedule => {
      // Must be same collector
      if (schedule.collector_id !== collectorId) return false;
      
      // Must be same barangay
      const scheduleBarangayId = schedule.barangay_id;
      const scheduleBarangayName = Array.isArray(schedule.barangay_name) 
        ? schedule.barangay_name[0] 
        : schedule.barangay_name;
      
      const barangayMatch = scheduleBarangayId === barangayId || 
                           scheduleBarangayName?.toLowerCase() === barangayName.toLowerCase();
      
      if (!barangayMatch) return false;
      
      // If street is provided, check for street match
      if (streetName) {
        const scheduleStreetName = Array.isArray(schedule.street_name) 
          ? schedule.street_name[0] 
          : schedule.street_name;
        
        if (scheduleStreetName && scheduleStreetName.toLowerCase() !== streetName.toLowerCase()) {
          return false;
        }
      }
      
      // Check if days overlap (at least one day in common)
      const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [];
      const hasOverlappingDay = days.some(day => scheduleDays.includes(day));
      
      return hasOverlappingDay;
    }) || null;
  };

  // Handle saving route from modal
  const handleSaveRouteFromModal = () => {
    if (!pendingRoute || routeModalDays.length === 0) {
      alert('Please select at least one collection day');
      return;
    }

    if (!selectedCollector) {
      alert('Please select a collector first');
      return;
    }

    // Perform reverse geocoding to get barangay info
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
      
      if (!detectedBarangay && !detectedBarangayObj) {
        alert('Could not detect barangay. Please select manually.');
        return;
      }
      
      // Check for duplicate route before adding
      if (!detectedBarangayObj || !detectedBarangayObj.id) {
        alert('Could not detect barangay. Please select manually.');
        return;
      }
      
      const duplicate = checkDuplicateRoute(
        selectedCollector,
        detectedBarangayObj.id,
        detectedBarangay,
        detectedStreet,
        routeModalDays
      );
      
      if (duplicate) {
        const duplicateBarangay = Array.isArray(duplicate.barangay_name) 
          ? duplicate.barangay_name[0] 
          : duplicate.barangay_name || 'Unknown';
        const duplicateStreet = Array.isArray(duplicate.street_name) 
          ? duplicate.street_name[0] 
          : duplicate.street_name || '';
        const duplicateDays = Array.isArray(duplicate.days) ? duplicate.days.join(', ') : '';
        
        alert(
          `A route already exists for this location!\n\n` +
          `Location: ${duplicateBarangay}${duplicateStreet ? `, ${duplicateStreet}` : ''}\n` +
          `Days: ${duplicateDays}\n\n` +
          `Please choose a different location or different days.`
        );
        return;
      }
      
      // Extract coordinates for storage
      const latitudes = pendingRoute.coordinates.map(coord => coord[0]);
      const longitudes = pendingRoute.coordinates.map(coord => coord[1]);
      
      // Create temporary route entry
      const tempRoute: TemporaryRoute = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        barangay: detectedBarangay,
        barangayId: detectedBarangayObj?.id,
        street: detectedStreet,
        coordinates: pendingRoute.coordinates,
        polyline: pendingRoute.polyline,
          days: routeModalDays,
          startPoint: pendingRoute.startPoint,
        endPoint: pendingRoute.endPoint
      };
      
      setTemporaryRoutes(prev => [...prev, tempRoute]);
      
      // Reset route creation state
      routeModeRef.current = false;
      setRouteMode(false);
      routeStartPointRef.current = null;
      routeEndPointRef.current = null;
      setRouteStartPoint(null);
      setRouteEndPoint(null);
      setShowRouteModal(false);
      setPendingRoute(null);
      setRouteModalDays([]);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCollector) {
      alert('Please select a collector');
      return;
    }

    const collector = collectors.find(c => c.id === selectedCollector);
    if (!collector) {
      alert('Collector not found');
      return;
    }

    // Check if we have temporary routes
    if (temporaryRoutes.length === 0) {
      alert('Please create at least one route by clicking "Start Route" and selecting start and end points on the map');
      return;
    }

    try {
      const schedulesToCreate: any[] = [];

      // Create schedule for each temporary route
      for (const tempRoute of temporaryRoutes) {
        if (!tempRoute.barangayId || tempRoute.barangayId.trim() === '') {
          alert(`Cannot create schedule: Barangay "${tempRoute.barangay || 'Unknown'}" not found in database.`);
          continue;
        }

        // Check for duplicate route in database (excluding current schedule if editing)
        const duplicate = checkDuplicateRoute(
          collector.id,
          tempRoute.barangayId,
          tempRoute.barangay,
          tempRoute.street,
          tempRoute.days
        );
        
        if (duplicate && duplicate.id !== editingScheduleId) {
          const duplicateBarangay = Array.isArray(duplicate.barangay_name) 
            ? duplicate.barangay_name[0] 
            : duplicate.barangay_name || 'Unknown';
          const duplicateStreet = Array.isArray(duplicate.street_name) 
            ? duplicate.street_name[0] 
            : duplicate.street_name || '';
          const duplicateDays = Array.isArray(duplicate.days) ? duplicate.days.join(', ') : '';
          
          alert(
            `Cannot create schedule: A route already exists for this location!\n\n` +
            `Location: ${duplicateBarangay}${duplicateStreet ? `, ${duplicateStreet}` : ''}\n` +
            `Days: ${duplicateDays}\n\n` +
            `Please choose a different location or different days.`
          );
          continue;
        }

        // Extract coordinate arrays from route path
        const latitudes: number[] = tempRoute.coordinates.map(coord => coord[0]);
        const longitudes: number[] = tempRoute.coordinates.map(coord => coord[1]);

        const scheduleData = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          collector_id: collector.id,
          barangay_id: tempRoute.barangayId,
          street_ids: tempRoute.street ? [tempRoute.street] : null,
          days: tempRoute.days,
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

      // Update or insert schedules
      if (schedulesToCreate.length > 0) {
        if (editingScheduleId) {
          // Update existing schedule
          const scheduleData = schedulesToCreate[0];
          const { error } = await supabase
            .from('collection_schedules')
            .update({
              collector_id: scheduleData.collector_id,
              barangay_id: scheduleData.barangay_id,
              street_ids: scheduleData.street_ids,
              days: scheduleData.days,
              latitude: scheduleData.latitude,
              longitude: scheduleData.longitude,
              truck_no: scheduleData.truck_no,
              barangay_name: scheduleData.barangay_name,
              street_name: scheduleData.street_name,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingScheduleId);

          if (error) throw error;

          alert('Schedule updated successfully!');
          setEditingScheduleId(null);
        } else {
          // Insert new schedules
          const { error } = await supabase
            .from('collection_schedules')
            .insert(schedulesToCreate);

          if (error) throw error;

          alert(`Successfully created ${schedulesToCreate.length} schedule(s)!`);
        }
        
        // Reset form
        setSelectedCollector('');
        setSelectedDays([]);
        setSelectedBarangay('');
        setBarangaySearch('');
        setSelectedStreets([]);
        setSelectedBarangayCoords(null);
        setMapSelectedLocation(null);
        
        // Clear temporary routes and remove polylines
        temporaryRoutes.forEach(route => {
          if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
            mapRef.current.removeLayer(route.polyline);
          }
        });
        setTemporaryRoutes([]);
        
        // Reset route mode if active
        if (routeMode) {
          cancelRouteMode();
        }
        
        // Reload schedules
        await loadData();
      }
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      alert(error.message || 'Failed to create schedule(s). Please try again.');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    // Populate form with schedule data
    setEditingScheduleId(schedule.id);
    setSelectedCollector(schedule.collector_id);
    
    // Clear existing temporary routes and polylines
    temporaryRoutes.forEach(route => {
      if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
        mapRef.current.removeLayer(route.polyline);
      }
    });
    setTemporaryRoutes([]);
    
    // Populate temporary routes from schedule data
    if (schedule.latitude && schedule.longitude && Array.isArray(schedule.latitude) && schedule.latitude.length > 1) {
      // It's a route path - recreate polyline
      const routeCoordinates: [number, number][] = schedule.latitude.map((lat, index) => {
        const lng = schedule.longitude?.[index];
        return [lat, lng] as [number, number];
      }).filter(coord => coord[0] !== undefined && coord[1] !== undefined);
      
      if (routeCoordinates.length > 1 && mapRef.current) {
        const polyline = L.polyline(routeCoordinates, {
          color: '#3b82f6',
          weight: 6,
          opacity: 0.7
        }).addTo(mapRef.current);
        
        const barangayName = Array.isArray(schedule.barangay_name) 
          ? schedule.barangay_name[0] 
          : schedule.barangay_name || '';
        
        const streetName = Array.isArray(schedule.street_name) 
          ? schedule.street_name[0] 
          : schedule.street_name || '';
        
        const tempRoute: TemporaryRoute = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          barangay: barangayName,
          barangayId: schedule.barangay_id,
          street: streetName || undefined,
          coordinates: routeCoordinates,
          polyline: polyline,
          days: schedule.days || [],
          startPoint: { lat: routeCoordinates[0][0], lng: routeCoordinates[0][1] },
          endPoint: { lat: routeCoordinates[routeCoordinates.length - 1][0], lng: routeCoordinates[routeCoordinates.length - 1][1] }
        };
        
        setTemporaryRoutes([tempRoute]);
        
        // Set barangay
        if (barangayName) {
          setSelectedBarangay(barangayName);
          setBarangaySearch(barangayName);
        }
      }
    }
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingScheduleId(null);
    // Reset form
    setSelectedCollector('');
    setSelectedDays([]);
        setSelectedBarangay('');
        setBarangaySearch('');
        setSelectedStreets([]);
        setSelectedBarangayCoords(null);
    setMapSelectedLocation(null);
    
    // Clear temporary routes and remove polylines
    temporaryRoutes.forEach(route => {
      if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
        mapRef.current.removeLayer(route.polyline);
      }
    });
    setTemporaryRoutes([]);
    
    // Cancel route mode if active
    if (routeMode) {
      cancelRouteMode();
    }
  };

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

  return (
    <div className="schedules-page">
      <div className="page-header">
        <h1>Collection Schedules</h1>
      </div>

      <div className="schedules-content">
        {/* Form Section */}
        <div className="form-section">
          <h2>Create New Schedule</h2>
          <form onSubmit={handleSubmit} className="schedule-form">
            {/* Collector/Truck Selection */}
            <div className="form-group">
              <label>Assign To *</label>
              <select
                value={selectedCollector}
                onChange={(e) => {
                  const newCollectorId = e.target.value;
                  // Full reset when collector changes
                  if (selectedCollector && selectedCollector !== newCollectorId) {
                    // Clear all temporary routes and remove all polylines
                    temporaryRoutes.forEach(route => {
                      if (mapRef.current && mapRef.current.hasLayer(route.polyline)) {
                        mapRef.current.removeLayer(route.polyline);
                      }
                    });
                    setTemporaryRoutes([]);
                    
                    // Clear form fields
        setSelectedBarangay('');
        setBarangaySearch('');
        setSelectedStreets([]);
        setSelectedBarangayCoords(null);
                    setMapSelectedLocation(null);
                    
                    // Cancel route mode if active
                    if (routeMode) {
                      cancelRouteMode();
                    }
                  }
                  setSelectedCollector(newCollectorId);
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

            {/* Route Creation Button */}
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

            {/* Routes Display */}
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
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#9ca3af',
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            <span>Days: {route.days.join(', ')}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRouteId(route.id);
                                setEditingRouteDays([...route.days]);
                              }}
                              style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontWeight: 500
                              }}
                            >
                              Edit Days
                            </button>
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
                {editingScheduleId ? 'Update Schedule' : 'Create Schedule'}
              </button>
              {editingScheduleId && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  style={{ backgroundColor: '#6b7280', borderColor: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Map Section */}
        <div className="map-section">
          <h2>Schedule Map View</h2>
          
          {/* Location Search */}
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
                  // Delay closing dropdown to allow clicks
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
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
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
          
          <div ref={mapContainerRef} className="schedule-map"></div>
        </div>
      </div>

      {/* Existing Schedules - Collector Buttons */}
      <div className="schedules-list">
        <h2>Existing Schedules</h2>
        {schedules.length === 0 ? (
          <div className="empty-state">No schedules created yet</div>
        ) : (
          <>
            {/* Collector/Truck Buttons */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.75rem', 
              marginBottom: '1.5rem' 
            }}>
              {(() => {
                // Group schedules by collector_id
                const collectorMap = new Map<string, Schedule[]>();
                schedules.forEach(schedule => {
                  const collectorId = schedule.collector_id;
                  if (!collectorMap.has(collectorId)) {
                    collectorMap.set(collectorId, []);
                  }
                  collectorMap.get(collectorId)!.push(schedule);
                });

                return Array.from(collectorMap.entries()).map(([collectorId, collectorSchedules]) => {
                  const collector = collectors.find(c => c.id === collectorId);
                  const collectorName = collector?.name || 'Unknown';
                  const truckNo = collectorSchedules[0]?.truck_no || collector?.truckNo || '-';
                  const isSelected = selectedCollectorForPanel === collectorId;

                  return (
                    <button
                      key={collectorId}
                      type="button"
                      onClick={() => setSelectedCollectorForPanel(isSelected ? null : collectorId)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                        backgroundColor: isSelected ? '#eff6ff' : 'white',
                        color: isSelected ? '#1e40af' : '#374151',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.875rem',
                        boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {collectorName} ({truckNo})
                    </button>
                  );
                });
              })()}
            </div>

            {/* Schedule Details Panel */}
            {selectedCollectorForPanel && (() => {
              const collectorSchedules = schedules.filter(s => s.collector_id === selectedCollectorForPanel);
              const collector = collectors.find(c => c.id === selectedCollectorForPanel);
              const collectorName = collector?.name || 'Unknown';

              return (
                <div style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                      Schedules for {collectorName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedCollectorForPanel(null)}
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
                        e.currentTarget.style.color = '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Collector</th>
                          <th>Truck No</th>
                          <th>Location</th>
                          <th>Days</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectorSchedules.map(schedule => (
                          <tr key={schedule.id}>
                            <td>{collectorName}</td>
                            <td>{schedule.truck_no || '-'}</td>
                            <td>
                              {Array.isArray(schedule.barangay_name) 
                                ? schedule.barangay_name.join(', ') 
                                : schedule.barangay_name || '-'}
                              {schedule.street_name && (
                                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                  {Array.isArray(schedule.street_name) 
                                    ? schedule.street_name.join(', ') 
                                    : schedule.street_name}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="days-tags">
                                {schedule.days.map(day => (
                                  <span key={day} className="day-tag">{day}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-primary btn-small"
                                  onClick={() => handleEdit(schedule)}
                                  style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-small"
                                  onClick={() => handleDelete(schedule.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
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
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            // Don't close on backdrop click - require explicit cancel
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
            
            {/* Collection Days */}
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

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowRouteModal(false);
                  cancelRouteMode();
                  setPendingRoute(null);
                  setRouteModalDays([]);
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

      {/* Edit Route Days Modal */}
      {editingRouteId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingRouteId(null);
              setEditingRouteDays([]);
            }
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
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit Collection Days</h2>
            
            {/* Collection Days */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Collection Days *</label>
              <div className="days-grid">
                {DAYS_OF_WEEK.map(day => {
                  const isChecked = editingRouteDays.includes(day);
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
                            setEditingRouteDays(prev => prev.filter(d => d !== day));
                          } else {
                            setEditingRouteDays(prev => [...prev, day]);
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

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingRouteId(null);
                  setEditingRouteDays([]);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingRouteDays.length === 0) {
                    alert('Please select at least one collection day');
                    return;
                  }
                  
                  // Update the route's days
                  setTemporaryRoutes(prev => prev.map(route => {
                    if (route.id === editingRouteId) {
                      return { ...route, days: editingRouteDays };
                    }
                    return route;
                  }));
                  
                  setEditingRouteId(null);
                  setEditingRouteDays([]);
                }}
                className="btn btn-primary"
              >
                Save Days
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

