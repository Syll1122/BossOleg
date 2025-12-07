// src/pages/collector/CollectorRoutePage.tsx

import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonButton, IonAlert, IonButtons, IonIcon, IonSearchbar } from '@ionic/react';
import * as L from 'leaflet';
import MapView from '../../components/MapView';
import { busOutline, searchOutline } from 'ionicons/icons';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';

interface TruckLocation {
  truckId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface ScheduleLocation {
  name: string;
  lat: number;
  lng: number;
}

interface CollectorRoutePageProps {
  onBack?: () => void;
  selectedLocation?: ScheduleLocation;
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

const CollectorRoutePage: React.FC<CollectorRoutePageProps> = ({ onBack, selectedLocation }) => {
  const mapRef = useRef<L.Map | null>(null);
  const truckMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const [truckFullAlert, setTruckFullAlert] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const otherTrucksRef = useRef<Map<string, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  // Load truck number from account
  useEffect(() => {
    const loadTruckNo = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (userId) {
          const account = await databaseService.getAccountById(userId);
          if (account?.truckNo) {
            setTruckNo(account.truckNo);
          }
        }
      } catch (error) {
        console.error('Error loading truck number:', error);
      }
    };
    loadTruckNo();
  }, []);

  // Set truck as collecting when truckNo is loaded and route page is active
  useEffect(() => {
    const setTruckCollecting = async () => {
      if (!truckNo) return; // Wait for truckNo to be loaded
      
      try {
        const userId = getCurrentUserId();
        if (userId) {
          await databaseService.updateTruckStatus(truckNo, false, userId, true);
          console.log(`Truck ${truckNo} set as collecting`);
        }
      } catch (error) {
        console.error('Error setting truck as collecting:', error);
      }
    };
    
    setTruckCollecting();
    
    // Cleanup: Stop collecting when component unmounts or navigates away
    return () => {
      const cleanup = async () => {
        try {
          const userId = getCurrentUserId();
          if (userId && truckNo) {
            await databaseService.updateTruckStatus(truckNo, false, userId, false);
          }
          if (watchIdRef.current !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
        } catch (error) {
          console.error('Error cleaning up truck status:', error);
        }
      };
      cleanup();
    };
  }, [truckNo]); // Run whenever truckNo changes

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
          <strong style="color: #1f2937;">Truck Size:</strong> 
          <span style="color: #1f2937;">Large</span>
        </div>
        ${coordinatesHtml}
      </div>
    `;
    
    return popupContent;
  };

  const stopIcon = L.divIcon({
    html: '🚩',
    className: 'watch-stop-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const searchFlagIcon = L.divIcon({
    html: '📍',
    className: 'watch-stop-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
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

      // Add flag for selected location from schedule if provided
      if (selectedLocation) {
        const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
        const marker = L.marker(selectedPos, { icon: searchFlagIcon }).addTo(mapRef.current!);
        marker.bindPopup(`<div style="text-align: center; font-weight: 600; padding: 0.5rem;">📍 ${selectedLocation.name}</div>`);
        marker.openPopup();
        // Center map on selected location
        mapRef.current.setView(selectedPos, 17);
      }

      // Load and display all other collector trucks on the map
      const loadAllTrucks = async () => {
        try {
          const userId = getCurrentUserId();
          if (!userId) return;

          // Get all collector accounts
          const collectors = await databaseService.getAccountsByRole('collector');
          const currentTruckNo = truckNo;
          
          // Add markers for all other collector trucks (only those with valid accounts and truck numbers)
          for (const collector of collectors) {
            // Only show trucks that have valid accounts with truck numbers
            if (collector.id && collector.truckNo && collector.truckNo.trim() !== '' && collector.truckNo !== currentTruckNo) {
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
              const marker = L.marker([truckLat, truckLng], { icon }).addTo(mapRef.current!);
              
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
              
              // Add close button handler
              marker.on('popupopen', () => {
                const closeBtn = document.getElementById(`truck-close-btn-${collector.truckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    marker.closePopup();
                  };
                }
              });
              
              // Store marker reference
              otherTrucksRef.current.set(collector.truckNo, marker);
            }
          }
        } catch (error) {
          console.error('Error loading other trucks:', error);
        }
      };

      loadAllTrucks();

      // Function to update truck position
      const updateTruckPosition = async (lat: number, lng: number) => {
        if (!mapRef.current) return;
        
        if (!isValidCoordinate(lat, lng)) {
          console.error('Invalid GPS coordinates:', lat, lng);
          return;
        }
        
        const latlng: L.LatLngExpression = [lat, lng];
        const currentTruckNo = truckNo;
        
        // Only create/update marker if truck number is loaded
        if (!currentTruckNo) {
          console.log('Truck number not loaded yet, skipping marker update');
          return;
        }
        
        // Save GPS position to database (for resident map to see)
        try {
          const userId = getCurrentUserId();
          if (userId && currentTruckNo) {
            // Update truck status with GPS coordinates and ensure isCollecting is true
            await databaseService.updateTruckStatus(currentTruckNo, false, userId, true, lat, lng);
          }
        } catch (error) {
          console.error('Error updating truck GPS position in database:', error);
        }
        
        if (truckMarkerRef.current) {
          // Update existing marker position
          truckMarkerRef.current.setLatLng(latlng);
          
          // Update popup with new coordinates
          const popupContent = createTruckInfoPopup(currentTruckNo, lat, lng);
          truckMarkerRef.current.bindPopup(popupContent, {
            className: 'custom-truck-popup',
            closeButton: false,
          });
          
          // Add close button handler
          truckMarkerRef.current.off('popupopen');
          truckMarkerRef.current.on('popupopen', () => {
            const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
            if (closeBtn) {
              closeBtn.onclick = () => {
                truckMarkerRef.current?.closePopup();
              };
            }
          });
        } else {
          // Create new marker if it doesn't exist
          const icon = createTruckIcon(false, currentTruckNo);
          const marker = L.marker(latlng, { icon }).addTo(mapRef.current);
          truckMarkerRef.current = marker;
          
          // Add click popup to truck marker
          const popupContent = createTruckInfoPopup(currentTruckNo, lat, lng);
          marker.bindPopup(popupContent, {
            className: 'custom-truck-popup',
            closeButton: false,
          });
          
          // Add close button handler
          marker.on('popupopen', () => {
            const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
            if (closeBtn) {
              closeBtn.onclick = () => {
                marker.closePopup();
              };
            }
          });
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
              const currentTruckNo = truckNo;
              if (currentTruckNo) {
                const icon = createTruckIcon(false, currentTruckNo);
                const marker = L.marker(donPedro, { icon }).addTo(mapRef.current);
                truckMarkerRef.current = marker;
                const popupContent = createTruckInfoPopup(currentTruckNo);
                marker.bindPopup(popupContent, {
                  className: 'custom-truck-popup',
                  closeButton: false,
                });
                marker.on('popupopen', () => {
                  const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
                  if (closeBtn) {
                    closeBtn.onclick = () => {
                      marker.closePopup();
                    };
                  }
                });
              }
              mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
              return;
            }
            
            const latlng: L.LatLngExpression = [lat, lng];
            
            // Place truck at user's actual location
            updateTruckPosition(lat, lng);
            
            // If no selected location, center on truck. Otherwise, keep selected location centered
            if (!selectedLocation) {
              mapRef.current.setView(latlng, 16);
              // Fit bounds to show both truck location and all stops
              const allPoints = [latlng, ...stops];
              mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [48, 48] });
            } else {
              // Fit bounds to show truck, selected location, and all stops
              const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
              const allPoints = [latlng, selectedPos, ...stops];
              mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [48, 48] });
            }

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
            const currentTruckNo = truckNo;
            if (currentTruckNo) {
              const icon = createTruckIcon(false, currentTruckNo);
              const marker = L.marker(donPedro, { icon }).addTo(mapRef.current);
              truckMarkerRef.current = marker;
              const popupContent = createTruckInfoPopup(currentTruckNo);
              marker.bindPopup(popupContent, {
                className: 'custom-truck-popup',
                closeButton: false,
              });
              marker.on('popupopen', () => {
                const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
                if (closeBtn) {
                  closeBtn.onclick = () => {
                    marker.closePopup();
                  };
                }
              });
            }
            mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        // Fallback if geolocation not available
        if (!mapRef.current) return;
        const currentTruckNo = truckNo;
        mapRef.current.setView(donPedro, 16);
        if (currentTruckNo) {
          const icon = createTruckIcon(false, currentTruckNo);
          const marker = L.marker(donPedro, { icon }).addTo(mapRef.current);
          truckMarkerRef.current = marker;
          const popupContent = createTruckInfoPopup(currentTruckNo);
          marker.bindPopup(popupContent, {
            className: 'custom-truck-popup',
            closeButton: false,
          });
          marker.on('popupopen', () => {
            const closeBtn = document.getElementById(`truck-info-close-btn-${currentTruckNo}`);
            if (closeBtn) {
              closeBtn.onclick = () => {
                marker.closePopup();
              };
            }
          });
        }
        mapRef.current.fitBounds(L.latLngBounds(stops), { padding: [32, 32] });
      }
    }, 300);
  };

  // Stop collecting - return to collector home page and reset truck status
  const onStopCollecting = async () => {
    try {
      // Set truck as not collecting and reset truck status to not full (empty)
      const userId = getCurrentUserId();
      if (userId && truckNo) {
        await databaseService.updateTruckStatus(truckNo, false, userId, false);
      }
      
      // Update marker icon to white if it was red
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
      
      // Stop GPS tracking
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    } catch (error) {
      console.error('Error resetting truck status:', error);
    } finally {
      // Always go back to home page
      if (onBack) {
        onBack();
      }
    }
  };

  const onTruckFullConfirm = async () => {
    try {
      // Update truck status in database
      const userId = getCurrentUserId();
      if (userId) {
        await databaseService.updateTruckStatus(truckNo, true, userId);
      }
      
      // Update marker icon to red
      if (truckMarkerRef.current) {
        const currentTruckNo = truckNo;
        if (currentTruckNo && truckMarkerRef.current) {
          truckMarkerRef.current.setIcon(createTruckIcon(true, currentTruckNo));
        }
      }
      
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error updating truck status:', error);
      // Still proceed with UI update even if DB fails
      if (truckMarkerRef.current) {
        const currentTruckNo = truckNo;
        if (currentTruckNo && truckMarkerRef.current) {
          truckMarkerRef.current.setIcon(createTruckIcon(true, currentTruckNo));
        }
      }
      if (onBack) {
        onBack();
      }
    }
  };

  const onTruckEmpty = async () => {
    try {
      // Update truck status in database
      const userId = getCurrentUserId();
      if (userId) {
        await databaseService.updateTruckStatus(truckNo, false, userId);
      }
      
      // Update marker icon to white
      if (truckMarkerRef.current && truckNo) {
        truckMarkerRef.current.setIcon(createTruckIcon(false, truckNo));
      }
    } catch (error) {
      console.error('Error updating truck status:', error);
      // Still proceed with UI update even if DB fails
      if (truckMarkerRef.current) {
        truckMarkerRef.current.setIcon(whiteTruckIcon);
      }
    }
  };

  // Handle search functionality
  const handleSearch = async () => {
    if (!mapRef.current || !searchQuery.trim()) return;

    try {
      // Try to parse as coordinates first (lat, lng)
      const coordMatch = searchQuery.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isValidCoordinate(lat, lng)) {
          const pos: L.LatLngExpression = [lat, lng];
          if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
          }
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

      // Use Nominatim (OpenStreetMap geocoding) for address search
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
          if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
          }
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

  // Add selected location marker when selectedLocation changes
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;

    const selectedPos: L.LatLngExpression = [selectedLocation.lat, selectedLocation.lng];
    
    // Check if marker already exists (from handleMapReady)
    const existingMarkers = mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const markerPos = layer.getLatLng();
        if (Math.abs(markerPos.lat - selectedLocation.lat) < 0.0001 && 
            Math.abs(markerPos.lng - selectedLocation.lng) < 0.0001) {
          return layer;
        }
      }
      return null;
    });

    // Only add if it doesn't exist
    let markerExists = false;
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const markerPos = layer.getLatLng();
        if (Math.abs(markerPos.lat - selectedLocation.lat) < 0.0001 && 
            Math.abs(markerPos.lng - selectedLocation.lng) < 0.0001) {
          markerExists = true;
        }
      }
    });

    if (!markerExists) {
      const marker = L.marker(selectedPos, { icon: searchFlagIcon }).addTo(mapRef.current);
      marker.bindPopup(`<div style="text-align: center; font-weight: 600; padding: 0.5rem;">📍 ${selectedLocation.name}</div>`);
      marker.openPopup();
      mapRef.current.setView(selectedPos, 17);
    }
  }, [selectedLocation]);

  useEffect(() => {
    // Cleanup marker and stop GPS tracking if the component unmounts
    return () => {
      if (truckMarkerRef.current) {
        truckMarkerRef.current.remove();
        truckMarkerRef.current = null;
      }
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
      // Cleanup other truck markers
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
        {/* Search Bar */}
        {showSearch && (
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '1rem',
              right: '1rem',
              zIndex: 1000,
              backgroundColor: 'white',
              borderRadius: 12,
              padding: '0.5rem',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
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
                '--background': '#16a34a',
                '--color': 'white',
              }}
            >
              <IonIcon icon={searchOutline} slot="start" />
              Search
            </IonButton>
          </div>
        )}

        <div style={{ padding: '0.25rem 1rem 5.5rem' }}>
          <div className="watch-card" style={{ overflow: 'hidden', height: '63vh', borderRadius: 24, position: 'relative' }}>
            <AnyMapView id="collector-map" center={[14.683726, 121.076224]} zoom={16} onMapReady={handleMapReady} />
            
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 1000,
                backgroundColor: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '0.75rem',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IonIcon icon={searchOutline} style={{ fontSize: '1.2rem', color: '#16a34a' }} />
            </button>
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


