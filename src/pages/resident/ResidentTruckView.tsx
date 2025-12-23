// src/pages/resident/ResidentTruckView.tsx

import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonText, IonToast } from '@ionic/react';
import { arrowBackOutline, busOutline, searchOutline, locationOutline, timeOutline, calendarOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { databaseService } from '../../services/database';
import NotificationBell from '../../components/NotificationBell';
import RefreshButton from '../../components/RefreshButton';
import ThemeToggle from '../../components/ThemeToggle';
import { calculateDistance, isValidCoordinate } from '../../utils/coordinates';
import { getCurrentUserId } from '../../utils/auth';
import useCurrentUser from '../../state/useCurrentUser';
import { requestGeolocation } from '../../utils/geolocation';
import {
  initializeResidentNotifications,
  checkTruckProximity,
  checkReportStatusChanges,
  resetTruckNotifications,
} from '../../services/residentNotificationService';
import { supabase } from '../../services/supabase';

const ResidentTruckView: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { user } = useCurrentUser();
  const mapRef = useRef<L.Map | null>(null);
  const truckMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const residentMarkerRef = useRef<L.Marker | null>(null); // Reference to resident location marker
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map()); // Reference to route polylines
  const updateIntervalRef = useRef<number | null>(null);
  const previousTruckStatusesRef = useRef<Map<string, { isCollecting: boolean; isFull: boolean }>>(new Map());
  const initialLoadCompleteRef = useRef<boolean>(false); // Track if initial load is complete
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  
  // Toast state for notifications
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Map and data state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]); // Only routes scheduled for today
  const [collectors, setCollectors] = useState<any[]>([]);
  const [collectionStatuses, setCollectionStatuses] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ type: 'route', id: string } | null>(null);

  // Handle report button click with authentication check
  const handleReportClick = (truckNo: string) => {
    if (!user) {
      setToastMessage('You must log in first before accessing this feature.');
      setShowToast(true);
      return;
    }
    history.push({
      pathname: '/resident/report',
      state: { truckNo: truckNo }
    });
  };
  
  // Resident location and proximity tracking
  const residentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const notifiedTrucksRef = useRef<Set<string>>(new Set()); // Track which trucks have already notified
  const NOTIFICATION_RADIUS_METERS = 400; // 400 meters radius
  const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - if no update in 5 min, consider offline

  // Create truck icons with dynamic truck number (matching collector side design)
  const createTruckIcon = (isRed: boolean, truckNumber: string) => {
    return L.divIcon({
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 28px;">🚛</div>
          <div style="background: ${isRed ? '#ef4444' : '#1a1a1a'}; color: ${isRed ? 'white' : '#ffffff'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.5); border: 1px solid ${isRed ? '#ef4444' : '#2a2a2a'}; white-space: nowrap;">
            ${truckNumber}
          </div>
        </div>
      `,
      className: isRed ? 'watch-truck-icon watch-truck-icon--red' : 'watch-truck-icon watch-truck-icon--white',
      iconSize: [60, 50],
      iconAnchor: [30, 45],
    });
  };

  // Create people icon for resident location
  const createPeopleIcon = () => {
    return L.divIcon({
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: #3b82f6;
          border-radius: 50%;
          border: 3px solid #22c55e;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          <div style="font-size: 24px; line-height: 1;">👤</div>
        </div>
      `,
      className: 'resident-location-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
  };

  // Create truck popup with report functionality
  const createTruckPopup = (truckNo: string, collectorName: string, isFull: boolean, lat: number, lng: number, isOnline: boolean = true) => {
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 12px;
      padding: 0;
      min-width: 220px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    popupContent.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e5e7eb;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="font-size: 1.2rem;">🚛</div>
          <div style="font-weight: 600; font-size: 0.9rem; color: #1f2937;">Truck Information</div>
        </div>
        <button 
          id="truck-close-btn-${truckNo}"
          style="
            background: none;
            border: none;
            font-size: 1.2rem;
            color: #6b7280;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          "
          onmouseover="this.style.color='#1f2937'"
          onmouseout="this.style.color='#6b7280'"
        >×</button>
      </div>
      <div style="padding: 0.75rem 1rem;">
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;">
          <strong style="color: #1f2937;">Truck No:</strong> 
          <span style="color: #1f2937;">${truckNo}</span>
        </div>
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;">
          <strong style="color: #1f2937;">Collector:</strong> 
          <span style="color: #1f2937;">${collectorName || 'N/A'}</span>
        </div>
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;">
          <strong style="color: #1f2937;">Truck Size:</strong> 
          <span style="color: #1f2937;">Large</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.5rem;">
          <span style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${isFull ? '#ef4444' : '#16a34a'};
            display: inline-block;
          "></span>
          <span style="color: ${isFull ? '#ef4444' : '#16a34a'}; font-weight: 500;">
            ${isFull ? 'Full' : 'Available'}
          </span>
        </div>
        <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem;">
          Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 0.75rem;">
          <span style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${isOnline ? '#16a34a' : '#6b7280'};
            display: inline-block;
          "></span>
          <span style="color: ${isOnline ? '#16a34a' : '#6b7280'}; font-weight: 500;">
            ${isOnline ? 'Online (Real-time GPS)' : 'Offline'}
          </span>
        </div>
        <button 
          id="truck-report-btn-${truckNo}"
          style="
            width: 100%;
            padding: 0.6rem 1rem;
            background: #16a34a;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            margin-top: 0.5rem;
          "
        >⚠️ Report Issue</button>
      </div>
    `;
    
    return popupContent;
  };

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;

    // Invalidate map size to fix rendering issues (ensures full container size is used)
    // Use multiple attempts with delays to handle various timing scenarios
    const fixMapSize = () => {
      if (!mapRef.current) return;
      
      // Immediate invalidation
      mapRef.current.invalidateSize();
      
      // Delayed invalidations to catch layout changes
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 100);
      
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 300);
      
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 500);
    };

    // Fix size after a brief delay to ensure container has dimensions
    requestAnimationFrame(() => {
      setTimeout(fixMapSize, 50);
    });

    // Also fix size when window becomes visible (handles tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mapRef.current) {
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityHandlerRef.current = handleVisibilityChange;

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Load and display all collector trucks on the map
      const loadAllTrucks = async () => {
        try {
          await databaseService.init();
          
          // Get all collector accounts
          const collectors = await databaseService.getAccountsByRole('collector');
          
          // Batch check login status for all collectors (more efficient)
          const collectorIds = collectors.map(c => c.id).filter(Boolean) as string[];
          const loginStatusMap = await databaseService.getUsersOnlineStatus(collectorIds);
          
          const truckPositions: L.LatLngExpression[] = [];
          
          // Add markers for all collector trucks (only those with valid accounts and truck numbers)
          for (const collector of collectors) {
            // Only show trucks that have valid accounts with truck numbers
            if (collector.id && collector.truckNo && collector.truckNo.trim() !== '') {
              // Check if marker already exists (avoid duplicates from periodic updates)
              if (truckMarkersRef.current.has(collector.truckNo)) {
                console.log(`Truck ${collector.truckNo} already on map, skipping initial load`);
                continue;
              }
              
              // Get truck status
              const status = await databaseService.getTruckStatus(collector.truckNo);
              console.log(`Truck ${collector.truckNo} status:`, status);
              
              // Show trucks that are actively collecting OR full OR stopped (stopped trucks show at default location)
              // Only skip if status doesn't exist at all
              if (!status) {
                console.log(`Skipping truck ${collector.truckNo} - no status found`);
                // Update previous status for trucks that are not visible
                previousTruckStatusesRef.current.set(collector.truckNo, {
                  isCollecting: false,
                  isFull: false
                });
                continue;
              }
              console.log(`Adding truck ${collector.truckNo} to map - is collecting`);
              const isFull = status.isFull || false;
              
              // Update previous status for trucks that are visible
              previousTruckStatusesRef.current.set(collector.truckNo, {
                isCollecting: status.isCollecting || false,
                isFull: status.isFull || false
              });
              
              // Check if collector is online (check both login status and recent update)
              const now = new Date().getTime();
              const lastUpdate = new Date(status.updatedAt).getTime();
              const timeSinceUpdate = now - lastUpdate;
              
              // Get collector's login status from the batch map (already loaded)
              const isLoggedIn = loginStatusMap.get(collector.id) || false;
              
              // Collector is online if: logged in AND updated recently (< 5 min)
              const isOnline = isLoggedIn && timeSinceUpdate < OFFLINE_THRESHOLD_MS;
              
              // Truck must have valid GPS coordinates AND be online to show on map
              // If no valid GPS or offline, skip this truck (no default location)
              if (!isOnline || status.latitude === undefined || status.longitude === undefined || 
                  !isValidCoordinate(status.latitude, status.longitude)) {
                // No valid GPS or offline - skip this truck
                console.log(`Skipping truck ${collector.truckNo} - offline or no valid GPS coordinates`);
                continue;
              }
              
              // Collector is online with valid GPS - use actual coordinates
              const truckLat = status.latitude;
              const truckLng = status.longitude;
              console.log(`Using GPS coordinates for truck ${collector.truckNo} (ONLINE):`, truckLat, truckLng);
              
              const icon = createTruckIcon(isFull, collector.truckNo);
              const marker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current!);
              
              // Track previous status for newly added trucks
              previousTruckStatusesRef.current.set(collector.truckNo, {
                isCollecting: status.isCollecting || false,
                isFull: status.isFull || false
              });
              
              // Create popup with report functionality (pass online status)
              const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, truckLat, truckLng, isOnline);
              marker.bindPopup(popupContent, {
                className: 'custom-truck-popup',
                closeButton: false,
              });
              
              // Add click handlers for report button and close button
              marker.on('popupopen', () => {
                // Report button handler
                const reportBtn = document.getElementById(`truck-report-btn-${collector.truckNo}`);
                if (reportBtn) {
                  reportBtn.onclick = () => {
                    handleReportClick(collector.truckNo || '');
                  };
                }
                
                // Close button handler
                const closeBtn = document.getElementById(`truck-close-btn-${collector.truckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    marker.closePopup();
                  };
                }
              });
              
              // Store marker reference
              truckMarkersRef.current.set(collector.truckNo, marker);
              truckPositions.push([truckLat, truckLng]);
              
              // Check proximity when marker is first added (only for collecting trucks)
              if (status.isCollecting && residentLocationRef.current) {
                const userId = getCurrentUserId();
                if (userId) {
                  checkTruckProximity(
                    userId,
                    residentLocationRef.current.lat,
                    residentLocationRef.current.lng,
                    collector.truckNo,
                    truckLat,
                    truckLng,
                    collector.name || 'Collector'
                  );
                }
              }
            }
          }
          
          // Load and draw routes on map
          try {
            const { data: schedulesData } = await supabase
              .from('collection_schedules')
              .select('*');
            
            if (schedulesData && mapRef.current) {
              drawRoutesOnMap(schedulesData);
            }
          } catch (error) {
            console.error('Error loading routes for map:', error);
          }
          
          // Focus map on routes instead of trucks or resident location
          if (mapRef.current) {
            // Get all route bounds
            const allRouteBounds: L.LatLngBounds | null = null;
            let hasRoutes = false;
            
            // Try to fit bounds to all routes
            const routePoints: L.LatLngExpression[] = [];
            try {
              const { data: schedulesData } = await supabase
                .from('collection_schedules')
                .select('latitude, longitude');
              
              if (schedulesData) {
                schedulesData.forEach((schedule: any) => {
                  const lats = Array.isArray(schedule.latitude) ? schedule.latitude : (schedule.latitude ? [schedule.latitude] : []);
                  const lngs = Array.isArray(schedule.longitude) ? schedule.longitude : (schedule.longitude ? [schedule.longitude] : []);
                  
                  for (let i = 0; i < Math.max(lats.length, lngs.length); i++) {
                    if (lats[i] !== undefined && lngs[i] !== undefined && !isNaN(lats[i]) && !isNaN(lngs[i])) {
                      routePoints.push([lats[i], lngs[i]]);
                      hasRoutes = true;
                    }
                  }
                });
              }
            } catch (error) {
              console.error('Error getting route bounds:', error);
            }
            
            if (hasRoutes && routePoints.length > 0) {
              const bounds = L.latLngBounds(routePoints);
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } else if (truckPositions.length > 0) {
              // Fallback to trucks if no routes
              if (truckPositions.length === 1) {
                mapRef.current.setView(truckPositions[0], 16);
              } else {
                mapRef.current.fitBounds(L.latLngBounds(truckPositions), { padding: [50, 50] });
              }
            } else {
              // Default location if nothing is available
              mapRef.current.setView([14.5995, 120.9842], 13); // Default to Manila area
            }
          }
          
          // Mark initial load as complete
          initialLoadCompleteRef.current = true;
        } catch (error) {
          console.error('Error loading trucks:', error);
          // Don't set default location - just log the error
          initialLoadCompleteRef.current = true; // Still mark as complete to allow updates
        }
      };

      loadAllTrucks();

      // Do not detect GPS location - focus on routes instead
    }, 300);
  };

  // Helper function to get route status for a specific date - updated to use new collection_status schema
  const getRouteStatusForSchedule = (schedule: any, checkDate?: Date): { status: 'today' | 'done' | 'skipped' | 'scheduled' | 'completed' | 'missed'; color: string; displayStatus: string } => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const dateToCheck = checkDate || new Date();
    const dateStr = dateToCheck.toISOString().split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
    const dayAbbr = dateToCheck.toLocaleDateString('en-US', { weekday: 'short' });
    const isScheduledToday = schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr);
    const isToday = dateStr === todayDate;

    const barangayName = Array.isArray(schedule.barangay_name) 
      ? schedule.barangay_name[0] 
      : schedule.barangay_name || '';
    const streetName = Array.isArray(schedule.street_name) 
      ? schedule.street_name[0] 
      : schedule.street_name || '';

    // Check collection status using updated schema (scheduleId + streetName + collectionDate)
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
        return { status: 'done', color: '#10b981', displayStatus: 'completed' }; // Green
      } else if (collectionStatus.status === 'skipped') {
        return { status: 'skipped', color: '#f59e0b', displayStatus: 'skipped' }; // Orange
      } else if (collectionStatus.status === 'missed') {
        return { status: 'missed', color: '#ef4444', displayStatus: 'skipped' }; // Red (display as skipped)
      } else {
        return { status: 'completed', color: '#3b82f6', displayStatus: 'in-progress' }; // Blue (pending/in-progress)
      }
    } else if (isScheduledToday && isToday) {
      return { status: 'today', color: '#16a34a', displayStatus: 'Scheduled Today' }; // Green (scheduled for today)
    } else if (isScheduledToday) {
      return { status: 'scheduled', color: '#6b7280', displayStatus: 'Scheduled' }; // Gray (scheduled for this day but not today)
    } else {
      return { status: 'scheduled', color: '#6b7280', displayStatus: 'Scheduled' }; // Gray (not scheduled for this day)
    }
  };

  // Mark past incomplete/skipped routes as missed
  const markPastIncompleteRoutesAsMissed = async (schedules: any[], collectors: any[]) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDate = today.toISOString().split('T')[0];

      // Get all past dates up to 30 days ago
      const pastDates: string[] = [];
      for (let i = 1; i <= 30; i++) {
        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - i);
        pastDates.push(pastDate.toISOString().split('T')[0]);
      }

      // Get all collection statuses for past dates
      const { data: pastStatuses } = await supabase
        .from('collection_status')
        .select('*')
        .in('collectionDate', pastDates);

      // For each schedule, check if it was scheduled in the past and not completed/skipped
      for (const schedule of schedules) {
        const barangayName = Array.isArray(schedule.barangay_name) 
          ? schedule.barangay_name[0] 
          : schedule.barangay_name || '';
        const streetName = Array.isArray(schedule.street_name) 
          ? schedule.street_name[0] 
          : schedule.street_name || '';

        if (!streetName && !barangayName) continue;

        // Check each past date
        for (const pastDate of pastDates) {
          const pastDateObj = new Date(pastDate);
          const dayAbbr = pastDateObj.toLocaleDateString('en-US', { weekday: 'short' });
          
          // Check if schedule was supposed to run on this day
          if (!schedule.days || !Array.isArray(schedule.days) || !schedule.days.includes(dayAbbr)) {
            continue; // Not scheduled for this day
          }

          // Check if there's already a status for this date
          const existingStatus = pastStatuses?.find(ps => 
            ps.scheduleId === schedule.id &&
            ps.collectionDate === pastDate &&
            (ps.streetName === streetName || 
             (ps.streetId && schedule.street_ids && Array.isArray(schedule.street_ids) && 
              schedule.street_ids.includes(ps.streetId))) &&
            ps.barangayName === barangayName
          );

          // If no status or status is pending (not collected/skipped), mark as missed
          if (!existingStatus || (existingStatus.status !== 'collected' && existingStatus.status !== 'skipped')) {
            const collector = collectors.find(c => c.id === schedule.collector_id);
            const userId = collector?.id || getCurrentUserId() || '';
            const streetId = Array.isArray(schedule.street_id) ? schedule.street_id[0] : schedule.street_id || null;

            if (existingStatus) {
              // Update existing pending status to missed
              await supabase
                .from('collection_status')
                .update({
                  status: 'missed',
                  markedAt: new Date().toISOString(),
                  markedBy: userId,
                  updatedAt: new Date().toISOString()
                })
                .eq('id', existingStatus.id);
            } else {
              // Insert new missed status
              await supabase
                .from('collection_status')
                .insert({
                  id: `${userId}-${schedule.id}-${streetName}-${pastDate}-${Date.now()}-missed`,
                  scheduleId: schedule.id,
                  collectorId: userId,
                  streetName: streetName,
                  streetId: streetId,
                  barangayName: barangayName,
                  collectionDate: pastDate,
                  status: 'missed',
                  markedAt: new Date().toISOString(),
                  markedBy: userId,
                  updatedAt: new Date().toISOString()
                });
            }
          }
        }
      }

      // Reload collection statuses after marking missed
      const { data: updatedStatuses } = await supabase
        .from('collection_status')
        .select('*')
        .gte('collectionDate', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (updatedStatuses) {
        const mappedStatuses = updatedStatuses.map((status: any) => ({
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
        setCollectionStatuses(mappedStatuses);
      }
    } catch (error) {
      console.error('Error marking past incomplete routes as missed:', error);
    }
  };

  // Function to draw routes on map
  const drawRoutesOnMap = (schedulesData: any[]) => {
    if (!mapRef.current) return;

    // Clear existing route polylines
    routePolylinesRef.current.forEach(polyline => {
      if (mapRef.current) {
        mapRef.current.removeLayer(polyline);
      }
    });
    routePolylinesRef.current.clear();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const todayDate = new Date().toISOString().split('T')[0];

    schedulesData.forEach((schedule) => {
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
      
      // Determine route status and color using same logic as admin dashboard
      const routeStatusObj = getRouteStatusForSchedule(schedule);
      const routeColor = routeStatusObj.color;
      
      if (routeLatitudes.length > 0 && routeLongitudes.length > 0) {
        const routePoints: L.LatLngExpression[] = [];
        const maxLength = Math.max(routeLatitudes.length, routeLongitudes.length);
        
        for (let i = 0; i < maxLength; i++) {
          const lat = routeLatitudes[i];
          const lng = routeLongitudes[i];
          if (lat !== undefined && lng !== undefined && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            routePoints.push([lat, lng]);
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
            color: routeColor,
            weight: 5,
            opacity: 0.8,
          });
          if (mapRef.current) {
            polyline.addTo(mapRef.current);
          }

          const popupContent = `
            <div style="padding: 0.5rem;">
              <strong>${barangayName}${streetName ? ` - ${streetName}` : ''}</strong><br/>
              <small>${collector?.name || 'Unknown'} • ${schedule.truck_no || collector?.truckNo || 'N/A'}</small><br/>
              <small>Time: ${schedule.collection_time || '08:00'}</small><br/>
              <small>Days: ${schedule.days?.join(', ') || 'N/A'}</small>
            </div>
          `;
          polyline.bindPopup(popupContent);
          
          routePolylinesRef.current.set(schedule.id, polyline);
        }
      }
    });
  };

  // Check today's schedule and notify if needed
  const checkTodayScheduleAndNotify = async (userId: string) => {
    try {
      await databaseService.init();
      const account = await databaseService.getAccountById(userId);
      if (!account?.barangay) return;

      const today = new Date();
      const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
      
      const { data: todaySchedules } = await supabase
        .from('collection_schedules')
        .select('*');
      
      const relevantSchedules = todaySchedules?.filter((s: any) => {
        const barangayName = Array.isArray(s.barangay_name) ? s.barangay_name[0] : s.barangay_name;
        return s.days.includes(dayAbbr) && barangayName === account.barangay;
      }) || [];

      if (relevantSchedules.length > 0) {
        const scheduleList = relevantSchedules.map((s: any) => {
          const streetName = Array.isArray(s.street_name) ? s.street_name[0] : s.street_name;
          return streetName || 'Collection Route';
        }).join(', ');

        await databaseService.createNotification({
          userId,
          title: '📅 Today\'s Collection Schedule',
          message: `Collection scheduled for today: ${scheduleList}. Time: ${relevantSchedules[0].collection_time || '08:00'}`,
          type: 'info',
          read: false,
          link: '/resident/truck',
        });
      }
    } catch (error) {
      console.error('Error checking today schedule:', error);
    }
  };

  // Update todaySchedules whenever schedules change - but we'll show all schedules in weekly view
  useEffect(() => {
    // For now, we'll use all schedules for the weekly view
    // The filtering will be done in the UI based on selected day
    setTodaySchedules(schedules);
  }, [schedules]);

  // Load schedules and collection statuses - using same approach as admin dashboard
  useEffect(() => {
    const loadSchedulesData = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (!userId) return;
        
        const account = await databaseService.getAccountById(userId);
        if (!account?.barangay) return;

        // Load all data in parallel - same as admin dashboard
        const [schedulesData, collectorsData, collectionStatusData] = await Promise.all([
          supabase.from('collection_schedules').select('*').order('created_at', { ascending: false }),
          databaseService.getAccountsByRole('collector'),
          supabase.from('collection_status').select('*').gte('collectionDate', new Date().toISOString().split('T')[0])
        ]);

        // Filter schedules by barangay (resident-specific)
        let filteredSchedules: any[] = [];
        if (schedulesData.data) {
          filteredSchedules = schedulesData.data.filter((s: any) => {
            const barangayName = Array.isArray(s.barangay_name) ? s.barangay_name[0] : s.barangay_name;
            return barangayName === account.barangay;
          });
          setSchedules(filteredSchedules);
        }

        // Set collectors
        setCollectors(collectorsData);

        // Map collection statuses - updated to use new schema
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
          setCollectionStatuses(mappedStatuses);
        }

        // Mark past incomplete/skipped routes as missed
        await markPastIncompleteRoutesAsMissed(filteredSchedules, collectorsData);
      } catch (error) {
        console.error('Error loading schedules data:', error);
      }
    };

    loadSchedulesData();
    
    // Reload every 30 seconds to keep data fresh - same as admin dashboard
    const interval = setInterval(loadSchedulesData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize resident notifications on mount
  useEffect(() => {
    const initNotifications = async () => {
      const userId = getCurrentUserId();
      if (userId) {
        await initializeResidentNotifications(userId);
        // Check for today's schedule and send notification if needed
        await checkTodayScheduleAndNotify(userId);
      }
    };
    initNotifications();
  }, []);

  // Check URL params for schedule panel (for backward compatibility)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showSchedule') === 'true') {
      // Dispatch event to open global schedule panel
      window.dispatchEvent(new CustomEvent('openSchedulePanel'));
      // Clean up URL param
      history.replace('/resident/truck');
    }
  }, [location.search, history]);

  // Monitor report status changes periodically
  useEffect(() => {
    const checkReports = async () => {
      const userId = getCurrentUserId();
      if (userId) {
        await checkReportStatusChanges(userId);
      }
    };

    // Check immediately
    checkReports();

    // Then check every 30 seconds
    const reportInterval = setInterval(checkReports, 30000);

    return () => clearInterval(reportInterval);
  }, []);

  // Set up periodic status updates for all trucks
  useEffect(() => {
    const updateTruckStatuses = async () => {
      // Skip if map isn't ready yet or initial load hasn't started
      if (!mapRef.current) {
        return;
      }
      
      try {
        await databaseService.init();
        const collectors = await databaseService.getAccountsByRole('collector');
        
        // Batch check login status for all collectors (more efficient)
        const collectorIds = collectors.map(c => c.id).filter(Boolean) as string[];
        const loginStatusMap = await databaseService.getUsersOnlineStatus(collectorIds);
        
        for (const collector of collectors) {
          if (collector.id && collector.truckNo && collector.truckNo.trim() !== '') {
            const status = await databaseService.getTruckStatus(collector.truckNo);
            
            // Get marker reference
            let marker = truckMarkersRef.current.get(collector.truckNo);
            
            // Clean up any duplicate or stale markers for this truck
            if (marker && mapRef.current) {
              // Check if marker is still on the map
              if (!mapRef.current.hasLayer(marker)) {
                // Marker reference is stale, remove it
                truckMarkersRef.current.delete(collector.truckNo);
                marker = undefined;
              }
            }
            
            // If truck is not collecting and not full, remove it from map
            // Keep trucks that are full even if not collecting
            if (!status || (!status.isCollecting && !status.isFull)) {
              // Truck stopped collecting - remove from map (no default location)
              if (marker && mapRef.current) {
                mapRef.current.removeLayer(marker);
                truckMarkersRef.current.delete(collector.truckNo);
              }
              
              // Update previous status
              previousTruckStatusesRef.current.set(collector.truckNo, {
                isCollecting: false,
                isFull: false
              });
              // Remove from notified set when truck stops collecting
              notifiedTrucksRef.current.delete(collector.truckNo);
              continue;
            }
            
            // Update previous status for trucks that are still visible
            previousTruckStatusesRef.current.set(collector.truckNo, {
              isCollecting: status.isCollecting || false,
              isFull: status.isFull || false
            });
            
            if (marker && mapRef.current) {
              const isFull = status.isFull || false;
              
              // Check if collector is online (check both login status and recent update)
              const now = new Date().getTime();
              const lastUpdate = new Date(status.updatedAt).getTime();
              const timeSinceUpdate = now - lastUpdate;
              
              // Get collector's login status from the batch map (already loaded)
              const isLoggedIn = loginStatusMap.get(collector.id) || false;
              
              // Collector is online if: logged in AND updated recently (< 5 min)
              const isOnline = isLoggedIn && timeSinceUpdate < OFFLINE_THRESHOLD_MS;
              
              // Use actual GPS coordinates from truck_status table (not resident GPS)
              // Only update if collector is online and has valid GPS
              if (isOnline && status.latitude !== undefined && status.longitude !== undefined && 
                  isValidCoordinate(status.latitude, status.longitude)) {
                // Use GPS from truck_status table (truck's own GPS)
                const truckLat = status.latitude; // From truck_status table
                const truckLng = status.longitude; // From truck_status table
                
                // Update marker position
                marker.setLatLng([truckLat, truckLng]);
                
                // Check proximity and create notification if within 400m (only for collecting trucks and online)
              if (status.isCollecting && residentLocationRef.current) {
                const userId = getCurrentUserId();
                if (userId) {
                  checkTruckProximity(
                    userId,
                    residentLocationRef.current.lat,
                    residentLocationRef.current.lng,
                    collector.truckNo,
                    truckLat,
                    truckLng,
                    collector.name || 'Collector'
                  );
                }
              }
                
                // Update icon based on status
                const icon = createTruckIcon(isFull, collector.truckNo);
                marker.setIcon(icon);
                
                // Update popup with new status (pass online status)
                const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, truckLat, truckLng, isOnline);
                marker.bindPopup(popupContent, {
                  className: 'custom-truck-popup',
                  closeButton: false,
                });
                
                // Re-add click handlers
                marker.off('popupopen');
                marker.on('popupopen', () => {
                  // Report button handler
                  const reportBtn = document.getElementById(`truck-report-btn-${collector.truckNo}`);
                  if (reportBtn) {
                    reportBtn.onclick = () => {
                      handleReportClick(collector.truckNo || '');
                    };
                  }
                  
                  // Close button handler
                  const closeBtn = document.getElementById(`truck-close-btn-${collector.truckNo}`);
                  if (closeBtn) {
                    closeBtn.onclick = () => {
                      marker.closePopup();
                    };
                  }
                });
              } else {
                // Collector is offline or no valid GPS - remove from map
                console.log(`Removing truck ${collector.truckNo} - offline or no valid GPS`);
                if (marker && mapRef.current) {
                  mapRef.current.removeLayer(marker);
                  truckMarkersRef.current.delete(collector.truckNo);
                }
                continue;
              }
            } else if (!marker && mapRef.current && (status.isCollecting || status.isFull)) {
              // Truck is collecting or full but marker doesn't exist - add it
              // Double-check marker doesn't exist (prevent duplicates from race conditions)
              const existingMarker = truckMarkersRef.current.get(collector.truckNo);
              if (existingMarker && mapRef.current.hasLayer(existingMarker)) {
                console.log(`Truck ${collector.truckNo} marker already exists, skipping creation`);
                continue;
              }
              
              // Check if collector is online (check both login status and recent update)
              const now = new Date().getTime();
              const lastUpdate = new Date(status.updatedAt).getTime();
              const timeSinceUpdate = now - lastUpdate;
              
              // Get collector's login status from the batch map (already loaded)
              const isLoggedIn = loginStatusMap.get(collector.id) || false;
              
              // Collector is online if: logged in AND updated recently (< 5 min)
              const isOnline = isLoggedIn && timeSinceUpdate < OFFLINE_THRESHOLD_MS;
              
              // Only add marker if truck has valid GPS coordinates (don't show without location)
              if (status.latitude === undefined || status.longitude === undefined || 
                  !isValidCoordinate(status.latitude, status.longitude)) {
                console.log(`Skipping truck ${collector.truckNo} - no valid GPS coordinates`);
                continue;
              }
              
              // Use actual GPS coordinates (no default location fallback)
              // Only show truck if it has valid GPS
              const truckLat = status.latitude;
              const truckLng = status.longitude;
              
              // Only show if collector is online (has valid GPS)
              if (!isOnline) {
                console.log(`Skipping truck ${collector.truckNo} - collector is offline`);
                continue;
              }
              
              console.log(`Adding truck ${collector.truckNo} with GPS coordinates (ONLINE):`, truckLat, truckLng);
              const isFull = status.isFull || false;
              const icon = createTruckIcon(isFull, collector.truckNo);
              const newMarker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current);
              
              const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, truckLat, truckLng, isOnline);
              newMarker.bindPopup(popupContent, {
                className: 'custom-truck-popup',
                closeButton: false,
              });
              
              newMarker.on('popupopen', () => {
                const reportBtn = document.getElementById(`truck-report-btn-${collector.truckNo}`);
                if (reportBtn) {
                  reportBtn.onclick = () => {
                    handleReportClick(collector.truckNo || '');
                  };
                }
                
                const closeBtn = document.getElementById(`truck-close-btn-${collector.truckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    newMarker.closePopup();
                  };
                }
              });
              
              truckMarkersRef.current.set(collector.truckNo, newMarker);
              
              // Check proximity when new marker is added (only for collecting trucks and online)
              if (status.isCollecting && isOnline && isValidCoordinate(truckLat, truckLng) && residentLocationRef.current) {
                const userId = getCurrentUserId();
                if (userId) {
                  checkTruckProximity(
                    userId,
                    residentLocationRef.current.lat,
                    residentLocationRef.current.lng,
                    collector.truckNo,
                    truckLat,
                    truckLng,
                    collector.name || 'Collector'
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error updating truck statuses:', error);
      }
    };

    // Wait a bit for initial load, then start periodic updates
    // Initial load is handled by loadAllTrucks() in handleMapReady
    const startDelay = setTimeout(() => {
      updateTruckStatuses(); // Start updates after initial load
    }, 2000); // Wait 2 seconds for initial load to complete
    
    const statusInterval = setInterval(async () => {
      await updateTruckStatuses();
      // Update today's schedules based on current date
      try {
        const today = new Date();
        const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
        setTodaySchedules(prevSchedules => {
          return schedules.filter(s => {
            return s.days && Array.isArray(s.days) && s.days.includes(dayAbbr);
          });
        });
      } catch (error) {
        console.error('Error updating today schedules:', error);
      }
    }, 3000); // Check every 3 seconds for faster updates

    return () => {
      clearTimeout(startDelay);
      clearInterval(statusInterval);
    };
  }, [history]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      truckMarkersRef.current.forEach((marker) => {
        if (mapRef.current) {
          mapRef.current.removeLayer(marker);
        }
      });
      truckMarkersRef.current.clear();
      if (updateIntervalRef.current !== null) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      // Remove visibility change listener if it exists
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };
  }, []);

  // Refresh function - reload all trucks
  const handleRefresh = async () => {
    if (!mapRef.current) return;
    
    // Remove all existing truck markers
    truckMarkersRef.current.forEach((marker) => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    truckMarkersRef.current.clear();
    previousTruckStatusesRef.current.clear();
    
    // Reload all trucks by calling handleMapReady logic
    await handleMapReady(mapRef.current);
    
    // Reload resident location
    const userId = getCurrentUserId();
    if (userId) {
      await initializeResidentNotifications(userId);
    }
  };

  const AnyMapView = MapView as React.ComponentType<any>;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton 
              onClick={() => history.goBack()}
              style={{
                minWidth: '48px',
                height: '48px',
              }}
            >
              <IonIcon icon={arrowBackOutline} style={{ fontSize: '1.75rem' }} />
            </IonButton>
          </IonButtons>
          <IonTitle>Track Truck</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
            <RefreshButton onRefresh={handleRefresh} variant="header" />
            <NotificationBell />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ position: 'relative', height: '100%', background: 'var(--app-bg-primary)' }}>
          {/* Map section - full screen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 0,
              transition: 'bottom 0.3s ease',
            }}
          >
            <AnyMapView id="resident-truck-map" center={[14.683726, 121.076224]} zoom={16} onMapReady={handleMapReady} />
          </div>

        </div>
      </IonContent>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="top"
        color="medium"
      />
    </IonPage>
  );
};

export default ResidentTruckView;

