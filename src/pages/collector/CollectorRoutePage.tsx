import React, { useRef, useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonButton, IonAlert, IonButtons, IonIcon, IonSearchbar } from '@ionic/react';
import { busOutline, searchOutline } from 'ionicons/icons';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';
import { requestGeolocation, getGeolocationErrorMessage, isSecureContext } from '../../utils/geolocation';
import { isValidCoordinate } from '../../utils/coordinates';
import RefreshButton from '../../components/RefreshButton';

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
  streetId?: string;
  routeCoordinates?: [number, number][];
}

interface CollectorRoutePageProps {
  onBack?: (stoppedCollecting?: boolean) => void;
  selectedLocation?: ScheduleLocation;
  selectedDay?: string | null;
  dayLocations?: DayLocation[];
}

const CollectorRoutePage: React.FC<CollectorRoutePageProps> = ({ onBack, selectedLocation, selectedDay, dayLocations = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const truckMarkerRef = useRef<L.Marker | null>(null);
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const navigationPolylineRef = useRef<L.Polyline | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const otherTrucksRef = useRef<Map<string, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const isCollectingRef = useRef<boolean>(true);
  const [truckNo, setTruckNo] = useState('');
  const [selectedStreetId, setSelectedStreetId] = useState<string | null>(null);
  const [highlightedPolylineId, setHighlightedPolylineId] = useState<string | null>(null);
  const [enhancedLocations, setEnhancedLocations] = useState<DayLocation[]>(dayLocations);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [truckFullAlert, setTruckFullAlert] = useState(false);

  useEffect(() => {
    const loadTruckNo = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (userId) {
          const account = await databaseService.getAccountById(userId);
          if (account?.truckNo) setTruckNo(account.truckNo);
        }
      } catch (error) {
        console.error('Error loading truck number:', error);
      }
    };
    loadTruckNo();
  }, []);

  // Refresh function - reloads truck data and updates status
  const handleRefresh = async () => {
    await databaseService.init();
    const userId = getCurrentUserId();
    if (userId && truckNo) {
      try {
        const account = await databaseService.getAccountById(userId);
        if (account?.truckNo) setTruckNo(account.truckNo);
        
        const status = await databaseService.getTruckStatus(truckNo);
        if (status && truckMarkerRef.current) {
          truckMarkerRef.current.setIcon(createTruckIcon(status.isFull || false, truckNo));
          if (status.latitude && status.longitude && isValidCoordinate(status.latitude, status.longitude)) {
            truckMarkerRef.current.setLatLng([status.latitude, status.longitude]);
            if (mapRef.current) {
              mapRef.current.setView([status.latitude, status.longitude], mapRef.current.getZoom());
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
      if (!truckNo) return;
      
      try {
        isCollectingRef.current = true;
        const userId = getCurrentUserId();
        if (userId) {
          const currentStatus = await databaseService.getTruckStatus(truckNo);
          await databaseService.updateTruckStatus(
            truckNo, 
            false, 
            userId, 
            true,
            currentStatus?.latitude,
            currentStatus?.longitude
          );
          console.log(`Truck ${truckNo} set as collecting (isFull = false, isCollecting = true)`);
          
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
    
    return () => {
      const cleanup = async () => {
        try {
          isCollectingRef.current = false;
          if (watchIdRef.current !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          
          const userId = getCurrentUserId();
          if (userId && truckNo) {
            const currentStatus = await databaseService.getTruckStatus(truckNo);
            const preserveIsFull = currentStatus?.isFull || false;
            
            if (preserveIsFull) {
              await databaseService.updateTruckStatus(
                truckNo, 
                preserveIsFull, 
                userId, 
                false,
                currentStatus?.latitude,
                currentStatus?.longitude
              );
            } else {
              await databaseService.updateTruckStatus(truckNo, false, userId, false, null, null);
            }
          }
        } catch (error) {
          console.error('Error cleaning up truck status:', error);
        }
      };
      cleanup();
    };
  }, [truckNo]);

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (!userId || dayLocations.length === 0) return;

        const needsRouteCoordinates = dayLocations.some(loc => !loc.routeCoordinates);
        if (!needsRouteCoordinates) {
          setEnhancedLocations(dayLocations);
          return;
        }

        const schedules = await databaseService.getSchedulesByCollectorId(userId);
        const updated = dayLocations.map(location => {
          if (location.routeCoordinates) return location;
          
          const schedule = schedules.find(s => s.id === location.scheduleId);
          if (schedule?.latitude && schedule?.longitude &&
              Array.isArray(schedule.latitude) && Array.isArray(schedule.longitude) &&
              schedule.latitude.length > 1 && schedule.longitude.length > 1) {
            
            const routeCoordinates: [number, number][] = [];
            for (let i = 0; i < Math.min(schedule.latitude.length, schedule.longitude.length); i++) {
              const lat = Number(schedule.latitude[i]);
              const lng = Number(schedule.longitude[i]);
              if (!isNaN(lat) && !isNaN(lng)) routeCoordinates.push([lat, lng]);
            }
            
            if (routeCoordinates.length > 1) {
              return { ...location, routeCoordinates };
            }
          }
          return location;
        });
        setEnhancedLocations(updated);
      } catch (error) {
        console.error('Error loading schedules:', error);
        setEnhancedLocations(dayLocations);
      }
    };
    if (dayLocations.length > 0) loadSchedules();
  }, [dayLocations]);

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

  const fetchNavigationRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<Array<[number, number]> | null> => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      }
      return null;
    } catch (error) {
      console.error('Error fetching navigation route:', error);
      return null;
    }
  };

  const renderRoutePolylines = () => {
    if (!mapRef.current) return;

    routePolylinesRef.current.forEach(polyline => {
      if (mapRef.current?.hasLayer(polyline)) mapRef.current.removeLayer(polyline);
    });
    routePolylinesRef.current.clear();

    enhancedLocations.forEach(location => {
      if (location.routeCoordinates && location.routeCoordinates.length > 1) {
        const isHighlighted = highlightedPolylineId === location.scheduleId;
        const polyline = L.polyline(location.routeCoordinates, {
          color: isHighlighted ? '#22c55e' : '#3b82f6',
          weight: 6,
          opacity: 0.7
        }).addTo(mapRef.current!);

        polyline.on('click', () => handleStreetSelect(location));
        const displayText = location.streetId || location.street || location.barangay;
        polyline.bindPopup(`<strong>Route</strong><br/>${displayText}<br/>${location.barangay}<br/>Click to navigate`);
        routePolylinesRef.current.set(location.scheduleId, polyline);
      }
    });
  };

  const handleStreetSelect = async (location: DayLocation) => {
    if (!mapRef.current || !truckMarkerRef.current) return;

    const currentPolyline = routePolylinesRef.current.get(location.scheduleId);
    if (currentPolyline) {
      if (highlightedPolylineId && highlightedPolylineId !== location.scheduleId) {
        const prevPolyline = routePolylinesRef.current.get(highlightedPolylineId);
        if (prevPolyline) prevPolyline.setStyle({ color: '#3b82f6' });
      }
      currentPolyline.setStyle({ color: '#22c55e' });
      setHighlightedPolylineId(location.scheduleId);
    }

    const truckLatLng = truckMarkerRef.current.getLatLng();
    let destLat: number, destLng: number;
    
    if (location.routeCoordinates?.length) {
      destLat = location.routeCoordinates[0][0];
      destLng = location.routeCoordinates[0][1];
    } else {
      destLat = location.lat;
      destLng = location.lng;
    }

    if (navigationPolylineRef.current && mapRef.current.hasLayer(navigationPolylineRef.current)) {
      mapRef.current.removeLayer(navigationPolylineRef.current);
    }

    const navRoute = await fetchNavigationRoute(truckLatLng.lat, truckLatLng.lng, destLat, destLng);
    if (navRoute && navRoute.length > 1) {
      const navPolyline = L.polyline(navRoute, {
        color: '#f59e0b',
        weight: 8,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(mapRef.current!);
      navigationPolylineRef.current = navPolyline;
      const bounds = L.latLngBounds([truckLatLng.lat, truckLatLng.lng], [destLat, destLng]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

    setSelectedStreetId(location.scheduleId);
  };

  const updateTruckPosition = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    
    if (!isCollectingRef.current) {
      console.log('Truck is not collecting, ignoring GPS update');
      return;
    }
    
    if (!isValidCoordinate(lat, lng)) {
      console.error('Invalid GPS coordinates:', lat, lng);
      return;
    }
    
    const latlng: L.LatLngExpression = [lat, lng];
    
    // Create or update radius circle
    if (radiusCircleRef.current && mapRef.current) {
      radiusCircleRef.current.setLatLng(latlng);
    } else if (mapRef.current) {
      const radiusCircle = L.circle(latlng, {
        radius: 400,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '5, 5',
      }).bindPopup('400m Notification Radius - Residents within this area will be notified').addTo(mapRef.current);
      radiusCircleRef.current = radiusCircle;
    }
    
    if (!truckNo) {
      console.log('Truck number not available, skipping marker update');
      return;
    }
    
    // Update database
    const updateTruckStatus = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (userId && truckNo && isCollectingRef.current) {
          await databaseService.updateTruckStatus(truckNo, false, userId, true, lat, lng);
          console.log(`Truck ${truckNo} location updated: ${lat}, ${lng}`);
        }
      } catch (error) {
        console.error('Error updating truck GPS position in database:', error);
      }
    };
    updateTruckStatus();
    
    // Update marker
    if (!truckMarkerRef.current) {
      const icon = createTruckIcon(false, truckNo);
      truckMarkerRef.current = L.marker(latlng, { icon }).addTo(mapRef.current);
      const popupContent = createTruckInfoPopup(truckNo, lat, lng);
      truckMarkerRef.current.bindPopup(popupContent, {
        className: 'custom-truck-popup',
        closeButton: false,
      });
      truckMarkerRef.current.on('popupopen', () => {
        const closeBtn = document.getElementById(`truck-info-close-btn-${truckNo}`);
        if (closeBtn) {
          closeBtn.onclick = () => truckMarkerRef.current?.closePopup();
        }
      });
    } else {
      truckMarkerRef.current.setLatLng(latlng);
      truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      const popupContent = createTruckInfoPopup(truckNo, lat, lng);
      truckMarkerRef.current.bindPopup(popupContent, {
        className: 'custom-truck-popup',
        closeButton: false,
      });
    }
  };

  // Load and display other collector trucks
  const loadAllTrucks = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId || !mapRef.current) return;

      const collectors = await databaseService.getAccountsByRole('collector');
      const currentTruckNo = truckNo;
      
      otherTrucksRef.current.forEach((marker) => {
        if (mapRef.current && mapRef.current.hasLayer(marker)) {
          mapRef.current.removeLayer(marker);
        }
      });
      otherTrucksRef.current.clear();
      
      for (const collector of collectors) {
        if (collector.id && collector.truckNo && collector.truckNo.trim() !== '' && 
            collector.id !== userId && collector.truckNo !== currentTruckNo) {
          
          const isOnline = collector.isOnline === true;
          const status = await databaseService.getTruckStatus(collector.truckNo);
          
          if (!isOnline || !status || !status.isCollecting) continue;
          
          const isFull = status?.isFull || false;
          if (status.latitude === undefined || status.longitude === undefined) continue;
          
          const truckLat = status.latitude;
          const truckLng = status.longitude;
          
          if (!isValidCoordinate(truckLat, truckLng)) continue;
          
          const icon = createTruckIcon(isFull, collector.truckNo);
          const marker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current!);
          
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
          
          otherTrucksRef.current.set(collector.truckNo, marker);
        }
      }
    } catch (error) {
      console.error('Error loading other trucks:', error);
    }
  };

  // Handle search functionality
  const handleSearch = async () => {
    if (!mapRef.current || !searchQuery.trim()) return;

    try {
      const coordMatch = searchQuery.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isValidCoordinate(lat, lng)) {
          const pos: L.LatLngExpression = [lat, lng];
          if (searchMarkerRef.current) searchMarkerRef.current.remove();
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
          if (searchMarkerRef.current) searchMarkerRef.current.remove();
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

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
    
    const fixMapSize = () => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 100);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 300);
    };

    requestAnimationFrame(() => {
      setTimeout(fixMapSize, 50);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mapRef.current) {
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    setTimeout(() => {
      if (!mapRef.current) return;

      // Load collector's own truck position from database
      const loadCollectorTruckPosition = async () => {
        try {
          const userId = getCurrentUserId();
          if (!userId || !mapRef.current) return;

          let currentTruckNo = truckNo;
          if (!currentTruckNo) {
            const account = await databaseService.getAccountById(userId);
            if (account?.truckNo) {
              currentTruckNo = account.truckNo;
              setTruckNo(account.truckNo);
            }
          }

          if (!currentTruckNo) return;

          const status = await databaseService.getTruckStatus(currentTruckNo);
          
          if (status && status.latitude !== undefined && status.longitude !== undefined && 
              isValidCoordinate(status.latitude, status.longitude)) {
            const latlng: L.LatLngExpression = [status.latitude, status.longitude];
            
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

            if (!truckMarkerRef.current || !mapRef.current.hasLayer(truckMarkerRef.current)) {
              const icon = createTruckIcon(false, currentTruckNo);
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
                  closeBtn.onclick = () => marker.closePopup();
                }
              });

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

      loadCollectorTruckPosition();
      loadAllTrucks();

      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by your browser.');
        renderRoutePolylines();
        return;
      }

      if (!isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('GPS requires HTTPS. Please access the app via https:// or use localhost.');
      }

      const requestInitialLocation = (retryAttempt: number = 0) => {
        const timeoutValues = [15000, 20000, 25000];
        const currentTimeout = timeoutValues[Math.min(retryAttempt, timeoutValues.length - 1)];
        const maximumAgeValues = [10000, 30000, 60000];
        const currentMaximumAge = maximumAgeValues[Math.min(retryAttempt, maximumAgeValues.length - 1)];
        const currentHighAccuracy = retryAttempt >= 1;

        requestGeolocation(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (isValidCoordinate(lat, lng)) {
              console.log(`GPS location obtained (attempt ${retryAttempt + 1}):`, lat, lng);
              updateTruckPosition(lat, lng);
              if (!selectedLocation) {
                mapRef.current?.setView([lat, lng], 16);
              }
              startGPSWatch();
            }
          },
          (error) => {
            console.log(`Initial location request failed (attempt ${retryAttempt + 1}):`, error);
            
            if (retryAttempt < 2 && error instanceof GeolocationPositionError && error.code === error.TIMEOUT) {
              console.log(`Location request timed out, retrying in 1 second (attempt ${retryAttempt + 1}/2)...`);
              setTimeout(() => {
                requestInitialLocation(retryAttempt + 1);
              }, 1000);
              return;
            }

            console.warn('Initial GPS fix failed, starting watchPosition anyway...');
            if (error instanceof GeolocationPositionError) {
              console.warn(getGeolocationErrorMessage(error));
            }
            startGPSWatch();
          },
          { 
            enableHighAccuracy: currentHighAccuracy, 
            timeout: currentTimeout,
            maximumAge: currentMaximumAge
          }
        );
      };

      const startGPSWatch = () => {
        if (!isCollectingRef.current) {
          console.log('Not collecting, skipping GPS watch setup');
          return;
        }

        isCollectingRef.current = true;
        
        const watchOptions: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 10000
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!isCollectingRef.current) {
              console.log('Stopped collecting, ignoring GPS update from watchPosition');
              return;
            }
            
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (isValidCoordinate(lat, lng)) {
              updateTruckPosition(lat, lng);
            } else {
              console.warn('Invalid GPS coordinates received:', lat, lng);
            }
          },
          (error) => {
            if (error.code === error.TIMEOUT) {
              console.log('GPS watch timeout (will retry automatically)');
            } else {
              console.error('GPS watch error:', error, getGeolocationErrorMessage(error));
            }
          },
          watchOptions
        );
        
        console.log('GPS watch started with options:', watchOptions);
      };

      requestInitialLocation(0);
      renderRoutePolylines();
    }, 500);
  };

  useEffect(() => {
    if (mapRef.current && enhancedLocations.length > 0) {
      renderRoutePolylines();
    }
  }, [enhancedLocations]);

  const handleStopCollecting = async () => {
    try {
      isCollectingRef.current = false;
      
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      const userId = getCurrentUserId();
      if (userId && truckNo) {
        const currentStatus = await databaseService.getTruckStatus(truckNo);
        const preserveIsFull = currentStatus?.isFull || false;
        
        if (preserveIsFull) {
          await databaseService.updateTruckStatus(
            truckNo, 
            preserveIsFull, 
            userId, 
            false,
            currentStatus?.latitude,
            currentStatus?.longitude
          );
        } else {
          await databaseService.updateTruckStatus(truckNo, false, userId, false, null, null);
          console.log(`Truck ${truckNo} stopped collecting - GPS cleared`);
        }
      }
      
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
    } catch (error) {
      console.error('Error resetting truck status:', error);
    } finally {
      if (onBack) {
        onBack(true);
      }
    }
  };

  const onTruckFullConfirm = async () => {
    try {
      isCollectingRef.current = false;
      
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      const userId = getCurrentUserId();
      if (userId) {
        const currentStatus = await databaseService.getTruckStatus(truckNo);
        await databaseService.updateTruckStatus(
          truckNo, 
          true, 
          userId, 
          false,
          currentStatus?.latitude,
          currentStatus?.longitude
        );
      }
      
      if (truckMarkerRef.current) {
        truckMarkerRef.current.setIcon(createTruckIcon(true, truckNo));
      }
      
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error updating truck status:', error);
      if (truckMarkerRef.current) {
        truckMarkerRef.current.setIcon(createTruckIcon(true, truckNo));
      }
      
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      if (onBack) {
        onBack();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (truckMarkerRef.current) {
        truckMarkerRef.current.remove();
        truckMarkerRef.current = null;
      }
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
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
              onClick={handleStopCollecting}
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

          {enhancedLocations.length > 0 && (
            <div style={{ 
              marginTop: '0.75rem',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              maxHeight: '200px', 
              overflowY: 'auto' 
            }}>
              {enhancedLocations.map((location, index) => {
                const displayText = location.streetId || location.street || location.barangay;
                const fullText = `${displayText}${location.barangay ? ` / ${location.barangay}` : ''}`;
                const isSelected = selectedStreetId === location.scheduleId;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleStreetSelect(location)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 12,
                      border: '2px solid',
                      borderColor: isSelected ? '#22c55e' : '#3b82f6',
                      background: isSelected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(26, 26, 26, 0.95)',
                      color: isSelected ? '#22c55e' : '#3b82f6',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {fullText}
                  </button>
                );
              })}
            </div>
          )}
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
