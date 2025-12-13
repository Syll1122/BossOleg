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

    // Wait for container to have proper dimensions, then invalidate size
    // This fixes the common Leaflet issue where map renders as a small square
    const invalidateSizeWithDelay = () => {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) {
          // Small delay to ensure container has final dimensions
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize();
              console.log('Map size invalidated after initialization');
            }
          }, 100);
        }
      });
    };

    invalidateSizeWithDelay();

    // Also invalidate on window resize
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Notify parent component that map is ready
    onMapReady?.(map);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
    };
  }, [id]); // Only recreate map when id changes

  // Track the last center/zoom we set to avoid unnecessary updates
  const lastCenterRef = useRef<[number, number] | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // Only update map center/zoom when props actually change
  // This prevents the map from resetting when component re-renders
  useEffect(() => {
    if (!mapInstanceRef.current) return;

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
      return;
    }

    // Check if this is the first time setting center
    if (!isInitializedRef.current) {
      mapInstanceRef.current.setView([lat, lng], zoom);
      lastCenterRef.current = [lat, lng];
      lastZoomRef.current = zoom;
      isInitializedRef.current = true;
      return;
    }

    // Only update if center or zoom actually changed
    const centerChanged = lastCenterRef.current === null ||
      Math.abs(lastCenterRef.current[0] - lat) > 0.0001 ||
      Math.abs(lastCenterRef.current[1] - lng) > 0.0001;
    
    const zoomChanged = lastZoomRef.current === null || lastZoomRef.current !== zoom;

    // Don't update if values haven't changed - this prevents map reset on re-renders
    if (!centerChanged && !zoomChanged) {
      return;
    }

    // Only update if center changed significantly (more than 1 meter)
    // This prevents resetting when user has manually panned the map
    if (centerChanged && lastCenterRef.current) {
      const currentCenter = mapInstanceRef.current.getCenter();
      const distance = mapInstanceRef.current.distance(
        currentCenter,
        L.latLng(lastCenterRef.current[0], lastCenterRef.current[1])
      );
      
      // If user has moved the map more than 10 meters, don't reset it
      // This means they intentionally moved it, so respect their choice
      if (distance > 10) {
        // User has manually moved the map, don't reset it
        // Only update zoom if it changed
        if (zoomChanged) {
          mapInstanceRef.current.setZoom(zoom);
          lastZoomRef.current = zoom;
        }
        return;
      }
    }

    // Update map view only if center/zoom actually changed
    if (centerChanged || zoomChanged) {
      if (centerChanged && zoomChanged) {
        mapInstanceRef.current.setView([lat, lng], zoom);
      } else if (centerChanged) {
        mapInstanceRef.current.panTo([lat, lng]);
      } else if (zoomChanged) {
        mapInstanceRef.current.setZoom(zoom);
      }
      lastCenterRef.current = [lat, lng];
      lastZoomRef.current = zoom;
    }
  }, [center, zoom]);

  return <div id={id} style={{ width: '100%', height: '100%' }} />;
};

export default MapView;
