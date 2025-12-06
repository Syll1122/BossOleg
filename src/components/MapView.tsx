// src/components/MapView.tsx

import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  id: string;
  center: [number, number];
  zoom?: number;
  onMapReady?: (map: L.Map) => void;
}

const MapView: React.FC<MapViewProps> = ({ id, center, zoom = 15, onMapReady }) => {
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    // Validate center coordinates
    const [lat, lng] = center;
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      console.error('Invalid map center coordinates:', center);
      return;
    }

    // Create map instance
    const map = L.map(id, {
      center: center,
      zoom: zoom,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // Create primary tile layer with error handling
    const primaryTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // 1x1 transparent pixel
    });

    // Create fallback tile layer (CartoDB Positron)
    const fallbackTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    });

    // Add primary tile layer
    primaryTileLayer.addTo(map);
    tileLayerRef.current = primaryTileLayer;

    // Handle tile loading errors and switch to fallback
    primaryTileLayer.on('tileerror', () => {
      if (tileLayerRef.current === primaryTileLayer) {
        map.removeLayer(primaryTileLayer);
        fallbackTileLayer.addTo(map);
        tileLayerRef.current = fallbackTileLayer;
        console.warn('Primary tile layer failed, switched to fallback');
      }
    });

    // Notify parent component that map is ready
    onMapReady?.(map);

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
    };
  }, [id]); // Only recreate map when id changes

  // Update map center and zoom when props change (without recreating the map)
  useEffect(() => {
    if (mapInstanceRef.current) {
      const [lat, lng] = center;
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        mapInstanceRef.current.setView([lat, lng], zoom);
      }
    }
  }, [center, zoom]);

  return <div id={id} style={{ width: '100%', height: '100%' }} />;
};

export default MapView;
