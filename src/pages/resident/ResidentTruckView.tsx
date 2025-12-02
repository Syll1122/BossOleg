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


  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;

    // Wait for map to be fully initialized before adding markers
    setTimeout(() => {
      if (!mapRef.current) return;

      // Get truck location from GPS (same as collector location)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapRef.current) return;
            
            const truckLatLng: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
            // Center map on GPS location first
            mapRef.current.setView(truckLatLng, 16);
            
            // Place truck at GPS location (same as collector)
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
              <div style="font-size: 0.9rem; margin-bottom: 0.75rem;"><strong>Truck Size:</strong> ${truckData.size}</div>
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
            
            // Add user location marker (blue circle) - user's own location
            const userLatLng: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
            L.circleMarker(userLatLng, {
              radius: 8,
              fillColor: '#3b82f6',
              color: '#ffffff',
              weight: 2,
              fillOpacity: 0.8,
            }).addTo(mapRef.current);
          },
          () => {
            // If GPS fails, use default location
            if (!mapRef.current) return;
            mapRef.current.setView([truckData.lat, truckData.lng], 16);
            const marker = L.marker([truckData.lat, truckData.lng], { icon: truckIcon }).addTo(mapRef.current);
            setTruckMarker(marker);
            
            // Create popup content with report button
            const popupContent = document.createElement('div');
            popupContent.style.textAlign = 'center';
            popupContent.style.padding = '0.75rem';
            popupContent.style.minWidth = '200px';
            popupContent.innerHTML = `
              <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">🚛 Truck Information</div>
              <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck No:</strong> ${truckData.truckNo}</div>
              <div style="font-size: 0.9rem; margin-bottom: 0.75rem;"><strong>Truck Size:</strong> ${truckData.size}</div>
              <button id="truck-report-btn-fallback" style="
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
              const btn = document.getElementById('truck-report-btn-fallback');
              if (btn) {
                btn.onclick = () => {
                  history.push('/resident/report');
                };
              }
            });
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        // Fallback if geolocation not available
        if (!mapRef.current) return;
        mapRef.current.setView([truckData.lat, truckData.lng], 16);
        const marker = L.marker([truckData.lat, truckData.lng], { icon: truckIcon }).addTo(mapRef.current);
        setTruckMarker(marker);
        
        // Create popup content with report button
        const popupContent = document.createElement('div');
        popupContent.style.textAlign = 'center';
        popupContent.style.padding = '0.75rem';
        popupContent.style.minWidth = '200px';
        popupContent.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">🚛 Truck Information</div>
          <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Truck No:</strong> ${truckData.truckNo}</div>
          <div style="font-size: 0.9rem; margin-bottom: 0.75rem;"><strong>Truck Size:</strong> ${truckData.size}</div>
          <button id="truck-report-btn-no-geo" style="
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
          const btn = document.getElementById('truck-report-btn-no-geo');
          if (btn) {
            btn.onclick = () => {
              history.push('/resident/report');
            };
          }
        });
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (truckMarker) {
        truckMarker.remove();
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
            <AnyMapView id="resident-truck-map" center={[truckData.lat, truckData.lng]} zoom={16} onMapReady={handleMapReady} />
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ResidentTruckView;

