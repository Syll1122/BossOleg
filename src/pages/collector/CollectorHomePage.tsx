// src/pages/collector/CollectorHomePage.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonAlert,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { menuOutline, personCircleOutline } from 'ionicons/icons';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { useHistory } from 'react-router-dom';
import { logout, getCurrentUserId } from '../../utils/auth';
import { databaseService } from '../../services/database';
import NotificationBell from '../../components/NotificationBell';
import { requestGeolocation, getGeolocationErrorMessage, isSecureContext } from '../../utils/geolocation';
import RefreshButton from '../../components/RefreshButton';
import { isValidCoordinate } from '../../utils/coordinates';
import { supabase } from '../../services/supabase';

interface ScheduleLocation {
  name: string;
  lat: number;
  lng: number;
}

interface CollectorHomePageProps {
  onStartCollecting: (selectedLocation?: ScheduleLocation, selectedDay?: string | null, dayLocations?: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}>) => void;
  hasStoppedCollecting?: boolean;
  onClearStoppedFlag?: () => void;
  selectedDayFromStack?: string | null;
  dayLocationsFromStack?: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}>;
}

const CollectorHomePage: React.FC<CollectorHomePageProps> = ({ onStartCollecting, hasStoppedCollecting = false, onClearStoppedFlag, selectedDayFromStack, dayLocationsFromStack }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showLocationError, setShowLocationError] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState('');
  const [menuEvent, setMenuEvent] = useState<MouseEvent | null>(null);
  const [truckIsFull, setTruckIsFull] = useState(false);
  const [collectorName, setCollectorName] = useState('Manong Collector');
  const [truckNo, setTruckNo] = useState('BCG 11*4');
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [flagMarker, setFlagMarker] = useState<L.Marker | null>(null);
  const [flagMarkers, setFlagMarkers] = useState<Map<string, L.Marker>>(new Map()); // Store multiple markers by location key
  const [dayLocations, setDayLocations] = useState<Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}>>([]);
  // Temporary storage organized by day: Map<day, Array<locations>>
  const [tempStorage, setTempStorage] = useState<Map<string, Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}>>>(new Map());
  const [routePolylines, setRoutePolylines] = useState<Map<string, L.Polyline>>(new Map()); // Store route polylines by schedule ID
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map()); // Ref to access current polylines in event handlers
  const [viewingDay, setViewingDay] = useState<string | null>(null); // Track which day is being viewed
  const [highlightedPolylineId, setHighlightedPolylineId] = useState<string | null>(null); // Track which polyline is currently highlighted (green)
  const highlightedPolylineIdRef = useRef<string | null>(null); // Ref to access current highlighted ID in event handlers
  
  // Use refs to persist selectedDay and dayLocations across renders (especially for mobile React batching issues)
  const selectedDayRef = useRef<string | null>(null);
  const dayLocationsRef = useRef<Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}>>([]);
  const tempStorageRef = useRef<Map<string, Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}>>>(new Map());
  
  // Sync refs with state to ensure persistence on mobile
  // Always update refs regardless of value to prevent clearing on mobile re-renders
  useEffect(() => {
    // Only update refs if state has a value (don't overwrite with null/empty unless explicitly cleared)
    // This ensures refs persist even if state temporarily becomes null during re-renders
    if (selectedDay !== null && selectedDay !== undefined) {
      selectedDayRef.current = selectedDay;
    }
    // Only update if we have locations - preserve previous ref value if state is temporarily empty
    if (dayLocations.length > 0) {
      dayLocationsRef.current = dayLocations;
    }
    // Always sync tempStorage ref to keep it current
    tempStorageRef.current = tempStorage;
  }, [selectedDay, dayLocations, tempStorage]);
  
  const history = useHistory();

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayAbbreviations: Record<string, string> = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thu',
    'Friday': 'Fri',
    'Saturday': 'Sat'
  };

  // Dynamically adjust map height based on control panel height
  useEffect(() => {
    const adjustMapHeight = () => {
      if (mapContainerRef.current && controlPanelRef.current) {
        const panelHeight = controlPanelRef.current.offsetHeight;
        const mapBottom = panelHeight + 16; // 16px margin
        mapContainerRef.current.style.bottom = `${mapBottom}px`;
        
        // Invalidate map size to ensure it renders correctly
        if (mapRef.current) {
          setTimeout(() => {
            mapRef.current?.invalidateSize();
          }, 50);
        }
      }
    };

    // Adjust on mount and when dependencies change
    adjustMapHeight();

    // Use ResizeObserver to watch for panel height changes
    const resizeObserver = new ResizeObserver(() => {
      adjustMapHeight();
    });

    if (controlPanelRef.current) {
      resizeObserver.observe(controlPanelRef.current);
    }

    // Also adjust on window resize
    window.addEventListener('resize', adjustMapHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', adjustMapHeight);
    };
  }, [selectedDay, dayLocations, tempStorage, hasStoppedCollecting]);

  // Load collector name, truck status, and schedules
  useEffect(() => {
    const loadData = async () => {
      try {
        await databaseService.init();
        
        // Get collector name and truck number
        const userId = getCurrentUserId();
        if (userId) {
          const account = await databaseService.getAccountById(userId);
          if (account) {
            if (account.name) {
              setCollectorName(account.name);
            }
            if (account.truckNo) {
              setTruckNo(account.truckNo);
              
              // Check truck status using the account's truck number
              const status = await databaseService.getTruckStatus(account.truckNo);
              if (status) {
                const isFull = status.isFull || false;
                // Only update if value changed to prevent unnecessary re-renders
                setTruckIsFull(prev => {
                  if (prev !== isFull) {
                    console.log(`Truck ${account.truckNo} status changed - isFull: ${isFull}, isCollecting: ${status.isCollecting}`);
                    return isFull;
                  }
                  return prev;
                });
              } else {
                // No status means truck is not full
                setTruckIsFull(prev => {
                  if (prev !== false) {
                    console.log(`Truck ${account.truckNo} - no status found, setting isFull to false`);
                    return false;
                  }
                  return prev;
                });
              }
            }

            // Load schedules for this collector
            try {
              const collectorSchedules = await databaseService.getSchedulesByCollectorId(userId);
              setSchedules(collectorSchedules);
            } catch (error) {
              console.error('Error loading schedules:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading collector data:', error);
      }
    };

    // Load immediately
    loadData();
    
    // Refresh status periodically to catch updates from route page
    // Use a longer interval to avoid race conditions and reduce flickering
    const statusInterval = setInterval(() => {
      loadData();
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(statusInterval);
  }, []);

  // Auto-load today's schedule when schedules are loaded and no day is selected
  useEffect(() => {
    if (schedules.length > 0 && !selectedDay && !selectedDayRef.current) {
      const today = getTodayDay();
      const dayAbbr = dayAbbreviations[today];
      const isTodayScheduled = schedules.some(schedule => 
        schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr)
      );
      
      if (isTodayScheduled) {
        const todaySchedules = schedules.filter(schedule => 
          schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr)
        );
        
        if (todaySchedules.length > 0) {
          // Auto-select today's schedule
          handleDayClick(today).catch(err => console.error('Error auto-loading today schedule:', err));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules.length]);

  // Load locations when stopping collection - use selectedDay from stack if available
  useEffect(() => {
    if (hasStoppedCollecting && schedules.length > 0) {
      const loadDayLocations = async () => {
        // Use selectedDayFromStack if available, otherwise use selectedDay, otherwise try Monday
        const dayToLoad = selectedDayFromStack || selectedDay || 'Monday';
        
        // Check if the day still exists in schedules before trying to load it
        // This prevents reloading locations for a day that was just removed
        if (!isDayScheduled(dayToLoad)) {
          console.log(`Day ${dayToLoad} no longer scheduled, skipping load`);
          // Clear UI if the day was removed
          if (selectedDay === dayToLoad) {
            setSelectedDay(null);
            setDayLocations([]);
          }
          return;
        }
        
        const daySchedules = getSchedulesForDay(dayToLoad);
        
        if (daySchedules.length > 0) {
          setSelectedSchedule(null);
          setSelectedDay(dayToLoad);
          
          // Extract all locations from all schedules for this day (fresh from database)
          const allLocations: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}> = [];
          daySchedules.forEach(schedule => {
            const locations = extractLocationsFromSchedule(schedule);
            allLocations.push(...locations);
          });
          
          console.log(`Loading ${dayToLoad} locations after stopping collection:`, allLocations);
          
          // Only reload from database if temp storage doesn't already have this day
          // This preserves any DONE removals that haven't been saved to database yet
          setTempStorage(prev => {
            const newMap = new Map(prev);
            // Only set if not already in temp storage (to preserve DONE removals)
            if (!newMap.has(dayToLoad)) {
              newMap.set(dayToLoad, allLocations);
              // Update dayLocations to show the locations
              setDayLocations(allLocations);
            } else {
              // Use existing temp storage data (preserves DONE removals)
              const existingLocations = newMap.get(dayToLoad) || [];
              setDayLocations(existingLocations);
            }
            return newMap;
          });
        } else {
          // If dayLocationsFromStack is provided, use it directly
          if (dayLocationsFromStack && dayLocationsFromStack.length > 0 && selectedDayFromStack) {
            setSelectedDay(selectedDayFromStack);
            setDayLocations(dayLocationsFromStack);
            setTempStorage(prev => {
              const newMap = new Map(prev);
              newMap.set(selectedDayFromStack, dayLocationsFromStack);
              return newMap;
            });
          } else {
            console.log(`No schedules found for ${dayToLoad}`);
          }
        }
      };
      
      // Small delay to ensure state is ready
      setTimeout(loadDayLocations, 100);
    } else if (selectedDayFromStack && dayLocationsFromStack && dayLocationsFromStack.length > 0 && !hasStoppedCollecting) {
      // If we have data from stack and not stopped collecting, restore it
      setSelectedDay(selectedDayFromStack);
      setDayLocations(dayLocationsFromStack);
      setTempStorage(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedDayFromStack, dayLocationsFromStack);
        return newMap;
      });
    }
  }, [hasStoppedCollecting, schedules, selectedDayFromStack, dayLocationsFromStack]);

  // Refresh function - reloads all data except tempStorage
  const handleRefresh = async () => {
    try {
      await databaseService.init();
      
      // Get collector name and truck number
      const userId = getCurrentUserId();
      if (userId) {
        const account = await databaseService.getAccountById(userId);
        if (account) {
          if (account.name) {
            setCollectorName(account.name);
          }
          if (account.truckNo) {
            setTruckNo(account.truckNo);
            
            // Check truck status using the account's truck number
            const status = await databaseService.getTruckStatus(account.truckNo);
            if (status) {
              const isFull = status.isFull || false;
              setTruckIsFull(isFull);
            } else {
              setTruckIsFull(false);
            }
          }

          // Reload schedules for this collector (preserve tempStorage)
          try {
            const collectorSchedules = await databaseService.getSchedulesByCollectorId(userId);
            setSchedules(collectorSchedules);
            
            // If a day is selected, reload locations for that day but preserve tempStorage
            if (selectedDay) {
              const daySchedules = getSchedulesForDay(selectedDay);
              if (daySchedules.length > 0) {
                const allLocations: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}> = [];
                daySchedules.forEach(schedule => {
                  const locations = extractLocationsFromSchedule(schedule);
                  allLocations.push(...locations);
                });
                
                // Only update tempStorage if it doesn't have this day (preserve done removals)
                setTempStorage(prev => {
                  const newMap = new Map(prev);
                  if (!newMap.has(selectedDay)) {
                    newMap.set(selectedDay, allLocations);
                    setDayLocations(allLocations);
                  }
                  return newMap;
                });
              }
            }
          } catch (error) {
            console.error('Error loading schedules:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;

    // Invalidate map size to fix rendering issues (ensures full container size is used)
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

    // Wait a bit for map to be fully ready
    setTimeout(() => {
      // Trucks are no longer displayed on the collector home page
      
      // Get collector location and add radius circle
      if (navigator.geolocation) {
        requestGeolocation(
          (pos) => {
            if (!mapRef.current) return;
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            
            if (isValidCoordinate(userLat, userLng)) {
              const userLatLng: L.LatLngExpression = [userLat, userLng];
              // Add user location marker (blue circle) - user's own location
              L.circleMarker(userLatLng, {
                radius: 8,
                fillColor: '#3b82f6',
                color: '#ffffff',
                weight: 2,
                fillOpacity: 0.8,
              }).bindPopup('Your Location').addTo(mapRef.current);
              
              // Add 400m radius circle for visual reference
              L.circle(userLatLng, {
                radius: 400, // 400 meters
                color: '#16a34a',
                fillColor: '#16a34a',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '5, 5',
              }).bindPopup('400m Notification Radius - Residents within this area will be notified').addTo(mapRef.current);
            }
          },
          (error) => {
            // Silently fail if user location can't be obtained
            console.log('User location not available:', error);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }, 500);
  };

  // Check if a day is scheduled
  const isDayScheduled = (day: string): boolean => {
    const dayAbbr = dayAbbreviations[day];
    return schedules.some(schedule => 
      schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr)
    );
  };

  // Get schedules for a specific day
  const getSchedulesForDay = (day: string): any[] => {
    const dayAbbr = dayAbbreviations[day];
    return schedules.filter(schedule => 
      schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr)
    );
  };

  // Get the first scheduled day of the week
  const getFirstScheduledDay = (): string | null => {
    for (const day of daysOfWeek) {
      if (isDayScheduled(day)) {
        return day;
      }
    }
    return null;
  };

  // Get today's day name
  const getTodayDay = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Get tomorrow's day name (actual next day, not scheduled)
  const getTomorrowDay = (): string | null => {
    const today = getTodayDay();
    const todayIndex = daysOfWeek.indexOf(today);
    
    if (todayIndex === -1) return null; // Today not found in daysOfWeek
    
    // Get next day in the week
    const tomorrowIndex = (todayIndex + 1) % daysOfWeek.length;
    return daysOfWeek[tomorrowIndex];
  };

  // Extract all locations from a schedule (handles arrays and route polylines)
  const extractLocationsFromSchedule = (schedule: any): Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}> => {
    const locations: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}> = [];
    
    console.log('Extracting locations from schedule:', schedule);
    
    // Handle arrays for street_name, street_ids, barangay_name, latitude, longitude
    const streetNames = Array.isArray(schedule.street_name) ? schedule.street_name : (schedule.street_name ? [schedule.street_name] : []);
    const streetIds = Array.isArray(schedule.street_ids) ? schedule.street_ids : (schedule.street_ids ? [schedule.street_ids] : []);
    const barangayNames = Array.isArray(schedule.barangay_name) ? schedule.barangay_name : (schedule.barangay_name ? [schedule.barangay_name] : []);
    const latitudes = Array.isArray(schedule.latitude) ? schedule.latitude : (schedule.latitude !== null && schedule.latitude !== undefined ? [schedule.latitude] : []);
    const longitudes = Array.isArray(schedule.longitude) ? schedule.longitude : (schedule.longitude !== null && schedule.longitude !== undefined ? [schedule.longitude] : []);
    
    console.log('Parsed arrays:', { streetNames, streetIds, barangayNames, latitudes, longitudes });
    
    // Check if this is a route (multiple coordinates forming a polyline)
    const isRoute = latitudes.length > 1 && longitudes.length > 1;
    
    if (isRoute) {
      // This is a route polyline - create route coordinates
      const routeCoordinates: [number, number][] = [];
      for (let i = 0; i < Math.min(latitudes.length, longitudes.length); i++) {
        const lat = Number(latitudes[i]);
        const lng = Number(longitudes[i]);
        if (!isNaN(lat) && !isNaN(lng)) {
          routeCoordinates.push([lat, lng]);
        }
      }
      
      if (routeCoordinates.length > 0) {
        // For routes, create one location entry with route coordinates
        const street = streetNames[0] || '';
        const streetId = streetIds[0] || '';
        const barangay = barangayNames[0] || '';
        
        locations.push({
          street: street,
          barangay: barangay,
          lat: routeCoordinates[0][0], // Start point
          lng: routeCoordinates[0][1],
          scheduleId: schedule.id || '',
          locationIndex: 0,
          streetId: streetId,
          routeCoordinates: routeCoordinates
        });
      }
      return locations;
    }
    
    // Not a route - handle as individual points
    const maxLength = Math.max(streetNames.length, streetIds.length, barangayNames.length, latitudes.length, longitudes.length, 1);
    
    // If no arrays found, try to create at least one location from single values
    if (maxLength === 0) {
      const street = schedule.street_name || '';
      const streetId = schedule.street_ids || '';
      const barangay = schedule.barangay_name || '';
      const lat = schedule.latitude;
      const lng = schedule.longitude;
      
      if ((lat !== null && lat !== undefined) && (lng !== null && lng !== undefined) && (street || barangay)) {
        locations.push({
          street: street || '',
          barangay: barangay || '',
          lat: Number(lat),
          lng: Number(lng),
          scheduleId: schedule.id || '',
          locationIndex: 0,
          streetId: streetId || undefined
        });
      }
      return locations;
    }
    
    // Create location entries for each index
    for (let i = 0; i < maxLength; i++) {
      const street = streetNames[i] || '';
      const streetId = streetIds[i] || '';
      const barangay = barangayNames[i] || (barangayNames[0] || '');
      const lat = latitudes[i] !== null && latitudes[i] !== undefined ? Number(latitudes[i]) : (latitudes[0] !== null && latitudes[0] !== undefined ? Number(latitudes[0]) : null);
      const lng = longitudes[i] !== null && longitudes[i] !== undefined ? Number(longitudes[i]) : (longitudes[0] !== null && longitudes[0] !== undefined ? Number(longitudes[0]) : null);
      
      if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng) && (street || barangay)) {
        locations.push({
          street: street || '',
          barangay: barangay || '',
          lat: lat,
          lng: lng,
          scheduleId: schedule.id || '',
          locationIndex: i,
          streetId: streetId || undefined
        });
      }
    }
    
    console.log('Extracted locations:', locations);
    return locations;
  };

  // Handle day selection - show all locations for that day below Start Collecting button
  const handleDayClick = async (day: string) => {
    try {
      await databaseService.init();
      
      // Check if day exists in the days column
      if (!isDayScheduled(day)) {
        // Day doesn't exist in days column, don't do anything
        console.log(`Day ${day} not scheduled`);
        return;
      }

      const daySchedules = getSchedulesForDay(day);
      if (daySchedules.length > 0) {
        // Clear previous selected schedule
        setSelectedSchedule(null);
        setSelectedDay(day);
        setViewingDay(day);
        
        // Extract all locations from all schedules for this day
        const allLocations: Array<{street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number; streetId?: string; routeCoordinates?: [number, number][]}> = [];
        daySchedules.forEach(schedule => {
          const locations = extractLocationsFromSchedule(schedule);
          allLocations.push(...locations);
        });
        
        console.log('Day selected:', day, 'Locations found:', allLocations);
        
        // If no locations found, remove the day from database
        if (allLocations.length === 0) {
          console.log(`No locations found for ${day}, removing day from database`);
          // Find the schedule that has this day and remove it
          for (const schedule of daySchedules) {
            await removeDayFromSchedule(day, schedule.id);
          }
          // Reload schedules
          const userId = getCurrentUserId();
          if (userId) {
            const collectorSchedules = await databaseService.getSchedulesByCollectorId(userId);
            setSchedules(collectorSchedules);
          }
          return;
        }
        
        // Load into temporary storage for this day
        setTempStorage(prev => {
          const newMap = new Map(prev);
          // Always update temp storage with current locations (overwrite if exists)
          newMap.set(day, allLocations);
          // Also update ref immediately for mobile compatibility
          tempStorageRef.current = newMap;
          return newMap;
        });
        
        // Update dayLocations separately to ensure state update
        setDayLocations(allLocations);
        // Also update refs immediately for mobile compatibility
        dayLocationsRef.current = allLocations;
        selectedDayRef.current = day;
        
        // Render route polylines on map if viewing today's schedule
        renderRoutePolylines(day, daySchedules);
        
        // Close the panel so locations show below Start Collecting button
        setShowSchedulePanel(false);
      } else {
        // No schedules found for this day, remove it from database
        console.log(`No schedules found for ${day}, removing day from database`);
        const dayAbbr = dayAbbreviations[day];
        const schedulesWithDay = schedules.filter(schedule => 
          schedule.days && Array.isArray(schedule.days) && schedule.days.includes(dayAbbr)
        );
        for (const schedule of schedulesWithDay) {
          await removeDayFromSchedule(day, schedule.id);
        }
        // Reload schedules
        const userId = getCurrentUserId();
        if (userId) {
          const collectorSchedules = await databaseService.getSchedulesByCollectorId(userId);
          setSchedules(collectorSchedules);
        }
      }
    } catch (error) {
      console.error('Error in handleDayClick:', error);
    }
  };

  // Render route polylines on map for a specific day
  const renderRoutePolylines = (day: string, daySchedules: any[]) => {
    if (!mapRef.current) return;
    
    // Clear existing polylines first
    routePolylinesRef.current.forEach((polyline) => {
      if (mapRef.current && mapRef.current.hasLayer(polyline)) {
        mapRef.current.removeLayer(polyline);
      }
    });
    routePolylinesRef.current.clear();
    setRoutePolylines(new Map(routePolylinesRef.current));
    highlightedPolylineIdRef.current = null;
    setHighlightedPolylineId(null);
    
    // Render polylines for each schedule with route coordinates
    daySchedules.forEach(schedule => {
      if (schedule.latitude && schedule.longitude && 
          Array.isArray(schedule.latitude) && Array.isArray(schedule.longitude) &&
          schedule.latitude.length > 1 && schedule.longitude.length > 1) {
        
        // Create route coordinates
        const routeCoordinates: [number, number][] = [];
        for (let i = 0; i < Math.min(schedule.latitude.length, schedule.longitude.length); i++) {
          const lat = Number(schedule.latitude[i]);
          const lng = Number(schedule.longitude[i]);
          if (!isNaN(lat) && !isNaN(lng)) {
            routeCoordinates.push([lat, lng]);
          }
        }
        
        if (routeCoordinates.length > 1) {
          // Create polyline with same style as admin panel (always start as blue)
          const polyline = L.polyline(routeCoordinates, {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.7
          }).addTo(mapRef.current!);
          
          // Add click handler to highlight/unhighlight
          polyline.on('click', () => {
            const currentHighlightedId = highlightedPolylineIdRef.current;
            
            // Revert previous highlighted polyline to blue
            if (currentHighlightedId && currentHighlightedId !== schedule.id) {
              const prevPolyline = routePolylinesRef.current.get(currentHighlightedId);
              if (prevPolyline) {
                prevPolyline.setStyle({ color: '#3b82f6' });
              }
            }
            
            // Toggle current polyline: if already highlighted, revert to blue; otherwise highlight in green
            if (currentHighlightedId === schedule.id) {
              polyline.setStyle({ color: '#3b82f6' });
              highlightedPolylineIdRef.current = null;
              setHighlightedPolylineId(null);
            } else {
              polyline.setStyle({ color: '#22c55e' });
              highlightedPolylineIdRef.current = schedule.id;
              setHighlightedPolylineId(schedule.id);
            }
          });
          
          // Add popup with schedule info
          const streetName = Array.isArray(schedule.street_name) 
            ? schedule.street_name[0] 
            : schedule.street_name || 'N/A';
          const barangayName = Array.isArray(schedule.barangay_name) 
            ? schedule.barangay_name[0] 
            : schedule.barangay_name || 'N/A';
          
          polyline.bindPopup(`
            <strong>Route</strong><br/>
            Street: ${streetName}<br/>
            Barangay: ${barangayName}<br/>
            Click to highlight
          `);
          
          // Store polyline in both state and ref
          routePolylinesRef.current.set(schedule.id, polyline);
          setRoutePolylines(new Map(routePolylinesRef.current));
          
          console.log(`Route polyline rendered for schedule ${schedule.id}`);
        }
      }
    });
  };

  // Clear all route polylines from map
  const clearRoutePolylines = () => {
    if (!mapRef.current) return;
    
    routePolylinesRef.current.forEach((polyline) => {
      if (mapRef.current && mapRef.current.hasLayer(polyline)) {
        mapRef.current.removeLayer(polyline);
      }
    });
    
    routePolylinesRef.current.clear();
    setRoutePolylines(new Map());
    highlightedPolylineIdRef.current = null;
    setHighlightedPolylineId(null);
  };

  // Handle marking a location as DONE - remove it from temp storage only (not from database lat/lng)
  const handleLocationDone = async (location: {street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}) => {
    if (!selectedDay) return;
    
    try {
      await databaseService.init();
      
      console.log(`Marking location as DONE: ${location.street} / ${location.barangay} for day ${selectedDay}`);
      
      // FIRST: Remove from temp storage only (do NOT touch database lat/lng/street/barangay)
      const currentLocations = tempStorage.get(selectedDay) || [];
      const updatedLocations = currentLocations.filter(loc => 
        !(loc.scheduleId === location.scheduleId && 
          loc.street === location.street &&
          loc.barangay === location.barangay &&
          Math.abs(loc.lat - location.lat) < 0.0001 && 
          Math.abs(loc.lng - location.lng) < 0.0001)
      );
      
      console.log(`Removed location from temp storage. Remaining: ${updatedLocations.length}`);
      
      // Update temp storage with remaining locations
      setTempStorage(prev => {
        const newMap = new Map(prev);
        if (updatedLocations.length === 0) {
          // If no more locations, delete the day from temp storage
          newMap.delete(selectedDay);
          console.log(`Temp storage cleared for ${selectedDay} - no more locations`);
        } else {
          // Still has locations, update temp storage
          newMap.set(selectedDay, updatedLocations);
        }
        return newMap;
      });
      
      // Update UI to reflect the change
      setDayLocations(updatedLocations);
      
      // If day has no more locations in temp storage, remove the day from database days array
      if (updatedLocations.length === 0) {
        console.log(`All locations done for ${selectedDay}, removing day from database days array...`);
        
        // Store the day before removing it
        const dayToRemove = selectedDay;
        
        // Remove the day from the schedule's days array in database (await to ensure it completes)
        await removeDayFromSchedule(dayToRemove || '', location.scheduleId);
        console.log(`Day ${dayToRemove} removed from database days array`);
        
        // Clear selected day and locations from UI IMMEDIATELY (before reloading schedules)
        // This prevents useEffect from trying to reload the removed day
        setSelectedDay(null);
        setDayLocations([]);
        // Also explicitly clear refs when we intentionally clear state (all locations done)
        selectedDayRef.current = null;
        dayLocationsRef.current = [];
        
        // Remove from temp storage
        setTempStorage(prev => {
          const newMap = new Map(prev);
          newMap.delete(dayToRemove || '');
          return newMap;
        });
      }
      
      // Remove marker from map if it exists - use same key format as handleLocationSelect
      const locationKey = `${location.scheduleId}-${location.locationIndex}-${location.lat}-${location.lng}-${location.street}-${location.barangay}`;
      const marker = flagMarkers.get(locationKey);
      if (marker && mapRef.current && mapRef.current.hasLayer(marker)) {
        mapRef.current.removeLayer(marker);
      }
      setFlagMarkers(prev => {
        const newMap = new Map(prev);
        newMap.delete(locationKey);
        return newMap;
      });
      
      // Only reload schedules if we removed the day from database (not on every DONE click)
      // selectedDay is already cleared above, so useEffect won't reload the removed day
      if (updatedLocations.length === 0) {
        const userId = getCurrentUserId();
        if (userId) {
          const collectorSchedules = await databaseService.getSchedulesByCollectorId(userId);
          setSchedules(collectorSchedules);
        }
      }
    } catch (error) {
      console.error('Error marking location as done:', error);
      alert('Failed to mark location as done. Please try again.');
    }
  };
  
  // Remove a day from a schedule's days array in the database
  const removeDayFromSchedule = async (day: string, scheduleId: string) => {
    try {
      const dayAbbr = dayAbbreviations[day];
      if (!dayAbbr) return;
      
      // Get the current schedule
      const { data: schedule, error: fetchError } = await supabase
        .from('collection_schedules')
        .select('days')
        .eq('id', scheduleId)
        .single();
      
      if (fetchError || !schedule) {
        console.error('Error fetching schedule:', fetchError);
        return;
      }
      
      // Remove the day from the days array
      const currentDays = Array.isArray(schedule.days) ? [...schedule.days] : [];
      const updatedDays = currentDays.filter(d => d !== dayAbbr);
      
      // Update the schedule with the modified days array
      const { error: updateError } = await supabase
        .from('collection_schedules')
        .update({
          days: updatedDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleId);
      
      if (updateError) {
        console.error('Error updating schedule days:', updateError);
      } else {
        console.log(`Removed ${day} from schedule ${scheduleId}`);
      }
    } catch (error) {
      console.error('Error removing day from schedule:', error);
    }
  };

  // Handle location selection from day locations - highlight polyline instead of placing marker
  const handleLocationSelect = (location: {street: string; barangay: string; lat: number; lng: number; scheduleId: string; locationIndex: number}) => {
    if (!mapRef.current) return;
    
    // Get the schedule to check if it has route coordinates (polyline)
    const schedule = schedules.find(s => s.id === location.scheduleId);
    if (!schedule) return;
    
    // Check if this schedule has a route polyline
    const polyline = routePolylinesRef.current.get(location.scheduleId);
    
    if (polyline && mapRef.current.hasLayer(polyline)) {
      // Get current highlighted polyline ID
      const currentHighlightedId = highlightedPolylineIdRef.current;
      
      // Revert previous highlighted polyline to blue (if different)
      if (currentHighlightedId && currentHighlightedId !== location.scheduleId) {
        const prevPolyline = routePolylinesRef.current.get(currentHighlightedId);
        if (prevPolyline) {
          prevPolyline.setStyle({ color: '#3b82f6' });
        }
      }
      
      // Toggle current polyline: if already highlighted, revert to blue; otherwise highlight in green
      if (currentHighlightedId === location.scheduleId) {
        polyline.setStyle({ color: '#3b82f6' });
        highlightedPolylineIdRef.current = null;
        setHighlightedPolylineId(null);
      } else {
        polyline.setStyle({ color: '#22c55e' });
        highlightedPolylineIdRef.current = location.scheduleId;
        setHighlightedPolylineId(location.scheduleId);
        
        // Pan to the route - get bounds of the polyline
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      }
    } else {
      // No polyline found - this might be a single point location
      // Center map on the location coordinates
      mapRef.current.flyTo([location.lat, location.lng], 16);
    }
  };

  // Drop flag on map when Street/Barangay name is clicked
  const handleLocationClick = () => {
    if (!selectedSchedule || !mapRef.current) return;

    // Handle array format for latitude/longitude (get first element if array)
    let lat: number | null = null;
    let lng: number | null = null;
    
    if (Array.isArray(selectedSchedule.latitude) && selectedSchedule.latitude.length > 0) {
      lat = selectedSchedule.latitude[0];
    } else if (typeof selectedSchedule.latitude === 'number') {
      lat = selectedSchedule.latitude;
    }
    
    if (Array.isArray(selectedSchedule.longitude) && selectedSchedule.longitude.length > 0) {
      lng = selectedSchedule.longitude[0];
    } else if (typeof selectedSchedule.longitude === 'number') {
      lng = selectedSchedule.longitude;
    }

    if (!lat || !lng) {
      console.error('Invalid coordinates:', { lat, lng, schedule: selectedSchedule });
      return;
    }

    // Handle array format for barangay_name and street_name
    const barangayName = Array.isArray(selectedSchedule.barangay_name) 
      ? selectedSchedule.barangay_name[0] 
      : selectedSchedule.barangay_name || '';
    const streetName = Array.isArray(selectedSchedule.street_name) 
      ? selectedSchedule.street_name[0] 
      : selectedSchedule.street_name || '';

    // Create a unique key for this location - include scheduleId to ensure uniqueness
    const scheduleId = selectedSchedule.id || '';
    const locationKey = `${scheduleId}-0-${lat}-${lng}-${streetName}-${barangayName}`;
    
    // Check if marker already exists for this location
    const existingMarker = flagMarkers.get(locationKey);
    if (existingMarker && mapRef.current.hasLayer(existingMarker)) {
      // Marker already exists, just center on it and open popup
      mapRef.current.flyTo([lat, lng], 16);
      existingMarker.openPopup();
      return;
    }

    // Create red flag icon
    const flagIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add new flag marker (keep existing ones)
    const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current);
    const displayText = streetName 
      ? `${streetName} / ${barangayName}` 
      : barangayName;
    
    // Create popup with cancel button
    const popupContent = `
      <div style="text-align: center;">
        <strong>Collection Start Point</strong><br/>
        ${displayText}<br/>
        <button id="remove-flag-${locationKey}" style="
          margin-top: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
        ">Remove</button>
      </div>
    `;
    marker.bindPopup(popupContent); // Don't auto-open popup - only show when marker is clicked
    
    // Add click handler for cancel button after popup is opened
    marker.on('popupopen', () => {
      const removeButton = document.getElementById(`remove-flag-${locationKey}`);
      if (removeButton) {
        removeButton.onclick = () => {
          // Remove marker from map
          if (mapRef.current && mapRef.current.hasLayer(marker)) {
            mapRef.current.removeLayer(marker);
          }
          // Remove from flagMarkers state
          setFlagMarkers(prev => {
            const newMap = new Map(prev);
            newMap.delete(locationKey);
            return newMap;
          });
          // Close popup
          marker.closePopup();
        };
      }
    });
    
    // Store the marker (update both flagMarker for backward compatibility and flagMarkers for multiple markers)
    setFlagMarker(marker);
    setFlagMarkers(prev => {
      const newMap = new Map(prev);
      newMap.set(locationKey, marker);
      return newMap;
    });

    // Pan to flag location (use flyTo for smoother animation)
    mapRef.current.flyTo([lat, lng], 16);
  };

  // Auto-place flags for the selected day's schedule using temporary storage
  const autoPlaceFlagsForSelectedDay = () => {
    if (!mapRef.current) {
      console.log('Map not ready yet, retrying...');
      setTimeout(() => autoPlaceFlagsForSelectedDay(), 200);
      return;
    }
    
    // Use selected day
    if (!selectedDay) {
      console.log('No day selected, cannot place flags');
      return;
    }
    
    const dayToUse = selectedDay;
    
    // Get locations from tempStorage first (most reliable), then fallback to dayLocations
    const locationsFromTemp = tempStorage.get(dayToUse) || [];
    const locations = locationsFromTemp.length > 0 ? locationsFromTemp : dayLocations;
    
    console.log(`Auto-placing flags for ${dayToUse}:`, locations);
    console.log('dayLocations count:', dayLocations.length);
    console.log('tempStorage for', dayToUse, ':', locationsFromTemp.length, 'locations');
    console.log('Full tempStorage:', Array.from(tempStorage.entries()).map(([k, v]) => [k, v.length]));
    
    if (locations.length === 0) {
      console.log(`No locations found for ${dayToUse}. dayLocations:`, dayLocations, 'tempStorage:', locationsFromTemp);
      return;
    }
    
    // Create red flag icon
    const flagIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    
    // Place flags for each location from temp storage (only if not already placed)
    locations.forEach((location, index) => {
      // Skip if this is a route location (routes are shown as polylines, not flags)
      if (location.routeCoordinates && location.routeCoordinates.length > 1) {
        console.log(`Skipping flag for route location: ${location.street || location.barangay}`);
        return;
      }
      
      // Use lat and lng directly from location object - ensure they're numbers
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      
      // Validate coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error(`Invalid coordinates for location ${index}:`, location);
        console.error('lat:', location.lat, 'lng:', location.lng, 'type:', typeof location.lat, typeof location.lng);
        return;
      }
      
      // Use the same key format as handleLocationSelect for consistency
      // This ensures uniqueness even if multiple locations have same coordinates
      const locationKey = `${location.scheduleId}-${location.locationIndex}-${lat}-${lng}-${location.street}-${location.barangay}`;
      
      // Skip if marker already exists
      if (flagMarkers.has(locationKey)) {
        console.log('Marker already exists for:', locationKey);
        return;
      }
      
      const displayText = location.street 
        ? `${location.street} / ${location.barangay}` 
        : location.barangay;
      
      console.log(`[${index + 1}/${locations.length}] Placing flag at:`, lat, lng, displayText);
      
      try {
        const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current!);
        console.log(`✓ Flag placed successfully at ${lat}, ${lng}`);
      
      // Create popup with cancel button (don't auto-open)
      const popupContent = `
        <div style="text-align: center;">
          <strong>Collection Start Point</strong><br/>
          ${displayText}<br/>
          <button id="remove-flag-${locationKey}" style="
            margin-top: 0.5rem;
            padding: 0.375rem 0.75rem;
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 600;
          ">Remove</button>
        </div>
      `;
      marker.bindPopup(popupContent); // Don't auto-open popup
      
      // Add click handler for cancel button
      marker.on('popupopen', () => {
        const removeButton = document.getElementById(`remove-flag-${locationKey}`);
        if (removeButton) {
          removeButton.onclick = () => {
            if (mapRef.current && mapRef.current.hasLayer(marker)) {
              mapRef.current.removeLayer(marker);
            }
            setFlagMarkers(prev => {
              const newMap = new Map(prev);
              newMap.delete(locationKey);
              return newMap;
            });
            marker.closePopup();
          };
        }
      });
      
        // Store the marker
        setFlagMarkers(prev => {
          const newMap = new Map(prev);
          newMap.set(locationKey, marker);
          return newMap;
        });
      } catch (error) {
        console.error(`Error placing flag at ${lat}, ${lng}:`, error);
      }
    });
    
    console.log(`Finished placing flags. Total locations processed: ${locations.length}`);
  };

  const requestLocationAndStart = async (retryAttempt: number = 0, useHighAccuracy: boolean = false) => {
    // Check if we're on a secure context (HTTPS or localhost)
    if (!isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setLocationErrorMessage(
        'GPS requires HTTPS. Please access the app via https:// or use localhost.\n\n' +
        'For network access from your phone:\n' +
        '1. Use a service like ngrok (https://ngrok.com) to create an HTTPS tunnel\n' +
        '2. Or set up HTTPS locally using mkcert\n' +
        '3. Or access via localhost on your computer only'
      );
      setShowLocationError(true);
      return;
    }

    // Auto-place flags for all locations from the selected day when starting to collect
    // Only if a day is selected and has locations in temporary storage
    if (selectedDay && dayLocations.length > 0) {
      setTimeout(() => {
        autoPlaceFlagsForSelectedDay();
      }, 100);
    }

    // If truck is full, we'll empty it when route page loads
    // Don't set isFull = false here, let the route page handle it
    // This prevents the button from flickering back to "Start Collecting"

    // Create ScheduleLocation if we have a selected schedule
    let location: ScheduleLocation | undefined = undefined;
    if (selectedSchedule) {
      // Handle array format for latitude/longitude
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (Array.isArray(selectedSchedule.latitude) && selectedSchedule.latitude.length > 0) {
        lat = selectedSchedule.latitude[0];
      } else if (typeof selectedSchedule.latitude === 'number') {
        lat = selectedSchedule.latitude;
      }
      
      if (Array.isArray(selectedSchedule.longitude) && selectedSchedule.longitude.length > 0) {
        lng = selectedSchedule.longitude[0];
      } else if (typeof selectedSchedule.longitude === 'number') {
        lng = selectedSchedule.longitude;
      }

      if (lat && lng) {
        // Handle array format for barangay_name and street_name
        const barangayName = Array.isArray(selectedSchedule.barangay_name) 
          ? selectedSchedule.barangay_name[0] 
          : selectedSchedule.barangay_name || '';
        const streetName = Array.isArray(selectedSchedule.street_name) 
          ? selectedSchedule.street_name[0] 
          : selectedSchedule.street_name || '';
        
        location = {
          name: `${streetName || ''} / ${barangayName || ''}`.trim().replace(/^\/\s*|\s*\/$/g, ''),
          lat: lat,
          lng: lng,
        };
      }
    }

    // Progressive timeout and accuracy settings:
    // - First attempt: Fast, use cached position, low accuracy (5s timeout)
    // - Second attempt: Medium timeout, allow cached, medium accuracy (15s timeout)
    // - Third attempt: Long timeout, fresh position, high accuracy (25s timeout)
    const timeoutValues = [5000, 15000, 25000];
    const maximumAgeValues = [30000, 10000, 0]; // Allow older cached positions on first attempts
    const currentTimeout = timeoutValues[Math.min(retryAttempt, timeoutValues.length - 1)];
    const currentMaximumAge = maximumAgeValues[Math.min(retryAttempt, maximumAgeValues.length - 1)];
    const currentHighAccuracy = retryAttempt >= 1 || useHighAccuracy;

    requestGeolocation(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
        }
        // Start collecting - this will navigate to route page
        // Pass selected day and locations so route page can place flags
        // Route page will set isFull = false and isCollecting = true
        onStartCollecting(location, selectedDay, dayLocations.length > 0 ? dayLocations : (tempStorage.get(selectedDay || '') || []));
      },
      (error) => {
        // Auto-retry up to 2 times with progressive settings
        if (retryAttempt < 2 && error instanceof GeolocationPositionError && error.code === error.TIMEOUT) {
          console.log(`Location request timed out, retrying (attempt ${retryAttempt + 1}/2)...`);
          setTimeout(() => {
            requestLocationAndStart(retryAttempt + 1, true);
          }, 1000); // Wait 1 second before retry
          return;
        }

        // Show error after all retries exhausted or for other errors
        if (error instanceof GeolocationPositionError) {
          let errorMsg = getGeolocationErrorMessage(error);
          if (error.code === error.TIMEOUT) {
            errorMsg += '\n\nTip: Make sure you are outdoors or near a window for better GPS signal.';
          }
          setLocationErrorMessage(errorMsg);
        } else {
          setLocationErrorMessage(error.message || 'Failed to get location. Please try again.');
        }
        setShowLocationError(true);
      },
      { 
        enableHighAccuracy: currentHighAccuracy, 
        timeout: currentTimeout,
        maximumAge: currentMaximumAge
      }
    );
  };

  const AnyMapView = MapView as React.ComponentType<any>;

  return (
    <IonPage>
      <IonContent fullscreen>
        <div
          style={{
            position: 'relative',
            height: '100%',
            background: '#0a0a0a',
          }}
        >
          {/* Map section */}
          <div
            ref={mapContainerRef}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 18px 38px rgba(15, 23, 42, 0.45)',
              zIndex: 0,
            }}
          >
            <AnyMapView id="collector-home-map" center={[14.683726, 121.076224]} zoom={16} onMapReady={handleMapReady} />
          </div>

          {/* Top header overlay */}
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: 0,
              right: 0,
              padding: '0 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                backgroundColor: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid #2a2a2a',
                boxShadow: '0 6px 14px rgba(0, 0, 0, 0.5)',
              }}
            >
              <IonIcon icon={personCircleOutline} style={{ fontSize: '1.6rem', color: '#22c55e' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{collectorName}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <RefreshButton onRefresh={handleRefresh} variant="header" />
              <NotificationBell />
              <IonButton
                fill="clear"
                style={{
                  '--color': '#ffffff',
                  backgroundColor: 'rgba(26, 26, 26, 0.95)',
                  border: '1px solid #2a2a2a',
                  borderRadius: 999,
                  minWidth: 48,
                  height: 48,
                  boxShadow: '0 6px 14px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => setMenuEvent(e.nativeEvent)}
              >
                <IonIcon icon={menuOutline} style={{ fontSize: '1.75rem' }} />
              </IonButton>
            </div>
          </div>

          {/* Bottom sheet with schedule & start button */}
          <div
            ref={controlPanelRef}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '1.25rem 1rem 1.5rem',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              background: '#141414',
              border: '1px solid #2a2a2a',
              borderBottom: 'none',
              boxShadow: '0 -14px 32px rgba(0, 0, 0, 0.6)',
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginBottom: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
              justifyContent: 'space-between',
                alignItems: 'center',
                  position: 'relative',
                marginBottom: truckIsFull ? '1.5rem' : '0',
              }}
            >
              {/* Status Badge - Positioned above the button container */}
              {truckIsFull && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.5)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    border: '2px solid #ffffff',
                    letterSpacing: '0.5px',
                  }}
                >
                  FULL
                </div>
              )}
              
              <button
                type="button"
                  disabled={!truckIsFull && !selectedDay}
                onClick={() => {
                  if (truckIsFull) {
                      // Continue collecting - auto-place flags for selected day
                      const continueLocations = tempStorage.get(selectedDay || '') || dayLocations;
                      if (selectedDay && continueLocations.length > 0) {
                        console.log('Continue collecting - placing flags for:', selectedDay, 'locations:', continueLocations);
                        setTimeout(() => {
                          autoPlaceFlagsForSelectedDay();
                        }, 200);
                      }
                      // Clear the full status immediately for better UX
                      setTruckIsFull(false);
                      // The route page will also set isFull = false in the database
                      // Pass selected day and locations so route page can place flags
                      onStartCollecting(undefined, selectedDay, continueLocations);
                  } else {
                    // Start collecting - show location prompt first
                      // Only proceed if a day is selected
                      if (!selectedDay) {
                        return;
                      }
                      
                      // Clear the stopped collecting flag when starting
                      if (onClearStoppedFlag) {
                        onClearStoppedFlag();
                      }
                      
                      // Auto-place flags BEFORE showing prompt
                      // Get latest locations from tempStorage
                      const currentLocations = tempStorage.get(selectedDay) || dayLocations;
                      if (selectedDay && currentLocations.length > 0) {
                        console.log('Auto-placing flags before location prompt, selectedDay:', selectedDay, 'locations:', currentLocations);
                        // Ensure dayLocations is synced
                        if (currentLocations.length > 0 && dayLocations.length === 0) {
                          setDayLocations(currentLocations);
                        }
                        // Use setTimeout to ensure state is ready
                        setTimeout(() => {
                          autoPlaceFlagsForSelectedDay();
                        }, 200);
                      } else {
                        console.log('Cannot place flags - selectedDay:', selectedDay, 'locations:', currentLocations);
                      }
                      
                    setShowLocationPrompt(true);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  borderRadius: 999,
                  border: 'none',
                    background: (!truckIsFull && !selectedDay)
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)'
                      : 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #22c55e 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                    boxShadow: (!truckIsFull && !selectedDay)
                      ? '0 8px 16px rgba(107, 114, 128, 0.3)'
                      : '0 12px 26px rgba(34, 197, 94, 0.6), 0 0 20px rgba(34, 197, 94, 0.3)',
                    whiteSpace: 'nowrap',
                    width: 'fit-content',
                    cursor: (!truckIsFull && !selectedDay) ? 'not-allowed' : 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 10,
                    position: 'relative',
                    opacity: (!truckIsFull && !selectedDay) ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '999px',
                    backgroundColor: 'rgba(34, 197, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                  }}
                >
                  ▶
                </span>
                {truckIsFull ? 'Continue Collecting' : 'Start Collecting'}
              </button>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
                {/* Next Day Button - show if viewing today and tomorrow exists */}
                {selectedDay === getTodayDay() && getTomorrowDay() && (
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = getTomorrowDay();
                      if (tomorrow) {
                        handleDayClick(tomorrow);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1.2rem',
                      borderRadius: 999,
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      boxShadow: '0 8px 20px rgba(245, 158, 11, 0.5)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      width: 'fit-content',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 12px 26px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 158, 11, 0.5)';
                    }}
                  >
                    ➡️ Next Day ({getTomorrowDay()})
                  </button>
                )}
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#b0b0b0' }}>Truck No:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{truckNo}</div>
                </div>
              </div>
            </div>

              {/* Location Buttons - Show all locations for selected day from temp storage */}
              {/* Always check refs first for mobile compatibility - render independently of panel state */}
              {(() => {
                // Always prioritize refs on mobile for immediate state access
                const currentDay = selectedDayRef.current || selectedDay;
                const currentLocations = tempStorageRef.current.get(currentDay || '') || tempStorage.get(currentDay || '') || dayLocationsRef.current || dayLocations;
                
                if (!currentDay || !currentLocations || currentLocations.length === 0) {
                  return null;
                }
                
                return (
                <div
                  style={{
                    marginTop: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#b0b0b0', marginBottom: '0.25rem' }}>
                    Locations for {currentDay}:
            </div>
                  {currentLocations.map((location, index) => {
                    // Use street_id if available, otherwise use street name
                    const streetDisplay = location.streetId || location.street || '';
                    const displayText = streetDisplay
                      ? `${streetDisplay} / ${location.barangay}` 
                      : location.barangay;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                        }}
                      >
                <button
                  type="button"
                          onClick={() => handleLocationSelect(location)}
                          style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            borderRadius: 12,
                            border: '2px solid #3b82f6',
                            background: '#242424',
                            color: '#3b82f6',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'left',
                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#3b82f6';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#242424';
                            e.currentTarget.style.color = '#3b82f6';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                          }}
                        >
                          {displayText}
                        </button>
                        {/* DONE button only shows after stopping collection */}
                        {hasStoppedCollecting && (
                          <button
                            type="button"
                            onClick={() => handleLocationDone(location)}
                            style={{
                              padding: '0.75rem 1.25rem',
                              borderRadius: 12,
                              border: '2px solid #22c55e',
                              background: '#22c55e',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#15803d';
                              e.currentTarget.style.borderColor = '#16a34a';
                              e.currentTarget.style.transform = 'scale(1.05)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#22c55e';
                              e.currentTarget.style.borderColor = '#22c55e';
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.3)';
                            }}
                          >
                            DONE
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })()}

              {/* Schedule Location Display */}
              {selectedSchedule && (!selectedDay || dayLocations.length === 0) && (
                <div
                  onClick={handleLocationClick}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 12,
                    background: '#242424',
                    border: '2px solid #3b82f6',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2a2a2a';
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#242424';
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#b0b0b0', marginBottom: '0.25rem' }}>
                    Collection Location:
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    {(() => {
                      const streetName = Array.isArray(selectedSchedule.street_name) 
                        ? selectedSchedule.street_name[0] 
                        : selectedSchedule.street_name || '';
                      const barangayName = Array.isArray(selectedSchedule.barangay_name) 
                        ? selectedSchedule.barangay_name[0] 
                        : selectedSchedule.barangay_name || '';
                      return streetName ? `${streetName} / ${barangayName}` : barangayName || 'Location';
                    })()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#808080', marginTop: '0.25rem' }}>
                    Click to drop flag on map
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowSchedulePanel(!showSchedulePanel)}
                  style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.75rem 1.2rem',
                    borderRadius: 999,
                    border: 'none',
                  background: showSchedulePanel
                    ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                    color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  boxShadow: showSchedulePanel
                    ? '0 12px 26px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3)'
                    : '0 8px 20px rgba(37, 99, 235, 0.5)',
                  transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  width: 'fit-content',
                  }}
                  onMouseEnter={(e) => {
                  if (!showSchedulePanel) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 12px 26px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3)';
                  }
                  }}
                  onMouseLeave={(e) => {
                  if (!showSchedulePanel) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)';
                  }
                  }}
                >
                📅 Schedule
                </button>
            </div>

            {/* Schedule Panel */}
            {showSchedulePanel && (
              <>
                {/* Backdrop */}
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 999,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Just close the panel - don't touch any state
                    // The refs will preserve selectedDay and dayLocations
                    console.log('Backdrop clicked - preserving selectedDay:', selectedDayRef.current || selectedDay, 'dayLocations:', (dayLocationsRef.current || dayLocations).length);
                    setShowSchedulePanel(false);
                  }}
                />
                {/* Panel */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '400px',
                    padding: '1.25rem',
                    borderRadius: 16,
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
                    zIndex: 1000,
                  }}
                >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      margin: 0,
                    }}
                  >
                    Weekly Schedule
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Just close the panel - don't touch any state
                      // The refs will preserve selectedDay and dayLocations
                      console.log('Closing panel - preserving selectedDay:', selectedDayRef.current || selectedDay, 'dayLocations:', (dayLocationsRef.current || dayLocations).length);
                      setShowSchedulePanel(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      color: '#b0b0b0',
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
                {/* Show only today's schedule initially, but allow clicking to see other days */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                  }}
                >
                    {(() => {
                      // Filter to only show today's schedule initially
                      const today = getTodayDay();
                      const todayIsScheduled = isDayScheduled(today);
                      
                      // If today is scheduled, only show today. Otherwise show all scheduled days.
                      const daysToShow = todayIsScheduled ? [today] : daysOfWeek.filter(day => isDayScheduled(day));
                      
                      return daysToShow.map((day) => {
                        const isScheduled = isDayScheduled(day);
                        const isSelected = selectedDay === day;
                        const isToday = day === today;
                        
                        // Check if another day is selected and has pending locations
                        // Disable this button if:
                        // 1. It's not scheduled, OR
                        // 2. Another day is selected AND has locations that haven't been marked as done
                        const hasPendingLocations = selectedDay && selectedDay !== day && (dayLocations.length > 0 || (tempStorage.get(selectedDay)?.length || 0) > 0);
                        const isDisabled = !isScheduled || hasPendingLocations;
                        
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDayClick(day)}
                            disabled={!!isDisabled}
                            style={{
                              padding: '1rem',
                              borderRadius: 12,
                              border: 'none',
                              background: isScheduled && !hasPendingLocations
                                ? isSelected
                                  ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)'
                                  : 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)'
                                : '#3a3a3a',
                              color: isScheduled && !hasPendingLocations ? '#ffffff' : '#808080',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              cursor: isScheduled && !hasPendingLocations ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s ease',
                              boxShadow: isScheduled && !hasPendingLocations
                                ? isSelected
                                  ? '0 4px 12px rgba(59, 130, 246, 0.5), 0 0 15px rgba(59, 130, 246, 0.3)'
                                  : '0 2px 8px rgba(34, 197, 94, 0.4), 0 0 12px rgba(34, 197, 94, 0.2)'
                                : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                              opacity: isScheduled && !hasPendingLocations ? 1 : 0.6,
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              if (isScheduled && !isSelected && !hasPendingLocations) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.5), 0 0 15px rgba(34, 197, 94, 0.3)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (isScheduled && !isSelected && !hasPendingLocations) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.4), 0 0 12px rgba(34, 197, 94, 0.2)';
                              }
                            }}
                          >
                            {day}
                            {isToday && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '0.25rem',
                                  right: '0.25rem',
                                  fontSize: '0.6rem',
                                  background: '#f59e0b',
                                  color: '#ffffff',
                                  padding: '0.125rem 0.25rem',
                                  borderRadius: 4,
                                  fontWeight: 700,
                                }}
                              >
                                TODAY
                              </span>
                            )}
                            {isScheduled && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: isToday ? '1.5rem' : '0.5rem',
                                  right: '0.5rem',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#22c55e',
                                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.8), 0 0 12px rgba(34, 197, 94, 0.6), 0 1px 3px rgba(0,0,0,0.5)',
                                }}
                              />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Turn on location prompt */}
        <IonAlert
          isOpen={showLocationPrompt}
          onDidDismiss={() => setShowLocationPrompt(false)}
          header="Turn on location"
          message="To show your truck on the map and follow the route, please turn on your device location."
          buttons={[
            { text: 'Not now', role: 'cancel' },
            {
              text: 'Turn on',
              handler: () => {
                setShowLocationPrompt(false);
                requestLocationAndStart();
              },
            },
          ]}
        />

        {/* Location error */}
        <IonAlert
          isOpen={showLocationError}
          onDidDismiss={() => setShowLocationError(false)}
          header="Location unavailable"
          message={locationErrorMessage || "We couldn't access your location. Please enable GPS / location permissions and try again."}
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            {
              text: 'Retry',
              handler: () => {
                setShowLocationError(false);
                // Wait a bit before retrying to ensure dialog is closed
                setTimeout(() => {
                  requestLocationAndStart(0, false);
                }, 300);
              }
            }
          ]}
        />

        {/* Top-right popover menu anchored to the menu icon */}
        <IonPopover
          isOpen={!!menuEvent}
          event={menuEvent ?? undefined}
          onDidDismiss={() => setMenuEvent(null)}
        >
          <IonList>
            <IonItem
              button
              onClick={() => {
                setMenuEvent(null);
                history.push('/collector/profile');
              }}
            >
              Profile
            </IonItem>
            <IonItem
              button
              onClick={() => {
                setMenuEvent(null);
                logout();
              }}
            >
              Log out
            </IonItem>
            <IonItem button onClick={() => setMenuEvent(null)}>
              Cancel
            </IonItem>
          </IonList>
        </IonPopover>
      </IonContent>
    </IonPage>
  );
};

export default CollectorHomePage;


