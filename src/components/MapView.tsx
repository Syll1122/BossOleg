// src/components/MapView.tsx

import React, { useEffect } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  id: string;
  center: [number, number];
  zoom?: number;
  onMapReady?: (map: L.Map) => void;
}

const MapView: React.FC<MapViewProps> = ({ id, center, zoom = 15, onMapReady }) => {
  useEffect(() => {
    const map = L.map(id).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);
    onMapReady?.(map);
    return () => {
      map.remove();
    };
    // Only depend on `id` so the map is created once for this container.
    // Parent components can interact with the map instance via `onMapReady`.
  }, [id]);

  return <div id={id} style={{ width: '100%', height: '100%' }} />;
};

export default MapView;
