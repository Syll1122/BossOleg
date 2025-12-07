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
  const [menuEvent, setMenuEvent] = useState<MouseEvent | null>(null);
  const [truckIsFull, setTruckIsFull] = useState(false);
  const [collectorName, setCollectorName] = useState('Manong Collector');
  const [truckNo, setTruckNo] = useState('BCG 11*4');
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
                setTruckIsFull(status.isFull);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading collector data:', error);
      }
    };

    loadData();
  }, []);

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
  };

  const requestLocationAndStart = async () => {
    if (!navigator.geolocation) {
      setShowLocationError(true);
      return;
    }

    // If truck is full, empty it first
    if (truckIsFull) {
      try {
        const userId = getCurrentUserId();
        if (userId) {
          await databaseService.updateTruckStatus(truckNo, false, userId);
          setTruckIsFull(false);
        }
      } catch (error) {
        console.error('Error updating truck status:', error);
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
        }
        onStartCollecting();
      },
      () => {
        setShowLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
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
                    // Navigate to route page with selected location
                    onStartCollecting(location);
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 999,
                    border: 'none',
                    padding: '0.9rem 1.2rem',
                    backgroundColor: '#16a34a',
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
                  {location.name}
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
          message="We couldn’t access your location. Please enable GPS / location permissions and try again."
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
                history.push('/');
              }}
            >
              Go to Home page
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


