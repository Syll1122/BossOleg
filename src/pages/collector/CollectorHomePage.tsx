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
} from '@ionic/react';
import { menuOutline, personCircleOutline } from 'ionicons/icons';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { useHistory } from 'react-router-dom';
import { logout, getCurrentUserId } from '../../utils/auth';
import { databaseService } from '../../services/database';
import NotificationBell from '../../components/NotificationBell';
import { requestGeolocation, getGeolocationErrorMessage, isSecureContext } from '../../utils/geolocation';
import { isValidCoordinate } from '../../utils/coordinates';

interface ScheduleLocation {
  name: string;
  lat: number;
  lng: number;
}

interface CollectorHomePageProps {
  onStartCollecting: (selectedLocation?: ScheduleLocation) => void;
}

const CollectorHomePage: React.FC<CollectorHomePageProps> = ({ onStartCollecting }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showLocationError, setShowLocationError] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState('');
  const [menuEvent, setMenuEvent] = useState<MouseEvent | null>(null);
  const [truckIsFull, setTruckIsFull] = useState(false);
  const [collectorName, setCollectorName] = useState('Manong Collector');
  const [truckNo, setTruckNo] = useState('BCG 11*4');
  const [scheduleFlags, setScheduleFlags] = useState<Map<string, L.Marker>>(new Map());
  const history = useHistory();

  // Schedule locations with coordinates
  const scheduleLocations: ScheduleLocation[] = [
    { name: 'Don Pedro, HOLY SPIRIT', lat: 14.682042, lng: 121.076975 },
    { name: 'Don Primitivo, HOLY SPIRIT', lat: 14.680823, lng: 121.076206 },
    { name: 'Don Elpidio, HOLY SPIRIT', lat: 14.679855, lng: 121.077793 },
  ];

  // Load collector name and truck status
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

    // Load and display all collector trucks on the map
    const loadAllTrucks = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (!userId) return;

        // Get current user's account
        const currentAccount = await databaseService.getAccountById(userId);
        if (!currentAccount?.truckNo) return;

        // Get all collector accounts
        const collectors = await databaseService.getAccountsByRole('collector');
        
        // Create truck icon function
        const createTruckIcon = (isRed: boolean, truckNumber: string) => {
          return L.divIcon({
            html: `
              <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 24px;">🚛</div>
                <div style="background: ${isRed ? '#ef4444' : 'white'}; color: ${isRed ? 'white' : '#1f2937'}; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-top: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap;">
                  ${truckNumber}
                </div>
              </div>
            `,
            className: isRed ? 'watch-truck-icon watch-truck-icon--red' : 'watch-truck-icon watch-truck-icon--white',
            iconSize: [50, 42],
            iconAnchor: [25, 38],
          });
        };

        // Add markers for all collector trucks (only those with valid accounts and truck numbers)
        for (const collector of collectors) {
          // Only show trucks that have valid accounts with truck numbers, and exclude current user
          if (collector.id && collector.truckNo && collector.truckNo.trim() !== '' && collector.id !== userId) {
            // Get truck status
            const status = await databaseService.getTruckStatus(collector.truckNo);
            const isFull = status?.isFull || false;
            
            // Use default location (you can enhance this to get actual GPS location)
            // For now, placing them at different locations around the center
            const baseLat = 14.683726;
            const baseLng = 121.076224;
            const offset = collectors.indexOf(collector) * 0.002; // Small offset for each truck
            
            const truckLat = baseLat + offset;
            const truckLng = baseLng + offset;
            
            const icon = createTruckIcon(isFull, collector.truckNo);
            const marker = L.marker([truckLat, truckLng], { icon }).addTo(map);
            
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
                  id="truck-close-btn-${collector.truckNo}"
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
          }
        }
      } catch (error) {
        console.error('Error loading other trucks:', error);
      }
    };

    // Wait a bit for map to be fully ready
    setTimeout(() => {
      loadAllTrucks();
      
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

  const requestLocationAndStart = async () => {
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

    // If truck is full, we'll empty it when route page loads
    // Don't set isFull = false here, let the route page handle it
    // This prevents the button from flickering back to "Start Collecting"

    requestGeolocation(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
        }
        // Start collecting - this will navigate to route page
        // Route page will set isFull = false and isCollecting = true
        onStartCollecting();
      },
      (error) => {
        if (error instanceof GeolocationPositionError) {
          setLocationErrorMessage(getGeolocationErrorMessage(error));
        } else {
          setLocationErrorMessage(error.message || 'Failed to get location. Please try again.');
        }
        setShowLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
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
            background: '#ecfdf3',
          }}
        >
          {/* Map section */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              height: '54%',
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
                backgroundColor: 'rgba(255,255,255,0.9)',
                boxShadow: '0 6px 14px rgba(15,23,42,0.18)',
              }}
            >
              <IonIcon icon={personCircleOutline} style={{ fontSize: '1.4rem', color: '#4b286d' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{collectorName}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <NotificationBell />
              <IonButton
                fill="clear"
                style={{
                  '--color': '#1f2933',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  borderRadius: 999,
                  minWidth: 42,
                  height: 42,
                  boxShadow: '0 6px 14px rgba(15,23,42,0.18)',
                }}
                onClick={(e) => setMenuEvent(e.nativeEvent)}
              >
                <IonIcon icon={menuOutline} />
              </IonButton>
            </div>
          </div>

          {/* Bottom sheet with schedule & start button */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '1.25rem 1rem 1.5rem',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              background: '#f3f4fb',
              boxShadow: '0 -14px 32px rgba(15,23,42,0.16)',
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
              justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (truckIsFull) {
                    // Continue collecting - go directly to route page
                    onStartCollecting();
                  } else {
                    // Start collecting - show location prompt first
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
                  background:
                    'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #4ade80 100%)',
                  color: '#ecfdf3',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  boxShadow: '0 12px 26px rgba(22, 163, 74, 0.6)',
                  transform: 'translateX(-4px)',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '999px',
                    backgroundColor: 'rgba(22, 163, 74, 0.2)',
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

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Truck No:</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{truckNo}</div>
              </div>
            </div>

            <div style={{ marginBottom: '0.6rem', fontSize: '0.9rem', fontWeight: 600 }}>
              Today Schedule:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {scheduleLocations.map((location) => (
                <button
                  key={location.name}
                  type="button"
                  onClick={() => {
                    // Drop flag on map without starting collection
                    if (mapRef.current) {
                      // Remove existing flag for this location if it exists
                      const existingFlag = scheduleFlags.get(location.name);
                      if (existingFlag) {
                        mapRef.current.removeLayer(existingFlag);
                        scheduleFlags.delete(location.name);
                        setScheduleFlags(new Map(scheduleFlags));
                      } else {
                        // Add new flag
                        const flagIcon = L.divIcon({
                          html: '📍',
                          className: 'watch-stop-icon',
                          iconSize: [32, 32],
                          iconAnchor: [16, 32],
                        });
                        const marker = L.marker([location.lat, location.lng], { icon: flagIcon }).addTo(mapRef.current);
                        marker.bindPopup(`<div style="text-align: center; font-weight: 600; padding: 0.5rem;">📍 ${location.name}</div>`);
                        marker.openPopup();
                        
                        // Center map on the flag
                        mapRef.current.setView([location.lat, location.lng], 17);
                        
                        // Store flag in state
                        const newFlags = new Map(scheduleFlags);
                        newFlags.set(location.name, marker);
                        setScheduleFlags(newFlags);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 999,
                    border: 'none',
                    padding: '0.9rem 1.2rem',
                    backgroundColor: scheduleFlags.has(location.name) ? '#22c55e' : '#16a34a',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    boxShadow: '0 10px 22px rgba(22,163,74,0.45)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 12px 26px rgba(22,163,74,0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 10px 22px rgba(22,163,74,0.45)';
                  }}
                >
                  {scheduleFlags.has(location.name) ? '📍 ' : ''}{location.name}
                </button>
              ))}
            </div>
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
          buttons={[{ text: 'OK', role: 'cancel' }]}
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


