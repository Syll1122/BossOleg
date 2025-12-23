import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDashboardStats, DashboardStats, getAllTruckStatuses, updateTruckStatus, getAllAccounts } from '../services/api';
import { supabase } from '../lib/supabase';
import { Account, TruckStatus } from '../types';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Dashboard.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Schedule {
  id: string;
  collector_id: string;
  barangay_id: string;
  days: string[];
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [truckStatuses, setTruckStatuses] = useState<TruckStatus[]>([]);
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [collectionStatuses, setCollectionStatuses] = useState<CollectionStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<{ type: 'truck' | 'route'; id: string } | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'trucks' | 'routes'>('all');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const truckMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const collectionMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    loadStats();
    loadMapData();
    const interval = setInterval(() => {
      loadStats();
      loadMapData();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Wait for component to fully mount and container to be available
    const initMap = () => {
      if (!mapContainerRef.current) {
        setTimeout(initMap, 100);
        return;
      }

      const container = mapContainerRef.current;
      
      // Check if already initialized
      if (mapRef.current) {
        return;
      }

      // Wait for container to have dimensions
      const checkDimensions = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          initializeMap();
        } else {
          // Retry after a short delay
          setTimeout(checkDimensions, 100);
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(checkDimensions, 100);
      });
    };

    // Start initialization
    setTimeout(initMap, 300);
    
    // Invalidate map size when window resizes
    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.invalidateSize(false);
        }, 100);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      // Invalidate size first, then render data
      requestAnimationFrame(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(false);
          setTimeout(() => {
            renderMapData();
            // Force another invalidate after rendering
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.invalidateSize(false);
              }
            }, 100);
          }, 100);
        }
      });
    }
  }, [schedules, truckStatuses, collectionStatuses, collectors]);

  // Handle routeId from URL params to focus on specific route
  useEffect(() => {
    const routeId = searchParams.get('routeId');
    if (routeId && mapRef.current && schedules.length > 0) {
      const schedule = schedules.find(s => s.id === routeId);
      if (schedule) {
        // Set selected item
        setSelectedItem({ type: 'route', id: routeId });
        setSidebarFilter('routes');
        
        // Focus map on route after a short delay to ensure map is rendered
        setTimeout(() => {
          if (mapRef.current && schedule.latitude && schedule.longitude) {
            const lats = Array.isArray(schedule.latitude) ? schedule.latitude : [schedule.latitude];
            const lngs = Array.isArray(schedule.longitude) ? schedule.longitude : [schedule.longitude];
            
            if (lats.length > 0 && lngs.length > 0) {
              const routePoints: L.LatLngExpression[] = [];
              const maxLength = Math.max(lats.length, lngs.length);
              for (let i = 0; i < maxLength; i++) {
                if (lats[i] !== undefined && lngs[i] !== undefined && !isNaN(lats[i]) && !isNaN(lngs[i])) {
                  routePoints.push([lats[i], lngs[i]]);
                }
              }
              
              if (routePoints.length > 0) {
                const polyline = routePolylinesRef.current.get(routeId);
                if (polyline) {
                  // Highlight the route
                  polyline.setStyle({ weight: 8, opacity: 1 });
                  polyline.openPopup();
                  
                  // Fit bounds to route
                  const bounds = L.latLngBounds(routePoints);
                  mapRef.current.fitBounds(bounds, { padding: [50, 50] });
                  
                  // Revert style after 3 seconds
                  setTimeout(() => {
                    const routeStatus = getRouteStatus(schedule);
                    polyline.setStyle({ 
                      color: routeStatus.color, 
                      weight: 5, 
                      opacity: 0.8 
                    });
                  }, 3000);
                } else if (routePoints.length === 1) {
                  mapRef.current.setView(routePoints[0], 16);
                } else {
                  const bounds = L.latLngBounds(routePoints);
                  mapRef.current.fitBounds(bounds, { padding: [50, 50] });
                }
              }
            }
          }
        }, 500);
        
        // Remove routeId from URL after focusing
        searchParams.delete('routeId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, schedules, mapRef.current]);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMapData = async () => {
    try {
      const [schedulesData, truckStatusData, accountsData, collectionStatusData] = await Promise.all([
        supabase.from('collection_schedules').select('*').order('created_at', { ascending: false }),
        getAllTruckStatuses(),
        getAllAccounts(),
        supabase.from('collection_status').select('*').gte('collectionDate', new Date().toISOString().split('T')[0])
      ]);

      if (schedulesData.data) {
        setSchedules(schedulesData.data as Schedule[]);
      }
      setTruckStatuses(truckStatusData);
      setCollectors(accountsData);
      
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
      console.error('Failed to load map data:', error);
    }
  };

  const initializeMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    const container = mapContainerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Ensure container has dimensions
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Map container has no dimensions, retrying...');
      setTimeout(() => initializeMap(), 200);
      return;
    }
    
    try {
      // Create map instance
      const map = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: false,
        doubleClickZoom: true,
        boxZoom: true
      }).setView([14.682042, 121.076975], 13);

      // Add tile layer with error handling
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 3,
        tileSize: 256,
        zoomOffset: 0
      });
      
      tileLayer.addTo(map);
      mapRef.current = map;
      
      // Force map to render
      const forceRender = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(false);
          // Trigger a small zoom change to force re-render
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.setZoom(currentZoom);
          renderMapData();
        }
      };
      
      // Use whenReady to ensure map is fully initialized
      map.whenReady(() => {
        forceRender();
      });
      
      // Also try after a delay
      setTimeout(forceRender, 200);
      setTimeout(forceRender, 500);
    } catch (error) {
      console.error('Error initializing map:', error);
      // Retry on error
      setTimeout(() => {
        if (!mapRef.current) {
          initializeMap();
        }
      }, 500);
    }
  };

  const getRouteStatus = (schedule: Schedule): { status: 'today' | 'done' | 'skipped' | 'scheduled' | 'completed'; color: string } => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const todayDate = new Date().toISOString().split('T')[0];
    const isScheduledToday = schedule.days.includes(today);

    const barangayName = Array.isArray(schedule.barangay_name) 
      ? schedule.barangay_name[0] 
      : schedule.barangay_name || '';
    const streetName = Array.isArray(schedule.street_name) 
      ? schedule.street_name[0] 
      : schedule.street_name || '';

    // Check collection status using updated schema (scheduleId + streetName + collectionDate)
    const todayCollection = collectionStatuses.find(cs => {
      const matchesSchedule = cs.scheduleId === schedule.id;
      const matchesDate = cs.collectionDate === todayDate;
      const matchesStreet = cs.streetName === streetName;
      const matchesBarangay = cs.barangayName === barangayName;
      return matchesSchedule && matchesDate && matchesStreet && matchesBarangay;
    });

    if (todayCollection) {
      if (todayCollection.status === 'collected') {
        return { status: 'done', color: '#10b981' }; // Green
      } else if (todayCollection.status === 'skipped') {
        return { status: 'skipped', color: '#f59e0b' }; // Orange
      } else if (todayCollection.status === 'missed') {
        return { status: 'skipped', color: '#ef4444' }; // Red (display as skipped)
      } else {
        return { status: 'completed', color: '#3b82f6' }; // Blue (pending/in-progress)
      }
    } else if (isScheduledToday) {
      return { status: 'today', color: '#16a34a' }; // Green (scheduled for today)
    } else {
      return { status: 'scheduled', color: '#6b7280' }; // Gray (scheduled for other days)
    }
  };

  const renderMapData = () => {
    if (!mapRef.current) {
      console.warn('Map not initialized, cannot render data');
      return;
    }

    console.log('Rendering map data - Schedules:', schedules.length, 'Trucks:', truckStatuses.length);

    // Clear existing markers and polylines
    routePolylinesRef.current.forEach(polyline => {
      if (mapRef.current) {
        mapRef.current.removeLayer(polyline);
      }
    });
    truckMarkersRef.current.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    collectionMarkersRef.current.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    routePolylinesRef.current.clear();
    truckMarkersRef.current.clear();
    collectionMarkersRef.current.clear();

    const allBounds: L.LatLngBounds = L.latLngBounds([]);
    let hasBounds = false;

    // Render route polylines for ALL schedules
    console.log(`Processing ${schedules.length} schedules for rendering`);
    schedules.forEach((schedule) => {
      // Handle both array and single value formats
      let routeLatitudes: number[] = [];
      let routeLongitudes: number[] = [];
      
      if (Array.isArray(schedule.latitude)) {
        routeLatitudes = schedule.latitude;
      } else if (schedule.latitude !== undefined && schedule.latitude !== null) {
        routeLatitudes = [schedule.latitude];
      }
      
      if (Array.isArray(schedule.longitude)) {
        routeLongitudes = schedule.longitude;
      } else if (schedule.longitude !== undefined && schedule.longitude !== null) {
        routeLongitudes = [schedule.longitude];
      }
      
      // Get route status and color
      const routeStatus = getRouteStatus(schedule);
      
      if (routeLatitudes.length > 0 && routeLongitudes.length > 0) {
        const routePoints: L.LatLngExpression[] = [];
        const maxLength = Math.max(routeLatitudes.length, routeLongitudes.length);
        
        for (let i = 0; i < maxLength; i++) {
          const lat = routeLatitudes[i];
          const lng = routeLongitudes[i];
          if (lat !== undefined && lng !== undefined && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            routePoints.push([lat, lng]);
            allBounds.extend([lat, lng]);
            hasBounds = true;
          }
        }

        if (routePoints.length > 1) {
          const collector = collectors.find(c => c.id === schedule.collector_id);
          const barangayName = Array.isArray(schedule.barangay_name) 
            ? schedule.barangay_name[0] 
            : schedule.barangay_name || 'Unknown';
          const streetName = Array.isArray(schedule.street_name) 
            ? schedule.street_name.join(', ') 
            : schedule.street_name || '';

          const polyline = L.polyline(routePoints, {
            color: routeStatus.color,
            weight: 5,
            opacity: 0.8
          });

          if (mapRef.current) {
            polyline.addTo(mapRef.current);
          }

          const statusLabel = routeStatus.status === 'today' ? 'Scheduled Today' :
                             routeStatus.status === 'done' ? 'Done' :
                             routeStatus.status === 'skipped' ? 'Skipped' :
                             routeStatus.status === 'completed' ? 'In Progress' :
                             'Scheduled';

          polyline.bindPopup(`
            <strong>Route: ${barangayName}${streetName ? ` - ${streetName}` : ''}</strong><br/>
            Status: <span style="color: ${routeStatus.color}; font-weight: bold;">${statusLabel}</span><br/>
            Collector: ${collector?.name || 'Unknown'}<br/>
            Truck: ${schedule.truck_no || collector?.truckNo || 'N/A'}<br/>
            Time: ${schedule.collection_time || '08:00'}<br/>
            Days: ${schedule.days.join(', ')}
          `);

          routePolylinesRef.current.set(schedule.id, polyline);
          console.log(`Route polyline added: ${barangayName} - ${routePoints.length} points`);
        }
      } else {
        console.log(`Schedule ${schedule.id} has no coordinates`);
      }
    });

    // Render truck markers
    truckStatuses.forEach(truckStatus => {
      if (!truckStatus.latitude || !truckStatus.longitude) {
        console.log(`Truck ${truckStatus.id} has no GPS coordinates`);
        return;
      }

      const collector = collectors.find(c => 
        c.id === truckStatus.updatedBy || 
        c.truckNo === truckStatus.id
      );

      if (!collector) {
        console.log(`No collector found for truck ${truckStatus.id}`);
        return;
      }

      const isCollecting = truckStatus.isCollecting;
      const isFull = truckStatus.isFull;

      // Add to bounds
      allBounds.extend([truckStatus.latitude, truckStatus.longitude]);
      hasBounds = true;

      const truckIcon = L.divIcon({
        className: 'truck-marker',
        html: `
          <div style="
            background: ${isCollecting ? (isFull ? '#ef4444' : '#16a34a') : '#6b7280'};
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">
            🚛 ${collector.truckNo || truckStatus.id}
          </div>
        `,
        iconSize: [100, 30],
        iconAnchor: [50, 15]
      });

      const marker = L.marker([truckStatus.latitude, truckStatus.longitude], { icon: truckIcon });
      
      if (mapRef.current) {
        marker.addTo(mapRef.current);
      }

      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <strong>Truck: ${collector.truckNo || truckStatus.id}</strong><br/>
        Collector: ${collector.name}<br/>
        Status: ${isCollecting ? (isFull ? 'Full' : 'Collecting') : 'Stopped'}<br/>
      `;
      
      const button = document.createElement('button');
      button.textContent = isCollecting ? 'Stop Collecting' : 'Start Collecting';
      button.style.cssText = 'margin-top: 8px; padding: 6px 12px; background: ' + (isCollecting ? '#ef4444' : '#16a34a') + '; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;';
      button.onclick = async () => {
        try {
          const collector = collectors.find(c => 
            c.truckNo === truckStatus.id || c.id === truckStatus.updatedBy
          );
          if (!collector) {
            alert('Collector not found');
            return;
          }

          const currentStatus = truckStatuses.find(ts => ts.id === truckStatus.id);
          if (!currentStatus) {
            alert('Truck status not found');
            return;
          }

          await updateTruckStatus(truckStatus.id, {
            isCollecting: !isCollecting,
            isFull: !isCollecting ? false : currentStatus.isFull,
            latitude: currentStatus.latitude,
            longitude: currentStatus.longitude
          });

          alert(`Truck ${!isCollecting ? 'started' : 'stopped'} collecting successfully`);
          await loadMapData();
        } catch (error: any) {
          console.error('Failed to update truck status:', error);
          alert(error.message || 'Failed to update truck status');
        }
      };
      popupContent.appendChild(button);
      
      marker.bindPopup(popupContent);

      truckMarkersRef.current.set(truckStatus.id, marker);
      console.log(`Truck marker added: ${collector.truckNo || truckStatus.id} at ${truckStatus.latitude}, ${truckStatus.longitude}`);
    });

    // Fit map to show all routes and trucks
    if (hasBounds && mapRef.current && allBounds.isValid()) {
      try {
        mapRef.current.fitBounds(allBounds, { padding: [50, 50], maxZoom: 15 });
        console.log('Map bounds fitted to show all routes and trucks');
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    } else if (!hasBounds) {
      console.warn('No bounds to fit - no routes or trucks with coordinates');
    }

    // Render collection status markers
    const today = new Date().toISOString().split('T')[0];
    collectionStatuses
      .filter(cs => cs.collectionDate === today)
      .forEach(cs => {
        // Find corresponding schedule using scheduleId
        const schedule = schedules.find(s => s.id === cs.scheduleId);

        if (schedule && schedule.latitude && schedule.longitude && schedule.latitude.length > 0) {
          // Use first coordinate of route as marker location
          const lat = schedule.latitude[0];
          const lng = schedule.longitude[0];

          const statusIcon = L.divIcon({
            className: 'collection-status-marker',
            html: `
              <div style="
                background: ${cs.status === 'collected' ? '#10b981' : cs.status === 'skipped' || cs.status === 'missed' ? '#f59e0b' : '#3b82f6'};
                color: white;
                padding: 6px 10px;
                border-radius: 16px;
                font-weight: bold;
                font-size: 11px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                ${cs.status === 'collected' ? '✓' : cs.status === 'skipped' || cs.status === 'missed' ? '⚠' : '○'} ${cs.status}
              </div>
            `,
            iconSize: [80, 24],
            iconAnchor: [40, 12]
          });

          const marker = L.marker([lat, lng], { icon: statusIcon })
            .addTo(mapRef.current!);

          const collector = collectors.find(c => c.id === cs.collectorId);
          marker.bindPopup(`
            <strong>${cs.barangayName}${cs.streetName ? ` - ${cs.streetName}` : ''}</strong><br/>
            Status: ${cs.status}<br/>
            Collector: ${collector?.name || 'Unknown'}<br/>
            Date: ${new Date(cs.collectionDate).toLocaleDateString()}
          `);

          collectionMarkersRef.current.set(cs.id, marker);
        }
      });
  };

  const focusOnTruck = (truckStatus: TruckStatus) => {
    if (!mapRef.current || !truckStatus.latitude || !truckStatus.longitude) return;
    
    mapRef.current.setView([truckStatus.latitude, truckStatus.longitude], 15, {
      animate: true,
      duration: 0.5
    });
    
    // Open popup for the truck marker
    const marker = truckMarkersRef.current.get(truckStatus.id);
    if (marker) {
      marker.openPopup();
    }
    
    setSelectedItem({ type: 'truck', id: truckStatus.id });
  };

  const focusOnRoute = (schedule: Schedule) => {
    if (!mapRef.current) return;
    
    const routeLatitudes = schedule.latitude || [];
    const routeLongitudes = schedule.longitude || [];
    
    if (routeLatitudes.length > 0 && routeLongitudes.length > 0) {
      // Calculate center of route
      let sumLat = 0, sumLng = 0, count = 0;
      const maxLength = Math.max(routeLatitudes.length, routeLongitudes.length);
      
      for (let i = 0; i < maxLength; i++) {
        const lat = routeLatitudes[i];
        const lng = routeLongitudes[i];
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          sumLat += lat;
          sumLng += lng;
          count++;
        }
      }
      
      if (count > 0) {
        const centerLat = sumLat / count;
        const centerLng = sumLng / count;
        
        mapRef.current.setView([centerLat, centerLng], 14, {
          animate: true,
          duration: 0.5
        });
        
        // Highlight the route polyline
        const polyline = routePolylinesRef.current.get(schedule.id);
        if (polyline) {
          polyline.setStyle({ weight: 8, opacity: 1 });
          polyline.openPopup();
          
          // Revert after 3 seconds
          setTimeout(() => {
            const routeStatus = getRouteStatus(schedule);
            polyline.setStyle({ 
              color: routeStatus.color, 
              weight: 5, 
              opacity: 0.8 
            });
          }, 3000);
        }
      }
    }
    
    setSelectedItem({ type: 'route', id: schedule.id });
  };

  // Filter trucks and routes based on search
  const filteredTrucks = truckStatuses.filter(truckStatus => {
    if (!searchQuery) return true;
    const collector = collectors.find(c => 
      c.id === truckStatus.updatedBy || 
      c.truckNo === truckStatus.id
    );
    const searchLower = searchQuery.toLowerCase();
    return (
      (collector?.name || '').toLowerCase().includes(searchLower) ||
      (collector?.truckNo || truckStatus.id || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredRoutes = schedules.filter(schedule => {
    if (!searchQuery) return true;
    const collector = collectors.find(c => c.id === schedule.collector_id);
    const barangayName = Array.isArray(schedule.barangay_name) 
      ? schedule.barangay_name[0] 
      : schedule.barangay_name || '';
    const streetName = Array.isArray(schedule.street_name) 
      ? schedule.street_name.join(', ') 
      : schedule.street_name || '';
    const searchLower = searchQuery.toLowerCase();
    return (
      (collector?.name || '').toLowerCase().includes(searchLower) ||
      (schedule.truck_no || collector?.truckNo || '').toLowerCase().includes(searchLower) ||
      barangayName.toLowerCase().includes(searchLower) ||
      streetName.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="error">Failed to load dashboard data</div>;
  }

  const statCards = [
    { 
      label: 'Total Users', 
      value: stats.totalUsers, 
      icon: '👥', 
      bgColor: '#dbeafe',
      accentColor: '#3b82f6',
      onClick: () => navigate('/users')
    },
    { 
      label: 'Residents', 
      value: stats.totalResidents, 
      icon: '🏠', 
      bgColor: '#fed7aa',
      accentColor: '#f97316',
      onClick: () => navigate('/users?role=resident')
    },
    { 
      label: 'Collectors', 
      value: stats.totalCollectors, 
      icon: '🗑️', 
      bgColor: '#dbeafe',
      accentColor: '#3b82f6',
      onClick: () => navigate('/users?role=collector')
    },
    { 
      label: 'Admins', 
      value: stats.totalAdmins, 
      icon: '👑', 
      bgColor: '#fef3c7',
      accentColor: '#eab308',
      onClick: () => navigate('/users?role=admin')
    },
    { 
      label: 'Pending Registrations', 
      value: stats.pendingRegistrations, 
      icon: '📄', 
      bgColor: '#dbeafe',
      accentColor: '#3b82f6',
      onClick: () => navigate('/registrations')
    },
    { 
      label: 'Total Reports', 
      value: stats.totalReports, 
      icon: '📄', 
      bgColor: '#fee2e2',
      accentColor: '#ef4444',
      onClick: () => navigate('/reports')
    },
    { 
      label: 'Pending Reports', 
      value: stats.pendingReports, 
      icon: '⚠️', 
      bgColor: '#fef3c7',
      accentColor: '#eab308',
      onClick: () => navigate('/reports?filter=pending')
    },
    { 
      label: 'Resolved Reports', 
      value: stats.resolvedReports, 
      icon: '✅', 
      bgColor: '#d1fae5',
      accentColor: '#10b981',
      onClick: () => navigate('/reports?filter=resolved')
    },
    { 
      label: 'Active Trucks', 
      value: stats.activeTrucks, 
      icon: '🚛', 
      bgColor: '#fed7aa',
      accentColor: '#f97316',
      onClick: () => navigate('/trucks')
    },
    { 
      label: 'Total Trucks', 
      value: stats.totalTrucks, 
      icon: '🚛', 
      bgColor: '#d1fae5',
      accentColor: '#16a34a',
      onClick: () => navigate('/trucks')
    },
    { 
      label: "Collectors' Attendance", 
      value: '-', 
      icon: '✓', 
      bgColor: '#e9d5ff',
      accentColor: '#a855f7',
      onClick: () => navigate('/collectors-attendance')
    },
    { 
      label: 'Schedules', 
      value: schedules.length, 
      icon: '📅', 
      bgColor: '#dbeafe',
      accentColor: '#3b82f6',
      onClick: () => navigate('/schedules')
    },
    { 
      label: 'Collection Status', 
      value: collectionStatuses.length, 
      icon: '📊', 
      bgColor: '#e9d5ff',
      accentColor: '#a855f7',
      onClick: () => navigate('/collection-status')
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-background">W.A.T.C.H.</div>
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <div className="dashboard-icon-container">
            <div className="dashboard-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white"/>
              </svg>
            </div>
          </div>
          <div>
            <h1>Dashboard</h1>
            <p>Overview of your Waste Collection Management System</p>
          </div>
        </div>
      </div>

      {/* Stats Slider */}
      <div className="stats-slider-container">
        <div className="stats-slider">
          {statCards.map((card) => (
            <div 
              key={card.label} 
              className="stat-slide"
              style={{
                '--card-bg': card.bgColor,
                '--accent': card.accentColor,
              } as React.CSSProperties}
              onClick={card.onClick}
            >
              <div className="stat-icon">
                {card.icon}
              </div>
              <div className="stat-content">
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Section with Sidebar */}
      <div className="dashboard-map-section">
        <div className="map-header">
          <h2>Collection Routes & Status</h2>
          <div className="map-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#16a34a' }}></div>
              <span>Scheduled Today</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#10b981' }}></div>
              <span>Done</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#3b82f6' }}></div>
              <span>In Progress</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#f59e0b' }}></div>
              <span>Skipped</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#6b7280' }}></div>
              <span>Scheduled (Other Days)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#16a34a', borderRadius: '50%' }}></div>
              <span>Truck Collecting</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#ef4444', borderRadius: '50%' }}></div>
              <span>Truck Full</span>
            </div>
          </div>
        </div>
        
        <div className="map-container-wrapper">
          {/* Sidebar */}
          <div className="map-sidebar">
            <div className="sidebar-search">
              <input
                type="text"
                placeholder="Search trucks or routes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search-input"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="sidebar-filters">
              <button
                className={`sidebar-filter-btn ${sidebarFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSidebarFilter('all')}
              >
                All
              </button>
              <button
                className={`sidebar-filter-btn ${sidebarFilter === 'trucks' ? 'active' : ''}`}
                onClick={() => setSidebarFilter('trucks')}
              >
                Trucks
              </button>
              <button
                className={`sidebar-filter-btn ${sidebarFilter === 'routes' ? 'active' : ''}`}
                onClick={() => setSidebarFilter('routes')}
              >
                Routes
              </button>
            </div>
            
            <div className="sidebar-content">
              {/* Trucks Section */}
              {(sidebarFilter === 'all' || sidebarFilter === 'trucks') && (
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">Trucks ({filteredTrucks.length})</h3>
                  <div className="sidebar-items">
                    {filteredTrucks.map((truckStatus) => {
                      const collector = collectors.find(c => 
                        c.id === truckStatus.updatedBy || 
                        c.truckNo === truckStatus.id
                      );
                      if (!collector) return null;
                      
                      const isCollecting = truckStatus.isCollecting;
                      const isFull = truckStatus.isFull;
                      const isSelected = selectedItem?.type === 'truck' && selectedItem.id === truckStatus.id;
                      
                      const handleStartStop = async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        try {
                          const currentStatus = truckStatuses.find(ts => ts.id === truckStatus.id);
                          if (!currentStatus) {
                            alert('Truck status not found');
                            return;
                          }

                          await updateTruckStatus(truckStatus.id, {
                            isCollecting: !isCollecting,
                            isFull: !isCollecting ? false : currentStatus.isFull,
                            latitude: currentStatus.latitude,
                            longitude: currentStatus.longitude
                          });

                          alert(`Truck ${!isCollecting ? 'started' : 'stopped'} collecting successfully`);
                          await loadMapData();
                        } catch (error: any) {
                          console.error('Failed to update truck status:', error);
                          alert(error.message || 'Failed to update truck status');
                        }
                      };
                      
                      return (
                        <div
                          key={truckStatus.id}
                          className={`sidebar-item ${isSelected ? 'selected' : ''}`}
                        >
                          <div onClick={() => focusOnTruck(truckStatus)} style={{ cursor: 'pointer' }}>
                            <div className="sidebar-item-header">
                              <div className="sidebar-item-icon" style={{
                                background: isCollecting ? (isFull ? '#ef4444' : '#16a34a') : '#6b7280'
                              }}>
                                🚛
                              </div>
                              <div className="sidebar-item-info">
                                <div className="sidebar-item-title">{collector.truckNo || truckStatus.id}</div>
                                <div className="sidebar-item-subtitle">{collector.name}</div>
                              </div>
                            </div>
                            <div className="sidebar-item-details">
                              <span className={`status-badge ${isCollecting ? (isFull ? 'full' : 'collecting') : 'stopped'}`}>
                                {isCollecting ? (isFull ? 'Full' : 'Collecting') : 'Stopped'}
                              </span>
                              {truckStatus.latitude && truckStatus.longitude && (
                                <span className="location-badge">
                                  📍 {truckStatus.latitude.toFixed(4)}, {truckStatus.longitude.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            className="sidebar-collection-btn"
                            onClick={handleStartStop}
                            style={{
                              background: isCollecting ? '#ef4444' : '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              padding: '0.5rem 1rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              width: '100%',
                              marginTop: '0.75rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.9';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {isCollecting ? '⏹ Stop Collecting' : '▶ Start Collecting'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Routes Section */}
              {(sidebarFilter === 'all' || sidebarFilter === 'routes') && (
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">Routes ({filteredRoutes.length})</h3>
                  <div className="sidebar-items">
                    {filteredRoutes.map((schedule) => {
                      const collector = collectors.find(c => c.id === schedule.collector_id);
                      const barangayName = Array.isArray(schedule.barangay_name) 
                        ? schedule.barangay_name[0] 
                        : schedule.barangay_name || 'Unknown';
                      const streetName = Array.isArray(schedule.street_name) 
                        ? schedule.street_name.join(', ') 
                        : schedule.street_name || '';
                      const routeStatus = getRouteStatus(schedule);
                      const isSelected = selectedItem?.type === 'route' && selectedItem.id === schedule.id;
                      
                      return (
                        <div
                          key={schedule.id}
                          className={`sidebar-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => focusOnRoute(schedule)}
                        >
                          <div className="sidebar-item-header">
                            <div className="sidebar-item-icon" style={{
                              background: routeStatus.color
                            }}>
                              🛣️
                            </div>
                            <div className="sidebar-item-info">
                              <div className="sidebar-item-title">
                                {barangayName}{streetName ? ` - ${streetName}` : ''}
                              </div>
                              <div className="sidebar-item-subtitle">
                                {collector?.name || 'Unknown'} • {schedule.truck_no || collector?.truckNo || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="sidebar-item-details">
                            <span className="status-badge" style={{ background: routeStatus.color, color: 'white' }}>
                              {routeStatus.status === 'today' ? 'Scheduled Today' :
                               routeStatus.status === 'done' ? 'Done' :
                               routeStatus.status === 'skipped' ? 'Skipped' :
                               routeStatus.status === 'completed' ? 'In Progress' :
                               'Scheduled'}
                            </span>
                            <span className="time-badge">
                              ⏰ {schedule.collection_time || '08:00'}
                            </span>
                            <span className="days-badge">
                              📅 {schedule.days.join(', ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Map */}
          <div className="map-wrapper">
            <div ref={mapContainerRef} className="dashboard-map" id="dashboard-map-container" />
          </div>
        </div>
      </div>
    </div>
  );
}
