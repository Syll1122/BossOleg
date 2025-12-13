import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonButton, IonAlert, IonButtons, IonIcon, IonSearchbar } from '@ionic/react';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { busOutline, searchOutline } from 'ionicons/icons';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';
import { isSecureContext, getGeolocationErrorMessage } from '../../utils/geolocation';
import RefreshButton from '../../components/RefreshButton';

interface TruckLocation {
  truckId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface ScheduleLocation {
  name: string;
  lat: number;
  lng: number;
}

interface DayLocation {
  street: string;
  barangay: string;
  lat: number;
  lng: number;
  scheduleId: string;
  locationIndex: number;
}

interface CollectorRoutePageProps {
  onBack?: (stoppedCollecting?: boolean) => void;
  selectedLocation?: ScheduleLocation;
  selectedDay?: string | null;
  dayLocations?: DayLocation[];
}

// Validate GPS coordinates
const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const CollectorRoutePage: React.FC<CollectorRoutePageProps> = ({ onBack, selectedLocation, selectedDay, dayLocations = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const truckMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null); // Reference to radius circle
  const [truckFullAlert, setTruckFullAlert] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const otherTrucksRef = useRef<Map<string, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const isCollectingRef = useRef<boolean>(true); // Track if currently collecting to prevent GPS updates after stopping
  const scheduleFlagRef = useRef<L.Marker | null>(null);

  // Load truck number from account
  const loadTruckNo = async () => {
    try {
      await databaseService.init();
      const userId = getCurrentUserId();
      if (userId) {
        const account = await databaseService.getAccountById(userId);
        if (account?.truckNo) {
          setTruckNo(account.truckNo);
        }
      }
    } catch (error) {
      console.error('Error loading truck number:', error);
    }
  };

  useEffect(() => {
    loadTruckNo();
  }, []);

  // Refresh function - reloads truck data and updates status
  const handleRefresh = async () => {
    await loadTruckNo();
    // Reload truck status if truckNo is available
    if (truckNo) {
      try {
        const status = await databaseService.getTruckStatus(truckNo);
        if (status) {
          // Update truck marker icon based on full status
          if (truckMarkerRef.current) {
            truckMarkerRef.current.setIcon(createTruckIcon(status.isFull || false, truckNo));
          }
          // Update truck position if coordinates are available
          if (status.latitude && status.longitude && isValidCoordinate(status.latitude, status.longitude)) {
            if (truckMarkerRef.current) {
              truckMarkerRef.current.setLatLng([status.latitude, status.longitude]);
              if (mapRef.current) {
                mapRef.current.setView([status.latitude, status.longitude], mapRef.current.getZoom());
              }
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing truck status:', error);
      }
    }
  };

  // Set truck as collecting when truckNo is loaded and route page is active
  useEffect(() => {
    const setTruckCollecting = async () => {
      if (!truckNo) return; // Wait for truckNo to be loaded
      
      try {
        // Set flag to allow GPS updates
        isCollectingRef.current = true;
        
        const userId = getCurrentUserId();
        if (userId) {
          // Get current status to preserve GPS coordinates if they exist
          const currentStatus = await databaseService.getTruckStatus(truckNo);
          
          // Set isFull = false and isCollecting = true when starting to collect
          // Preserve existing GPS coordinates if available, they'll be updated when GPS location is obtained
          await databaseService.updateTruckStatus(
            truckNo, 
            false, 
            userId, 
            true,
            currentStatus?.latitude,
            currentStatus?.longitude
          );
          console.log(`Truck ${truckNo} set as collecting (isFull = false, isCollecting = true)`);
          
          // Update truck marker icon to green (original color) immediately
          if (truckMarkerRef.current) {
            truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
          }
          
          // Notify all residents that collection has started
          const { notifyAllResidentsCollectionStarted } = await import('../../services/residentNotificationService');
          notifyAllResidentsCollectionStarted().catch(err => 
            console.error('Error notifying residents:', err)
          );
        }
      } catch (error) {
        console.error('Error setting truck as collecting:', error);
      }
    };
    
    setTruckCollecting();
    
    // Cleanup: Stop collecting when component unmounts or navigates away
    // BUT preserve isFull status - only clear GPS if truck is not full
    return () => {
      const cleanup = async () => {
        try {
          // Set flag to prevent any further GPS updates
          isCollectingRef.current = false;
          
          // Stop GPS tracking FIRST to prevent any pending updates
          if (watchIdRef.current !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          
          const userId = getCurrentUserId();
          if (userId && truckNo) {
            // Get current status to preserve isFull
            const currentStatus = await databaseService.getTruckStatus(truckNo);
            const preserveIsFull = currentStatus?.isFull || false;
            
            // If truck is full, preserve GPS. Otherwise clear GPS when stopping
            if (preserveIsFull) {
              // Truck is full - preserve GPS coordinates
              await databaseService.updateTruckStatus(
                truckNo, 
                preserveIsFull, 
                userId, 
                false,
                currentStatus?.latitude,
                currentStatus?.longitude
              );
            } else {
              // Truck is not full and stopping - clear GPS coordinates (truck will disappear)
              await databaseService.updateTruckStatus(truckNo, false, userId, false, null, null);
            }
          }
        } catch (error) {
          console.error('Error cleaning up truck status:', error);
        }
      };
      cleanup();
    };
  }, [truckNo]); // Run whenever truckNo changes

  // Create truck icons with dynamic truck number
  const createTruckIcon = (isRed: boolean, truckNumber: string) => {
    return L.divIcon({
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 28px;">🚛</div>
          <div style="background: ${isRed ? '#ef4444' : 'white'}; color: ${isRed ? 'white' : '#1f2937'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap;">
            ${truckNumber}
          </div>
        </div>
      `,
      className: isRed ? 'watch-truck-icon watch-truck-icon--red' : 'watch-truck-icon watch-truck-icon--white',
      iconSize: [60, 50],
      iconAnchor: [30, 45],
    });
  };

  // Create truck information popup content
  const createTruckInfoPopup = (truckNo: string, lat?: number, lng?: number) => {
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 0;
      min-width: 220px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    const coordinatesHtml = (lat !== undefined && lng !== undefined) 
      ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
          Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
        </div>`
      : '';
    
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
          id="truck-info-close-btn-${truckNo}"
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
          <strong style="color: #1f2937;">Truck Size:</strong> 
          <span style="color: #1f2937;">Large</span>
        </div>
        ${coordinatesHtml}
      </div>
    `;
    
    return popupContent;
  };

  const searchFlagIcon = L.divIcon({
    html: '📍',
    className: 'watch-stop-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

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

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Auto-place Monday flags
      const placeMondayFlags = async () => {
        try {
          await databaseService.init();
          const userId = getCurrentUserId();
          if (!userId) return;

          // Get all schedules for this collector
          const allSchedules = await databaseService.getSchedulesByCollectorId(userId);
          
          // Filter for Monday schedules
          const mondaySchedules = allSchedules.filter(schedule => 
            schedule.days && Array.isArray(schedule.days) && schedule.days.includes('Mon')
          );

          if (mondaySchedules.length === 0) return;

          // Create red flag icon
          const flagIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          // Extract and place all Monday locations
          mondaySchedules.forEach(schedule => {
            // Handle arrays for latitude/longitude/names
            const latitudes = Array.isArray(schedule.latitude) ? schedule.latitude : (schedule.latitude !== null && schedule.latitude !== undefined ? [schedule.latitude] : []);
            const longitudes = Array.isArray(schedule.longitude) ? schedule.longitude : (schedule.longitude !== null && schedule.longitude !== undefined ? [schedule.longitude] : []);
            const streetNames = Array.isArray(schedule.street_name) ? schedule.street_name : (schedule.street_name ? [schedule.street_name] : []);
            const barangayNames = Array.isArray(schedule.barangay_name) ? schedule.barangay_name : (schedule.barangay_name ? [schedule.barangay_name] : []);

            const maxLength = Math.max(latitudes.length, longitudes.length, streetNames.length, barangayNames.length, 1);

            for (let i = 0; i < maxLength; i++) {
              const lat = latitudes[i] !== null && latitudes[i] !== undefined ? Number(latitudes[i]) : (latitudes[0] !== null && latitudes[0] !== undefined ? Number(latitudes[0]) : null);
              const lng = longitudes[i] !== null && longitudes[i] !== undefined ? Number(longitudes[i]) : (longitudes[0] !== null && longitudes[0] !== undefined ? Number(longitudes[0]) : null);
              const street = streetNames[i] || streetNames[0] || '';
              const barangay = barangayNames[i] || barangayNames[0] || '';

              if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
                const locationKey = `monday-${lat}-${lng}-${street}-${barangay}`;
                const displayText = street ? `${street} / ${barangay}` : barangay;

                // Check if marker already exists
                let markerExists = false;
                mapRef.current!.eachLayer((layer) => {
                  if (layer instanceof L.Marker) {
                    const markerPos = layer.getLatLng();
                    if (Math.abs(markerPos.lat - lat) < 0.0001 && Math.abs(markerPos.lng - lng) < 0.0001) {
                      markerExists = true;
                    }
                  }
                });

                if (!markerExists) {
                  const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current!);
                  
                  // Create popup with cancel button
                  const popupContent = `
                    <div style="text-align: center;">
                      <strong>Collection Start Point</strong><br/>
                      ${displayText}<br/>
                      <button id="remove-flag-route-${locationKey}" style="
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
                    const removeButton = document.getElementById(`remove-flag-route-${locationKey}`);
                    if (removeButton) {
                      removeButton.onclick = () => {
                        if (mapRef.current && mapRef.current.hasLayer(marker)) {
                          mapRef.current.removeLayer(marker);
                        }
                        marker.closePopup();
                      };
                    }
                  });

                  // Store in scheduleFlagRef if it's the first one (for backward compatibility)
                  if (!scheduleFlagRef.current) {
                    scheduleFlagRef.current = marker;
                  }
                }
              }
            }
          });
        } catch (error) {
          console.error('Error placing Monday flags:', error);
        }
      };

      placeMondayFlags();

      // Add flag for selected location from schedule if provided
      if (selectedLocation) {
        // Create red flag icon for schedule location
        const flagIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
        const marker = L.marker(selectedPos, { icon: flagIcon }).addTo(mapRef.current!);
        
        // Create popup with cancel button
        const popupContent = `
          <div style="text-align: center;">
            <strong>Collection Start Point</strong><br/>
            ${selectedLocation.name || ''}<br/>
            <button id="remove-flag-selected-mapready" style="
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
          const removeButton = document.getElementById('remove-flag-selected-mapready');
          if (removeButton) {
            removeButton.onclick = () => {
              if (mapRef.current && mapRef.current.hasLayer(marker)) {
                mapRef.current.removeLayer(marker);
              }
              marker.closePopup();
            };
          }
        });
        
        scheduleFlagRef.current = marker;
        // Center map on selected location
        mapRef.current.setView(selectedPos, 17);
      }

      // Load and display only online (currently collecting) collector trucks on the map
      const loadAllTrucks = async () => {
        try {
          const userId = getCurrentUserId();
          if (!userId) return;

          // Get all collector accounts
          const collectors = await databaseService.getAccountsByRole('collector');
          const currentTruckNo = truckNo;
          
          // Clear existing other truck markers first to prevent duplicates
          otherTrucksRef.current.forEach((marker) => {
            if (mapRef.current && mapRef.current.hasLayer(marker)) {
              mapRef.current.removeLayer(marker);
            }
          });
          otherTrucksRef.current.clear();
          
          // Add markers for all other collector trucks (only those with valid accounts and truck numbers)
          for (const collector of collectors) {
            // Only show trucks that have valid accounts with truck numbers AND exclude current user by ID
            if (collector.id && collector.truckNo && collector.truckNo.trim() !== '' && 
                collector.id !== userId && collector.truckNo !== currentTruckNo) {
              
              // Check if collector is online from accounts table
              const isOnline = collector.isOnline === true;
              
              // Get truck status
              const status = await databaseService.getTruckStatus(collector.truckNo);
              
              // Only show trucks that are both online AND currently collecting
              if (!isOnline) {
                console.log(`Skipping truck ${collector.truckNo} - collector not online`);
                continue;
              }
              
              if (!status || !status.isCollecting) {
                console.log(`Skipping truck ${collector.truckNo} - not currently collecting`);
                continue;
              }
              
              const isFull = status?.isFull || false;
              
              // Use GPS coordinates from truck_status if available, otherwise skip this truck
              if (status.latitude === undefined || status.longitude === undefined) {
                console.log(`Skipping truck ${collector.truckNo} - no GPS coordinates available`);
                continue;
              }
              
              const truckLat = status.latitude;
              const truckLng = status.longitude;
              
              // Validate coordinates
              if (!isValidCoordinate(truckLat, truckLng)) {
                console.log(`Skipping truck ${collector.truckNo} - invalid GPS coordinates`);
                continue;
              }
              
              const icon = createTruckIcon(isFull, collector.truckNo);
              const marker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current!);
              
              // Create popup with modern design matching the second image
              const popupContent = document.createElement('div');
              popupContent.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 0;
                min-width: 200px;
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
                    <div style="font-weight: 600; font-size: 0.9rem; color: #1f2937;">${collector.truckNo}</div>
                  </div>
                  <button 
                    onclick="this.closest('.leaflet-popup').closePopup()"
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
                  <div style="font-weight: 600; font-size: 0.9rem; color: #1f2937; margin-bottom: 0.5rem;">
                    Collector: ${collector.name || 'N/A'}
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
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
                </div>
              `;
              
              marker.bindPopup(popupContent, {
                className: 'custom-truck-popup',
                closeButton: false,
              });
              
              // Add close button handler
              marker.on('popupopen', () => {
                const closeBtn = document.getElementById(`truck-close-btn-${collector.truckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    marker.closePopup();
                  };
                }
              });
              
              // Store marker reference
              otherTrucksRef.current.set(collector.truckNo, marker);
            }
          }
        } catch (error) {
          console.error('Error loading other trucks:', error);
        }
      };

      loadAllTrucks();

      // Load collector's own truck position immediately from database (if available)
      const loadCollectorTruckPosition = async () => {
        try {
          const userId = getCurrentUserId();
          if (!userId || !mapRef.current) return;

          // Get truck number
          let currentTruckNo = truckNo;
          if (!currentTruckNo) {
            const account = await databaseService.getAccountById(userId);
            if (account?.truckNo) {
              currentTruckNo = account.truckNo;
              setTruckNo(account.truckNo);
            }
          }

          if (!currentTruckNo) return;

          // Get last known truck status
          const status = await databaseService.getTruckStatus(currentTruckNo);
          
          // If we have last known GPS coordinates, show truck immediately
          if (status && status.latitude !== undefined && status.longitude !== undefined && 
              isValidCoordinate(status.latitude, status.longitude)) {
            const latlng: L.LatLngExpression = [status.latitude, status.longitude];
            
            // Create radius circle if it doesn't exist
            if (!radiusCircleRef.current) {
              const radiusCircle = L.circle(latlng, {
                radius: 400,
                color: '#16a34a',
                fillColor: '#16a34a',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '5, 5',
              }).bindPopup('400m Notification Radius - Residents within this area will be notified').addTo(mapRef.current);
              radiusCircleRef.current = radiusCircle;
            } else {
              radiusCircleRef.current.setLatLng(latlng);
            }

            // Create truck marker at last known position
            // Use isFull = false since we just set the truck as collecting
            if (!truckMarkerRef.current || !mapRef.current.hasLayer(truckMarkerRef.current)) {
              const icon = createTruckIcon(false, currentTruckNo); // Always green when collecting
              const marker = L.marker(latlng, { icon }).addTo(mapRef.current);
              truckMarkerRef.current = marker;
              
              const popupContent = createTruckInfoPopup(currentTruckNo, status.latitude, status.longitude);
              marker.bindPopup(popupContent, {
                className: 'custom-truck-popup',
                closeButton: false,
              });
              
              marker.on('popupopen', () => {
                const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    marker.closePopup();
                  };
                }
              });

              // Center map on truck location if no selected location
              if (!selectedLocation) {
                mapRef.current.setView(latlng, 16);
              }
              
              console.log(`Truck ${currentTruckNo} loaded at last known position: ${status.latitude}, ${status.longitude}`);
            }
          }
        } catch (error) {
          console.error('Error loading collector truck position:', error);
        }
      };

      // Load truck position immediately (before GPS is available)
      loadCollectorTruckPosition();

      // Function to update truck position
      const updateTruckPosition = async (lat: number, lng: number) => {
        if (!mapRef.current) return;
        
        // Don't update GPS if collector has stopped collecting
        if (!isCollectingRef.current) {
          console.log('Truck is not collecting, ignoring GPS update');
          return;
        }
        
        if (!isValidCoordinate(lat, lng)) {
          console.error('Invalid GPS coordinates:', lat, lng);
          return;
        }
        
        const latlng: L.LatLngExpression = [lat, lng];
        
        // Get truck number from account if not already loaded
        let currentTruckNo = truckNo;
        if (!currentTruckNo) {
          try {
            const userId = getCurrentUserId();
            if (userId) {
              const account = await databaseService.getAccountById(userId);
              if (account?.truckNo) {
                currentTruckNo = account.truckNo;
                setTruckNo(account.truckNo);
              }
            }
          } catch (error) {
            console.error('Error loading truck number:', error);
          }
        }
        
        // Create or update radius circle position to center on truck
        if (radiusCircleRef.current && mapRef.current) {
          // Update existing radius circle position
          radiusCircleRef.current.setLatLng(latlng);
        } else if (mapRef.current) {
          // Create radius circle if it doesn't exist
          const radiusCircle = L.circle(latlng, {
            radius: 400, // 400 meters
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5',
          }).bindPopup('400m Notification Radius - Residents within this area will be notified').addTo(mapRef.current);
          radiusCircleRef.current = radiusCircle;
        }
        
        // Only create/update marker if truck number is loaded
        if (!currentTruckNo) {
          console.log('Truck number not available, skipping marker update');
          return;
        }
        
        // Save GPS position to database (for resident map to see) - using truck number from account
        // Only update if still collecting
        try {
          const userId = getCurrentUserId();
          if (userId && currentTruckNo && isCollectingRef.current) {
            // Update truck status with GPS coordinates and ensure isCollecting is true
            // This associates the truck number with the current location
            await databaseService.updateTruckStatus(currentTruckNo, false, userId, true, lat, lng);
            console.log(`Truck ${currentTruckNo} location updated: ${lat}, ${lng}`);
          }
        } catch (error) {
          console.error('Error updating truck GPS position in database:', error);
        }
        
        // Check if marker exists and is valid on the map
        const markerExists = truckMarkerRef.current && 
                            mapRef.current && 
                            mapRef.current.hasLayer(truckMarkerRef.current);
        
        let marker: L.Marker;
        if (markerExists && truckMarkerRef.current) {
          // Update existing marker position instead of creating new one
          marker = truckMarkerRef.current;
          marker.setLatLng(latlng);
          // Update icon to green (original color) since we're collecting and isFull is false
          marker.setIcon(createTruckIcon(false, currentTruckNo));
          
          // Update popup with new coordinates
          const popupContent = createTruckInfoPopup(currentTruckNo, lat, lng);
          marker.bindPopup(popupContent, {
            className: 'custom-truck-popup',
            closeButton: false,
          });
        } else {
          // Remove any stale marker reference first
          if (truckMarkerRef.current) {
            try {
              if (mapRef.current && mapRef.current.hasLayer(truckMarkerRef.current)) {
                mapRef.current.removeLayer(truckMarkerRef.current);
              }
              truckMarkerRef.current.remove();
            } catch (e) {
              // Marker might already be removed
            }
            truckMarkerRef.current = null;
          }
          
          // Create new marker at GPS location
          const icon = createTruckIcon(false, currentTruckNo);
          marker = L.marker(latlng, { icon }).addTo(mapRef.current);
          truckMarkerRef.current = marker;
          
          // Add click popup to truck marker
          const popupContent = createTruckInfoPopup(currentTruckNo, lat, lng);
          marker.bindPopup(popupContent, {
            className: 'custom-truck-popup',
            closeButton: false,
          });
          
          // Add close button handler
          marker.on('popupopen', () => {
            const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
            if (closeBtn) {
              closeBtn.onclick = () => {
                marker.closePopup();
              };
            }
          });
        }
      };

      // Get user's actual GPS location first, then place truck there
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!mapRef.current) return;
            
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            // Use truck number from account (no predefined location-based assignment)
            let currentTruckNo = truckNo;
            
            if (!isValidCoordinate(lat, lng)) {
              console.error('Invalid GPS coordinates from getCurrentPosition');
              // Don't place truck if GPS is invalid - wait for valid GPS
              return;
            }
            
            const latlng: L.LatLngExpression = [lat, lng];
            
            // Remove existing radius circle if it exists
            if (radiusCircleRef.current && mapRef.current) {
              mapRef.current.removeLayer(radiusCircleRef.current);
            }
            
            // Add 400m radius circle around collector's location
            const radiusCircle = L.circle(latlng, {
              radius: 400, // 400 meters
              color: '#16a34a',
              fillColor: '#16a34a',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '5, 5',
            }).bindPopup('400m Notification Radius - Residents within this area will be notified').addTo(mapRef.current);
            radiusCircleRef.current = radiusCircle;
            
            // Ensure truck number is set before placing truck
            if (!currentTruckNo) {
              currentTruckNo = truckNo;
            }
            
            // If still no truck number, try to get it from account
            if (!currentTruckNo) {
              try {
                const userId = getCurrentUserId();
                if (userId) {
                  const account = await databaseService.getAccountById(userId);
                  if (account?.truckNo) {
                    currentTruckNo = account.truckNo;
                    setTruckNo(account.truckNo);
                  }
                }
              } catch (error) {
                console.error('Error loading truck number:', error);
              }
            }
            
            // Don't remove marker here - let updateTruckPosition handle it
            // Place truck at user's actual location using updateTruckPosition
            // This function handles marker creation/update properly
            updateTruckPosition(lat, lng);
            
            // Center map on truck location
            if (!selectedLocation) {
              mapRef.current.setView(latlng, 16);
            } else {
              // Fit bounds to show truck and selected location
              const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
              const allPoints = [latlng, selectedPos];
              mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [48, 48] });
            }

            // Set up real-time location tracking (watchPosition)
            // Make sure we're still collecting before setting up watch
            isCollectingRef.current = true;
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                // Double-check we're still collecting before updating
                if (!isCollectingRef.current) {
                  console.log('Stopped collecting, ignoring GPS update from watchPosition');
                  return;
                }
                
                const newLat = pos.coords.latitude;
                const newLng = pos.coords.longitude;
                
                if (isValidCoordinate(newLat, newLng)) {
                  updateTruckPosition(newLat, newLng);
                }
              },
              (error) => {
                console.error('GPS tracking error:', error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000, // Accept cached position up to 5 seconds old
              }
            );
          },
          (error) => {
            // If GPS fails, don't place truck at predefined location
            console.error('GPS error:', error);
            
            // Log helpful error message
            if (error.code === error.PERMISSION_DENIED) {
              console.warn('GPS Permission Denied. Make sure location permissions are enabled.');
            } else if (!isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
              console.warn('GPS requires HTTPS. Access via https:// or use localhost. See GPS_HTTPS_SETUP.md for solutions.');
            } else {
              console.warn('GPS Error:', getGeolocationErrorMessage(error));
            }
            
            // Don't place truck if GPS fails - wait for valid GPS coordinates
            // Truck will appear once GPS is available
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        // Geolocation not available - don't place truck at predefined location
        // Truck will appear once geolocation becomes available
        console.warn('Geolocation is not available in this browser.');
      }
    }, 300);
  };

  // Stop collecting - return to collector home page and reset truck status
  const onStopCollecting = async () => {
    try {
      // Set flag to prevent any further GPS updates
      isCollectingRef.current = false;
      
      // Stop GPS tracking FIRST to prevent any pending updates
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      // Set truck as not collecting and not full - clear GPS coordinates (truck will disappear from resident map)
      const userId = getCurrentUserId();
      if (userId && truckNo) {
        // Set isCollecting = false, isFull = false - clear GPS coordinates (null)
        await databaseService.updateTruckStatus(truckNo, false, userId, false, null, null);
        console.log(`Truck ${truckNo} stopped collecting - GPS cleared`);
      }
      
      // Update marker icon to white if it was red
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
    } catch (error) {
      console.error('Error resetting truck status:', error);
    } finally {
      // Always go back to home page, pass true to indicate we stopped collecting
      if (onBack) {
        onBack(true);
      }
    }
  };

  const onTruckFullConfirm = async () => {
    try {
      // Set flag to prevent any further GPS updates
      isCollectingRef.current = false;
      
      // Stop GPS tracking FIRST to prevent any pending updates
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      // Update truck status in database - set as full and stop collecting
      const userId = getCurrentUserId();
      if (userId) {
        // Get current GPS to preserve it (truck is full, so keep last location)
        const currentStatus = await databaseService.getTruckStatus(truckNo);
        // Set isFull = true and isCollecting = false, preserve GPS coordinates
        await databaseService.updateTruckStatus(
          truckNo, 
          true, 
          userId, 
          false,
          currentStatus?.latitude,
          currentStatus?.longitude
        );
      }
      
      // Update marker icon to red
      if (truckMarkerRef.current) {
        const currentTruckNo = truckNo;
        if (currentTruckNo && truckMarkerRef.current) {
          truckMarkerRef.current.setIcon(createTruckIcon(true, currentTruckNo));
        }
      }
      
      // Redirect back to home page
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error updating truck status:', error);
      // Still proceed with UI update even if DB fails
      if (truckMarkerRef.current) {
        const currentTruckNo = truckNo;
        if (currentTruckNo && truckMarkerRef.current) {
          truckMarkerRef.current.setIcon(createTruckIcon(true, currentTruckNo));
        }
      }
      
      // Stop GPS tracking
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      if (onBack) {
        onBack();
      }
    }
  };

  const onTruckEmpty = async () => {
    try {
      // Update truck status in database
      const userId = getCurrentUserId();
      if (userId) {
        await databaseService.updateTruckStatus(truckNo, false, userId);
      }
      
      // Update marker icon to white
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
    } catch (error) {
      console.error('Error updating truck status:', error);
      // Still proceed with UI update even if DB fails
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
    }
  };

  // Handle search functionality
  const handleSearch = async () => {
    if (!mapRef.current || !searchQuery.trim()) return;

    try {
      // Try to parse as coordinates first (lat, lng)
      const coordMatch = searchQuery.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isValidCoordinate(lat, lng)) {
          const pos: L.LatLngExpression = [lat, lng];
          if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
          }
          const marker = L.marker(pos, { icon: searchFlagIcon }).addTo(mapRef.current);
          searchMarkerRef.current = marker;
          marker.bindPopup(`<div style="text-align: center; font-weight: 600; padding: 0.5rem;">📍 Searched Location<br/>${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`);
          marker.openPopup();
          mapRef.current.setView(pos, 17);
          setShowSearch(false);
          setSearchQuery('');
          return;
        }
      }

      // Use Nominatim (OpenStreetMap geocoding) for address search
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'BossOleg-CollectorApp/1.0',
          },
        }
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        if (isValidCoordinate(lat, lng)) {
          const pos: L.LatLngExpression = [lat, lng];
          if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
          }
          const marker = L.marker(pos, { icon: searchFlagIcon }).addTo(mapRef.current);
          searchMarkerRef.current = marker;
          marker.bindPopup(`<div style="text-align: center; font-weight: 600; padding: 0.5rem;">📍 ${result.display_name}</div>`);
          marker.openPopup();
          mapRef.current.setView(pos, 17);
          setShowSearch(false);
          setSearchQuery('');
        } else {
          alert('Invalid location coordinates found');
        }
      } else {
        alert('Location not found. Try entering coordinates (lat, lng) or a specific address.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching for location. Please try again.');
    }
  };

  // Auto-place flags for selected day's locations from tempStorage (passed from home page)
  useEffect(() => {
    if (!mapRef.current) return;

    const placeFlagsFromDayLocations = () => {
      // Use dayLocations from props (passed from home page via stack)
      if (!dayLocations || dayLocations.length === 0) {
        console.log('No dayLocations provided to route page, cannot place flags');
        return;
      }

      console.log(`Route page: Placing flags for ${selectedDay || 'selected day'}:`, dayLocations);

      // Create red flag icon
      const flagIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // Place flags for each location using lat/lng from dayLocations
      dayLocations.forEach((location: DayLocation, index: number) => {
        const lat = Number(location.lat);
        const lng = Number(location.lng);

        // Validate coordinates
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          console.error(`Route page: Invalid coordinates for location ${index}:`, location);
          return;
        }

        const locationKey = `${location.scheduleId}-${location.locationIndex}-${lat}-${lng}-${location.street}-${location.barangay}`;
        const displayText = location.street 
          ? `${location.street} / ${location.barangay}` 
          : location.barangay;

        // Check if marker already exists
        let markerExists = false;
        mapRef.current!.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const markerPos = layer.getLatLng();
            if (Math.abs(markerPos.lat - lat) < 0.0001 && Math.abs(markerPos.lng - lng) < 0.0001) {
              markerExists = true;
            }
          }
        });

        if (!markerExists) {
          console.log(`Route page: Placing flag ${index + 1}/${dayLocations.length} at:`, lat, lng, displayText);
          const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current!);
          
          // Create popup with cancel button
          const popupContent = `
            <div style="text-align: center;">
              <strong>Collection Start Point</strong><br/>
              ${displayText}<br/>
              <button id="remove-flag-route-${locationKey}" style="
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
          marker.bindPopup(popupContent);
          
          // Add click handler for cancel button
          marker.on('popupopen', () => {
            const removeButton = document.getElementById(`remove-flag-route-${locationKey}`);
            if (removeButton) {
              removeButton.onclick = () => {
                if (mapRef.current && mapRef.current.hasLayer(marker)) {
                  mapRef.current.removeLayer(marker);
                }
                marker.closePopup();
              };
            }
          });

          // Store in scheduleFlagRef if it's the first one (for backward compatibility)
          if (index === 0 && !scheduleFlagRef.current) {
            scheduleFlagRef.current = marker;
          }
          
          console.log(`Route page: ✓ Flag placed successfully at ${lat}, ${lng}`);
        } else {
          console.log(`Route page: Flag already exists at ${lat}, ${lng}, skipping...`);
        }
      });

      console.log(`Route page: Finished placing flags. Total flags placed: ${dayLocations.length}`);
    };

    // Delay to ensure map is fully ready
    const timeoutId = setTimeout(() => {
      placeFlagsFromDayLocations();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mapRef.current, selectedDay, dayLocations]);

  // Also handle selectedLocation if provided (legacy support)
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;

    const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
    
    // Remove existing schedule flag if any (old single flag behavior)
    if (scheduleFlagRef.current && mapRef.current.hasLayer(scheduleFlagRef.current)) {
      // Don't remove if it's one of our Monday flags - just center on selectedLocation
      const existingPos = scheduleFlagRef.current.getLatLng();
      if (Math.abs(existingPos.lat - selectedLocation.lat) > 0.0001 || 
          Math.abs(existingPos.lng - selectedLocation.lng) > 0.0001) {
        // Different location, check if we need to add a new marker
        let markerExists = false;
        mapRef.current.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const markerPos = layer.getLatLng();
            if (Math.abs(markerPos.lat - selectedLocation.lat) < 0.0001 && 
                Math.abs(markerPos.lng - selectedLocation.lng) < 0.0001) {
              markerExists = true;
            }
          }
        });

        if (!markerExists) {
          const flagIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const marker = L.marker(selectedPos, { icon: flagIcon }).addTo(mapRef.current);
          marker.bindPopup(`<strong>Collection Start Point</strong><br/>${selectedLocation.name || ''}`).openPopup();
          scheduleFlagRef.current = marker;
        }
      }
    } else if (!scheduleFlagRef.current) {
      // No existing flag, create one for selectedLocation
      const flagIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const marker = L.marker(selectedPos, { icon: flagIcon }).addTo(mapRef.current);
      marker.bindPopup(`<strong>Collection Start Point</strong><br/>${selectedLocation.name || ''}`).openPopup();
      scheduleFlagRef.current = marker;
    }

    // Center on selected location
    mapRef.current.setView(selectedPos, 17);
  }, [selectedLocation]);

  useEffect(() => {
    // Cleanup marker and stop GPS tracking if the component unmounts
    return () => {
      if (truckMarkerRef.current) {
        truckMarkerRef.current.remove();
        truckMarkerRef.current = null;
      }
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
      if (scheduleFlagRef.current && mapRef.current) {
        mapRef.current.removeLayer(scheduleFlagRef.current);
        scheduleFlagRef.current = null;
      }
      // Cleanup other truck markers
      otherTrucksRef.current.forEach((marker) => {
        if (mapRef.current) {
          mapRef.current.removeLayer(marker);
        }
      });
      otherTrucksRef.current.clear();
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const AnyMapView = MapView as React.ComponentType<any>;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#141414', '--color': '#ffffff', borderBottom: '1px solid #2a2a2a' }}>
          <IonButtons slot="start">
            <IonButton
              onClick={() => onBack?.()}
              style={{
                '--color': '#16a34a',
                borderRadius: 999,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                paddingInline: '0.9rem',
                minHeight: '48px',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              BACK
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <RefreshButton onRefresh={handleRefresh} variant="header" />
          </IonButtons>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IonIcon icon={busOutline} style={{ fontSize: '1.4rem', color: '#16a34a' }} />
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {/* Search Bar */}
        {showSearch && (
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '1rem',
              right: '1rem',
              zIndex: 1000,
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '0.5rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            }}
          >
            <IonSearchbar
              value={searchQuery}
              onIonInput={(e) => setSearchQuery(e.detail.value!)}
              placeholder="Search location or enter coordinates (lat, lng)"
              showCancelButton="always"
              cancelButtonText="Close"
              onIonCancel={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <IonButton
              expand="block"
              onClick={handleSearch}
              style={{
                marginTop: '0.5rem',
                '--background': '#22c55e',
                '--color': 'white',
              }}
            >
              <IonIcon icon={searchOutline} slot="start" />
              Search
            </IonButton>
          </div>
        )}

        <div 
          className="watch-card" 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            borderRadius: 0,
          }}
        >
          <AnyMapView id="collector-map" center={[14.683726, 121.076224]} zoom={16} onMapReady={handleMapReady} />
          
          {/* Search Button */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 1000,
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '0.75rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IonIcon icon={searchOutline} style={{ fontSize: '1.2rem', color: '#16a34a' }} />
          </button>
        </div>

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '0.75rem 1rem 1.25rem',
            background: 'transparent',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={onStopCollecting}
              style={{
                flex: 1,
                height: 72,
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 14px 28px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3)',
                zIndex: 10001,
                position: 'relative',
              }}
            >
              Stop Collecting
            </button>

            <button
              type="button"
              onClick={() => setTruckFullAlert(true)}
              style={{
                flex: 1,
                height: 72,
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#f9fafb',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: '0 16px 32px rgba(239, 68, 68, 0.7)',
                zIndex: 10001,
                position: 'relative',
              }}
            >
              FULL
            </button>
          </div>
        </div>
      </IonContent>

      <IonAlert
        isOpen={truckFullAlert}
        onDidDismiss={() => setTruckFullAlert(false)}
        header="Truck is Full?"
        message="Confirm if your truck is already full."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Yes, Full', handler: onTruckFullConfirm },
        ]}
      />
    </IonPage>
  );
};

export default CollectorRoutePage;


