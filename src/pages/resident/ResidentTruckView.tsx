// src/pages/resident/ResidentTruckView.tsx

import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonText } from '@ionic/react';
import { arrowBackOutline, busOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import * as L from 'leaflet';
import MapView from '../../components/MapView';

const ResidentTruckView: React.FC = () => {
  const history = useHistory();
  const mapRef = useRef<L.Map | null>(null);
  const [truckMarker, setTruckMarker] = useState<L.Marker | null>(null);
  const [truckLocation, setTruckLocation] = useState({ lat: 14.6803, lng: 121.0598 });
  const updateIntervalRef = useRef<number | null>(null);

  // Mock truck data - replace with real API call later
  const truckData = {
    truckNo: 'BCG 11*4',
    size: 'Large',
    lat: 14.6803,
    lng: 121.0598,
  };

  const truckIcon = L.divIcon({
    html: '🚛',
    className: 'watch-truck-icon watch-truck-icon--white',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });


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

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Use current truck location state (which may be updated in real-time)
      const currentLat = truckLocation.lat;
      const currentLng = truckLocation.lng;

      // Validate truck coordinates first
      if (!isValidCoordinate(currentLat, currentLng)) {
        console.error('Invalid truck coordinates:', currentLat, currentLng);
        return;
      }

      // Use actual truck location (not user's GPS)
      const truckLatLng: L.LatLngExpression = [currentLat, currentLng];
      
      // Center map on truck location
      mapRef.current.setView(truckLatLng, 16);
      
      // Place truck marker at actual truck location
      const marker = L.marker(truckLatLng, { icon: truckIcon }).addTo(mapRef.current);
      setTruckMarker(marker);
      
      // Create popup content with report button
      const popupContent = document.createElement('div');
      popupContent.style.textAlign = 'center';
      popupContent.style.padding = '0.75rem';
      popupContent.style.minWidth = '200px';
      popupContent.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">🚛 Truck Information</div>
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck No:</strong> ${truckData.truckNo}</div>
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck Size:</strong> ${truckData.size}</div>
        <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.75rem;">
          Lat: ${currentLat.toFixed(6)}, Lng: ${currentLng.toFixed(6)}
        </div>
        <button id="truck-report-btn" style="
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
        ">⚠️ Report Issue</button>
      `;
      
      marker.bindPopup(popupContent);
      
      marker.on('popupopen', () => {
        const btn = document.getElementById('truck-report-btn');
        if (btn) {
          btn.onclick = () => {
            history.push('/resident/report');
          };
        }
      });

      // Optionally add user location marker if GPS is available (for reference)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
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
            }
          },
          () => {
            // Silently fail if user location can't be obtained
            console.log('User location not available');
          },
          { enableHighAccuracy: true, timeout: 5000 },
        );
      }

      // Set up periodic location updates (simulating real-time tracking)
      // In production, this should fetch from your backend API
      // Note: This interval will be set up in a separate useEffect after marker is created
    }, 300);
  };

  // Set up periodic location updates when marker is created
  useEffect(() => {
    if (!truckMarker) return;

    // Set up periodic location updates (simulating real-time tracking)
    // In production, this should fetch from your backend API
    updateIntervalRef.current = window.setInterval(() => {
      // TODO: Replace with actual API call to get truck location
      // Example: fetchTruckLocation(truckData.truckNo).then(location => {
      //   if (isValidCoordinate(location.lat, location.lng)) {
      //     setTruckLocation({ lat: location.lat, lng: location.lng });
      //   }
      // });
      
      // For now, we'll just check if the location state has changed
      // The location will be updated via setTruckLocation when API is integrated
    }, 10000); // Update every 10 seconds (adjust as needed)

    return () => {
      if (updateIntervalRef.current !== null) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [truckMarker]);

  // Update truck marker when location changes
  useEffect(() => {
    if (truckMarker && isValidCoordinate(truckLocation.lat, truckLocation.lng)) {
      const currentPos = truckMarker.getLatLng();
      // Only update if position actually changed (avoid unnecessary updates)
      if (Math.abs(currentPos.lat - truckLocation.lat) > 0.0001 || Math.abs(currentPos.lng - truckLocation.lng) > 0.0001) {
        truckMarker.setLatLng([truckLocation.lat, truckLocation.lng]);
        
        // Update popup with new coordinates
        const popupContent = document.createElement('div');
        popupContent.style.textAlign = 'center';
        popupContent.style.padding = '0.75rem';
        popupContent.style.minWidth = '200px';
        popupContent.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">🚛 Truck Information</div>
          <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck No:</strong> ${truckData.truckNo}</div>
          <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck Size:</strong> ${truckData.size}</div>
          <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.75rem;">
            Lat: ${truckLocation.lat.toFixed(6)}, Lng: ${truckLocation.lng.toFixed(6)}
          </div>
          <button id="truck-report-btn-updated" style="
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
          ">⚠️ Report Issue</button>
        `;
        
        truckMarker.bindPopup(popupContent);
        
        truckMarker.on('popupopen', () => {
          const btn = document.getElementById('truck-report-btn-updated');
          if (btn) {
            btn.onclick = () => {
              history.push('/resident/report');
            };
          }
        });
      }
    }
  }, [truckLocation, truckMarker, history, truckData]);

  useEffect(() => {
    return () => {
      if (truckMarker) {
        truckMarker.remove();
      }
      if (updateIntervalRef.current !== null) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [truckMarker]);

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
            <AnyMapView id="resident-truck-map" center={[truckLocation.lat, truckLocation.lng]} zoom={16} onMapReady={handleMapReady} />
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ResidentTruckView;

