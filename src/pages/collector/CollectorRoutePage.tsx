// src/pages/collector/CollectorRoutePage.tsx

import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonButton, IonAlert, IonButtons, IonIcon } from '@ionic/react';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { busOutline } from 'ionicons/icons';

interface TruckLocation {
  truckId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface CollectorRoutePageProps {
  onBack?: () => void;
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

const CollectorRoutePage: React.FC<CollectorRoutePageProps> = ({ onBack }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [truckMarker, setTruckMarker] = useState<L.Marker | null>(null);
  const [truckFullAlert, setTruckFullAlert] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const whiteTruckIcon = L.divIcon({
    html: '🚛',
    className: 'watch-truck-icon watch-truck-icon--white',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const redTruckIcon = L.divIcon({
    html: '🚛',
    className: 'watch-truck-icon watch-truck-icon--red',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const stopIcon = L.divIcon({
    html: '🚩',
    className: 'watch-stop-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Updated coordinates for collection stops
      const donPedro: L.LatLngExpression = [14.682042, 121.076975];
      const donPrimitivo: L.LatLngExpression = [14.680823, 121.076206];
      const donElpidio: L.LatLngExpression = [14.679855, 121.077793];

      const stops: L.LatLngExpression[] = [donPedro, donPrimitivo, donElpidio];
      
      // Add labels to markers
      const stopLabels = ['Don Pedro', 'Don Primitivo', 'Don Elpidio'];

      // Add simple flag markers for each stop with labels
      stops.forEach((pos, index) => {
        const marker = L.marker(pos, { icon: stopIcon }).addTo(mapRef.current!);
        marker.bindPopup(`<div style="text-align: center; font-weight: 600;">${stopLabels[index]}</div>`);
      });

      // Function to update truck position
      const updateTruckPosition = (lat: number, lng: number) => {
        if (!mapRef.current) return;
        
        if (!isValidCoordinate(lat, lng)) {
          console.error('Invalid GPS coordinates:', lat, lng);
          return;
        }
        
        const latlng: L.LatLngExpression = [lat, lng];
        
        if (truckMarker) {
          // Update existing marker position
          truckMarker.setLatLng(latlng);
        } else {
          // Create new marker if it doesn't exist
          const marker = L.marker(latlng, { icon: whiteTruckIcon }).addTo(mapRef.current);
          setTruckMarker(marker);
          
          // Add click popup to truck marker
          marker.bindPopup(`
            <div style="text-align: center; padding: 0.5rem;">
              <div style="font-weight: 600; margin-bottom: 0.5rem;">🚛 Truck Information</div>
              <div style="font-size: 0.9rem;"><strong>Truck No:</strong> BCG 11*4</div>
              <div style="font-size: 0.9rem;"><strong>Truck Size:</strong> Large</div>
              <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
                Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
              </div>
            </div>
          `);
        }
      };

      // Get user's actual GPS location first, then place truck there
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapRef.current) return;
            
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            if (!isValidCoordinate(lat, lng)) {
              console.error('Invalid GPS coordinates from getCurrentPosition');
              // Fallback to first stop
              if (!mapRef.current) return;
              mapRef.current.setView(donPedro, 16);
              const marker = L.marker(donPedro, { icon: whiteTruckIcon }).addTo(mapRef.current);
              setTruckMarker(marker);
              marker.bindPopup(`
                <div style="text-align: center; padding: 0.5rem;">
                  <div style="font-weight: 600; margin-bottom: 0.5rem;">🚛 Truck Information</div>
                  <div style="font-size: 0.9rem;"><strong>Truck No:</strong> BCG 11*4</div>
                  <div style="font-size: 0.9rem;"><strong>Truck Size:</strong> Large</div>
                </div>
              `);
              mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
              return;
            }
            
            const latlng: L.LatLngExpression = [lat, lng];
            
            // Center map on user's actual location first
            mapRef.current.setView(latlng, 16);
            
            // Place truck at user's actual location
            updateTruckPosition(lat, lng);
            
            // Fit bounds to show both truck location and all stops
            const allPoints = [latlng, ...stops];
            mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [48, 48] });

            // Set up real-time location tracking (watchPosition)
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
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
            // If GPS fails, place truck at first stop
            console.error('GPS error:', error);
            if (!mapRef.current) return;
            mapRef.current.setView(donPedro, 16);
            const marker = L.marker(donPedro, { icon: whiteTruckIcon }).addTo(mapRef.current);
            setTruckMarker(marker);
            marker.bindPopup(`
              <div style="text-align: center; padding: 0.5rem;">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">🚛 Truck Information</div>
                <div style="font-size: 0.9rem;"><strong>Truck No:</strong> BCG 11*4</div>
                <div style="font-size: 0.9rem;"><strong>Truck Size:</strong> Large</div>
                <div style="font-size: 0.8rem; color: #ef4444; margin-top: 0.5rem;">⚠️ GPS unavailable</div>
              </div>
            `);
            mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        // Fallback if geolocation not available
        if (!mapRef.current) return;
        mapRef.current.setView(donPedro, 16);
        const marker = L.marker(donPedro, { icon: whiteTruckIcon }).addTo(mapRef.current);
        setTruckMarker(marker);
        marker.bindPopup(`
          <div style="text-align: center; padding: 0.5rem;">
            <div style="font-weight: 600; margin-bottom: 0.5rem;">🚛 Truck Information</div>
            <div style="font-size: 0.9rem;"><strong>Truck No:</strong> BCG 11*4</div>
            <div style="font-size: 0.9rem;"><strong>Truck Size:</strong> Large</div>
            <div style="font-size: 0.8rem; color: #ef4444; margin-top: 0.5rem;">⚠️ GPS not available</div>
          </div>
        `);
        mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
      }
    }, 300);
  };

  // Stop collecting - return to collector home page
  const onStopCollecting = () => {
    if (onBack) {
      onBack();
    }
  };

  const onTruckFullConfirm = async () => {
    if (truckMarker) {
      truckMarker.setIcon(redTruckIcon);
    }
    if (onBack) {
      onBack();
    }
  };

  const onTruckEmpty = async () => {
    if (truckMarker) {
      truckMarker.setIcon(whiteTruckIcon);
    }
  };

  useEffect(() => {
    // Cleanup marker and stop GPS tracking if the component unmounts
    return () => {
      if (truckMarker) {
        truckMarker.remove();
      }
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [truckMarker]);

  const AnyMapView = MapView as React.ComponentType<any>;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#ffffff', '--color': '#111827' }}>
          <IonButtons slot="start">
            <IonButton
              onClick={onBack}
              style={{
                '--color': '#16a34a',
                borderRadius: 999,
                backgroundColor: '#22c55e1a',
                paddingInline: '0.9rem',
              }}
            >
              BACK
            </IonButton>
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
        <div style={{ padding: '0.25rem 1rem 5.5rem' }}>
          <div className="watch-card" style={{ overflow: 'hidden', height: '63vh', borderRadius: 24 }}>
            <AnyMapView id="collector-map" center={[14.683726, 121.076224]} zoom={16} onMapReady={handleMapReady} />
          </div>
        </div>

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '0.75rem 1rem 1.25rem',
            background: 'linear-gradient(180deg, rgba(243,244,251,0.9) 0%, #f3f4fb 40%, #f3f4fb 100%)',
            boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
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
                backgroundColor: '#eab308',
                color: '#1f2937',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 14px 28px rgba(234, 179, 8, 0.6)',
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


