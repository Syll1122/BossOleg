// src/pages/resident/ResidentTruckView.tsx

import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonText, IonToast } from '@ionic/react';
import { arrowBackOutline, busOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { databaseService } from '../../services/database';
import NotificationBell from '../../components/NotificationBell';
import { calculateDistance, isValidCoordinate } from '../../utils/coordinates';
import { getCurrentUserId } from '../../utils/auth';
import { requestGeolocation } from '../../utils/geolocation';

const ResidentTruckView: React.FC = () => {
  const history = useHistory();
  const mapRef = useRef<L.Map | null>(null);
  const truckMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const residentMarkerRef = useRef<L.Marker | null>(null); // Reference to resident location marker
  const updateIntervalRef = useRef<number | null>(null);
  const previousTruckStatusesRef = useRef<Map<string, { isCollecting: boolean; isFull: boolean }>>(new Map());
  
  // Toast state for notifications
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Resident location and proximity tracking
  const residentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const notifiedTrucksRef = useRef<Set<string>>(new Set()); // Track which trucks have already notified
  const NOTIFICATION_RADIUS_METERS = 400; // 400 meters radius

  // Create truck icons with dynamic truck number (matching collector side design)
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
          border: 3px solid white;
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

  // Create truck popup with report functionality
  const createTruckPopup = (truckNo: string, collectorName: string, isFull: boolean, lat: number, lng: number) => {
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
      background: white;
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
        <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.75rem;">
          Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
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

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Load and display all collector trucks on the map
      const loadAllTrucks = async () => {
        try {
          await databaseService.init();
          
          // Get all collector accounts
          const collectors = await databaseService.getAccountsByRole('collector');
          
          const truckPositions: L.LatLngExpression[] = [];
          
          // Add markers for all collector trucks (only those with valid accounts and truck numbers)
          for (const collector of collectors) {
            // Only show trucks that have valid accounts with truck numbers
            if (collector.id && collector.truckNo && collector.truckNo.trim() !== '') {
              // Get truck status
              const status = await databaseService.getTruckStatus(collector.truckNo);
              console.log(`Truck ${collector.truckNo} status:`, status);
              // Show trucks that are actively collecting or full
              if (!status || (!status.isCollecting && !status.isFull)) {
                console.log(`Skipping truck ${collector.truckNo} - not collecting and not full`);
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
              
              // Only show trucks with valid GPS coordinates - no default locations
              if (status.latitude === undefined || status.longitude === undefined || 
                  !isValidCoordinate(status.latitude, status.longitude)) {
                console.log(`Skipping truck ${collector.truckNo} - no valid GPS coordinates`);
                continue;
              }
              
              const truckLat = status.latitude;
              const truckLng = status.longitude;
              console.log(`Using GPS coordinates for truck ${collector.truckNo}:`, truckLat, truckLng);
              
              const icon = createTruckIcon(isFull, collector.truckNo);
              const marker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current!);
              
              // Track previous status for newly added trucks
              previousTruckStatusesRef.current.set(collector.truckNo, {
                isCollecting: status.isCollecting || false,
                isFull: status.isFull || false
              });
              
              // Create popup with report functionality
              const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, truckLat, truckLng);
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
                    history.push({
                      pathname: '/resident/report',
                      state: { truckNo: collector.truckNo }
                    });
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
              if (status.isCollecting && isValidCoordinate(truckLat, truckLng)) {
                checkTruckProximity(
                  collector.truckNo,
                  truckLat,
                  truckLng,
                  collector.name || 'Collector'
                );
              }
            }
          }
          
          // Fit map bounds to show all trucks (only if we have trucks with GPS)
          if (truckPositions.length > 0 && mapRef.current) {
            if (truckPositions.length === 1) {
              mapRef.current.setView(truckPositions[0], 16);
            } else {
              mapRef.current.fitBounds(L.latLngBounds(truckPositions), { padding: [50, 50] });
            }
          } else if (mapRef.current && residentLocationRef.current) {
            // Center on resident location if no trucks are visible
            mapRef.current.setView([residentLocationRef.current.lat, residentLocationRef.current.lng], 16);
          }
        } catch (error) {
          console.error('Error loading trucks:', error);
          // Don't set default location - just log the error
        }
      };

      loadAllTrucks();

      // Get and track resident location for proximity notifications
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapRef.current) return;
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            
            if (isValidCoordinate(userLat, userLng)) {
              // Store resident location for proximity checks
              residentLocationRef.current = { lat: userLat, lng: userLng };
              console.log('Resident location set for proximity checks:', userLat, userLng);
              
              const userLatLng: L.LatLngExpression = [userLat, userLng];
              
              // Remove existing resident marker if it exists
              if (residentMarkerRef.current && mapRef.current) {
                mapRef.current.removeLayer(residentMarkerRef.current);
                residentMarkerRef.current = null;
              }
              
              // Add user location marker with people icon - user's own location
              const peopleIcon = createPeopleIcon();
              const residentMarker = L.marker(userLatLng, { icon: peopleIcon })
                .bindPopup('Your Location')
                .addTo(mapRef.current);
              residentMarkerRef.current = residentMarker;
              
              // Check proximity for all existing trucks now that we have resident location
              truckMarkersRef.current.forEach((marker, truckNo) => {
                const latlng = marker.getLatLng();
                // Get collector info for the truck
                databaseService.getAccountsByRole('collector').then(collectors => {
                  const collector = collectors.find(c => c.truckNo === truckNo);
                  if (collector) {
                    checkTruckProximity(
                      truckNo,
                      latlng.lat,
                      latlng.lng,
                      collector.name || 'Collector'
                    );
                  }
                }).catch(err => console.error('Error checking proximity:', err));
              });
            }
          },
          () => {
            // Silently fail if user location can't be obtained
            console.log('User location not available');
          },
          { enableHighAccuracy: true, timeout: 5000 },
        );
        
        // Also set up watchPosition to update resident location as they move
        let watchId: number | null = null;
        if (navigator.geolocation.watchPosition) {
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              const userLat = pos.coords.latitude;
              const userLng = pos.coords.longitude;
              
              if (isValidCoordinate(userLat, userLng)) {
                residentLocationRef.current = { lat: userLat, lng: userLng };
                console.log('Resident location updated:', userLat, userLng);
                
                // Update resident marker position if it exists
                if (residentMarkerRef.current && mapRef.current) {
                  residentMarkerRef.current.setLatLng([userLat, userLng]);
                } else if (mapRef.current) {
                  // Create marker if it doesn't exist
                  const userLatLng: L.LatLngExpression = [userLat, userLng];
                  const peopleIcon = createPeopleIcon();
                  const residentMarker = L.marker(userLatLng, { icon: peopleIcon })
                    .bindPopup('Your Location')
                    .addTo(mapRef.current);
                  residentMarkerRef.current = residentMarker;
                }
              }
            },
            (error) => {
              console.error('Error watching resident location:', error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
          );
        }
        
        // Store watchId for cleanup (if needed in future)
        return () => {
          if (watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
          }
        };
      }
    }, 300);
  };

  // Check if truck is within notification radius and create notification
  const checkTruckProximity = async (
    truckNo: string,
    truckLat: number,
    truckLng: number,
    collectorName: string
  ) => {
    // Only check if resident location is available
    if (!residentLocationRef.current) return;
    
    const { lat: residentLat, lng: residentLng } = residentLocationRef.current;
    
    // Calculate distance in kilometers
    const distanceKm = calculateDistance(residentLat, residentLng, truckLat, truckLng);
    
    // Convert to meters
    const distanceMeters = distanceKm * 1000;
    
    // Check if truck is within 400m radius
    if (distanceMeters <= NOTIFICATION_RADIUS_METERS) {
      // Check if we've already notified about this truck
      if (!notifiedTrucksRef.current.has(truckNo)) {
        // Create notification
        const userId = getCurrentUserId();
        if (userId) {
          try {
            await databaseService.createNotification({
              userId,
              title: '🚛 Truck Nearby',
              message: `Truck ${truckNo} (${collectorName}) is within 400m of your location!`,
              type: 'info',
              read: false,
              link: '/resident/truck',
            });
            
            // Mark this truck as notified
            notifiedTrucksRef.current.add(truckNo);
            
            console.log(`Notification created: Truck ${truckNo} is ${Math.round(distanceMeters)}m away`);
          } catch (error) {
            console.error('Error creating proximity notification:', error);
          }
        }
      }
    } else {
      // Truck is outside radius - remove from notified set so it can notify again if it comes back
      // This allows re-notification if the truck leaves and comes back within radius
      if (notifiedTrucksRef.current.has(truckNo)) {
        notifiedTrucksRef.current.delete(truckNo);
        console.log(`Truck ${truckNo} left the 400m radius. Will notify again if it comes back.`);
      }
    }
  };

  // Set up periodic status updates for all trucks
  useEffect(() => {
    const updateTruckStatuses = async () => {
      try {
        await databaseService.init();
        const collectors = await databaseService.getAccountsByRole('collector');
        
        for (const collector of collectors) {
          if (collector.id && collector.truckNo && collector.truckNo.trim() !== '') {
            const status = await databaseService.getTruckStatus(collector.truckNo);
            const marker = truckMarkersRef.current.get(collector.truckNo);
            
            // If truck is not collecting and not full, remove it from map
            // Keep trucks that are full even if not collecting
            if (!status || (!status.isCollecting && !status.isFull)) {
              // Check if truck was previously visible (was collecting or full)
              const previousStatus = previousTruckStatusesRef.current.get(collector.truckNo);
              if (marker && mapRef.current) {
                // If truck was previously collecting or full, show "done for the day" message
                if (previousStatus && (previousStatus.isCollecting || previousStatus.isFull)) {
                  setToastMessage(`Truck ${collector.truckNo} is done for the day`);
                  setShowToast(true);
                }
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
              
              // Update marker position if GPS coordinates are available
              if (status.latitude !== undefined && status.longitude !== undefined && 
                  isValidCoordinate(status.latitude, status.longitude)) {
                marker.setLatLng([status.latitude, status.longitude]);
                
                // Check proximity and create notification if within 400m (only for collecting trucks)
                if (status.isCollecting) {
                  checkTruckProximity(
                    collector.truckNo,
                    status.latitude,
                    status.longitude,
                    collector.name || 'Collector'
                  );
                }
              }
              
              // Update icon based on status
              const icon = createTruckIcon(isFull, collector.truckNo);
              marker.setIcon(icon);
              
              // Update popup with new status
              const latlng = marker.getLatLng();
              const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, latlng.lat, latlng.lng);
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
                    history.push({
                      pathname: '/resident/report',
                      state: { truckNo: collector.truckNo }
                    });
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
            } else if (!marker && mapRef.current && (status.isCollecting || status.isFull)) {
              // Truck is collecting or full but marker doesn't exist - add it
              // Only show trucks with valid GPS coordinates - no default locations
              if (status.latitude === undefined || status.longitude === undefined || 
                  !isValidCoordinate(status.latitude, status.longitude)) {
                console.log(`Skipping truck ${collector.truckNo} - no valid GPS coordinates`);
                continue;
              }
              
              const truckLat = status.latitude;
              const truckLng = status.longitude;
                const isFull = status.isFull || false;
                const icon = createTruckIcon(isFull, collector.truckNo);
                const newMarker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current);
                
                const popupContent = createTruckPopup(collector.truckNo, collector.name || 'N/A', isFull, truckLat, truckLng);
                newMarker.bindPopup(popupContent, {
                  className: 'custom-truck-popup',
                  closeButton: false,
                });
                
                newMarker.on('popupopen', () => {
                  const reportBtn = document.getElementById(`truck-report-btn-${collector.truckNo}`);
                  if (reportBtn) {
                    reportBtn.onclick = () => {
                      history.push({
                        pathname: '/resident/report',
                        state: { truckNo: collector.truckNo }
                      });
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
                
                // Check proximity when new marker is added (only for collecting trucks)
                if (status.isCollecting && isValidCoordinate(truckLat, truckLng)) {
                  checkTruckProximity(
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

    // Update statuses immediately and then periodically
    updateTruckStatuses();
    const statusInterval = setInterval(updateTruckStatuses, 3000); // Check every 3 seconds for faster updates

    return () => {
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
    };
  }, []);

  const AnyMapView = MapView as React.ComponentType<any>;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#16a34a', '--color': '#ecfdf3' }}>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Track Truck</IonTitle>
          <IonButtons slot="end">
            <NotificationBell />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ position: 'relative', height: '100%', background: '#ecfdf3' }}>
          {/* Map section - full screen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 0,
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

