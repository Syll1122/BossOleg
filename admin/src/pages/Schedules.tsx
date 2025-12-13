import { useState, useEffect, useRef } from 'react';
import { Account } from '../types';
import { getAllAccounts } from '../services/api';
import { supabase } from '../lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Schedules.css';

interface Schedule {
  id: string;
  collector_id: string;
  barangay_id: string;
  street_ids?: string[]; // Array of street IDs
  days: string[]; // Array of day abbreviations: ['Mon', 'Tue', 'Wed', etc.]
  created_at: string;
  updated_at: string;
  latitude?: number[]; // Array of latitude coordinates
  longitude?: number[]; // Array of longitude coordinates
  truck_no?: string;
  barangay_name?: string[]; // Array of barangay names
  street_name?: string[]; // Array of street names
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Available marker colors (from leaflet-color-markers)
const MARKER_COLORS = [
  'blue',
  'red',
  'green',
  'orange',
  'yellow',
  'violet',
  'grey',
  'gold',
  'black',
  'pink',
  'cadetblue',
  'darkgreen',
  'darkblue',
  'darkred',
  'darkpurple',
  'lightblue',
  'lightgreen',
  'lightred',
];

// Helper function to create a colored marker icon
const createMarkerIcon = (color: string) => {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

export default function Schedules() {
  const [collectors, setCollectors] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [selectedCollectorForPanel, setSelectedCollectorForPanel] = useState<string | null>(null);
  
  // Form state
  const [selectedCollector, setSelectedCollector] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [filteredBarangays, setFilteredBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedStreets, setSelectedStreets] = useState<string[]>([]);
  const [streetSearch, setStreetSearch] = useState('');
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const [selectedBarangayCoords, setSelectedBarangayCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [flagMarker, setFlagMarker] = useState<L.Marker | null>(null);
  const [mapSelectedLocation, setMapSelectedLocation] = useState<{ lat: number; lng: number; address?: any } | null>(null);
  // Temporary storage for flag drops
  const [temporarySchedules, setTemporarySchedules] = useState<Array<{
    id: string;
    street: string;
    barangay: string;
    barangayId?: string;
    latitude: number;
    longitude: number;
    marker: L.Marker;
  }>>([]);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const flagMarkerRef = useRef<L.Marker | null>(null);
  const mapPickModeRef = useRef(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    place_id: number;
  }>>([]);
  const [showLocationSearchDropdown, setShowLocationSearchDropdown] = useState(false);
  const searchMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadBarangays();
  }, []);

  // Reverse geocoding function using Nominatim (OpenStreetMap)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'WasteCollectionApp/1.0'
          }
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  // Forward geocoding - search for locations by name
  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=ph`,
        {
          headers: {
            'User-Agent': 'WasteCollectionApp/1.0'
          }
        }
      );
      const data = await response.json();
      setLocationSearchResults(data);
      setShowLocationSearchDropdown(data.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
    }
  };

  // Handle location search input change
  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationSearch(value);
    searchLocations(value);
  };

  // Handle selecting a location from search results
  const handleLocationSelect = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    if (!isNaN(lat) && !isNaN(lng) && mapRef.current) {
      // Center map on selected location only (no marker)
      mapRef.current.setView([lat, lng], 15);
      
      // Clear search
      setLocationSearch('');
      setLocationSearchResults([]);
      setShowLocationSearchDropdown(false);
    }
  };

  // Function to remove temporary schedule by ID (for map popup buttons)
  const removeTempScheduleById = useRef<(id: string) => void>();

  // Expose removeTempSchedule function to window for map popup buttons
  useEffect(() => {
    removeTempScheduleById.current = (id: string) => {
      setTemporarySchedules(prev => {
        const toRemove = prev.find(temp => temp.id === id);
        if (toRemove) {
          // Remove marker from map
          if (mapRef.current && mapRef.current.hasLayer(toRemove.marker)) {
            mapRef.current.removeLayer(toRemove.marker);
          }
          // Remove from selected streets if it was in there
          setSelectedStreets(prevStreets => prevStreets.filter(s => s !== toRemove.street));
          
          // If this was the last street for this barangay, clear barangay selection
          const remainingForBarangay = prev.filter(t => t.barangay === toRemove.barangay && t.id !== id);
          if (remainingForBarangay.length === 0) {
            setSelectedBarangay('');
            setBarangaySearch('');
            setSelectedBarangayCoords(null);
            setMapSelectedLocation(null);
          }
        }
        return prev.filter(temp => temp.id !== id);
      });
      
      // Close any open popups
      if (mapRef.current) {
        mapRef.current.closePopup();
      }
    };

    (window as any).removeTempSchedule = (id: string) => {
      removeTempScheduleById.current?.(id);
    };

    return () => {
      delete (window as any).removeTempSchedule;
    };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    // Early return if already initialized
    if (mapRef.current) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 30;
    let timeoutId: NodeJS.Timeout | null = null;
    let rafId: number | null = null;
    let isMounted = true;
    
    // Wait for container to be available and have dimensions
    const initMap = () => {
      if (!isMounted) {
        return;
      }

      if (!mapContainerRef.current) {
        retryCount++;
        if (retryCount < maxRetries) {
          rafId = requestAnimationFrame(() => {
            timeoutId = setTimeout(initMap, 150);
          });
        } else {
          console.error('Failed to initialize map: container not found after max retries');
        }
        return;
      }
      
      // Check if container has dimensions using getBoundingClientRect
      const container = mapContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = rect.width || container.offsetWidth || container.clientWidth;
      const height = rect.height || container.offsetHeight || container.clientHeight;
      
      if (width === 0 || height === 0) {
        retryCount++;
        if (retryCount < maxRetries) {
          rafId = requestAnimationFrame(() => {
            timeoutId = setTimeout(initMap, 150);
          });
        } else {
          console.error(`Failed to initialize map: container has no dimensions after max retries (${width}x${height})`);
        }
        return;
      }

      // Container is ready, initialize map

      try {
        // Initialize map centered on Quezon City
        mapRef.current = L.map(container, {
          center: [14.6760, 121.0437],
          zoom: 12,
          zoomControl: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        // Fix Leaflet default icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        // Invalidate size after a brief delay to ensure proper rendering
        setTimeout(() => {
          if (mapRef.current && isMounted) {
            mapRef.current.invalidateSize();
          }
        }, 100);

        // Map click handler for flag dropping
        mapRef.current.on('click', async (e: L.LeafletMouseEvent) => {
        if (mapPickModeRef.current) {
          const { lat, lng } = e.latlng;
          
          // Don't remove existing markers - allow multiple flags

          // Create flag marker (red marker for selection)
          const flagIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current!);
          flagMarkerRef.current = marker;
          setFlagMarker(marker);

          // Perform reverse geocoding
          const addressData = await reverseGeocode(lat, lng);
          
          if (addressData && addressData.address) {
            const address = addressData.address;
            
            // Extract street name
            const street = address.road || address.pedestrian || '';
            
            // Try to find barangay by matching against database barangays first
            // Check multiple address fields that might contain barangay info
            const possibleBarangayFields = [
              address.suburb,
              address.neighbourhood,
              address.city_district,
              address.quarter,
              address.village,
              address.city,
            ].filter(Boolean); // Remove empty values
            
            let barangay = '';
            let barangayObj = null;
            
            // First, try to find exact match in our barangays database
            for (const field of possibleBarangayFields) {
              if (!field) continue;
              
              // Skip if it contains "district" (not a barangay name)
              if (field.toLowerCase().includes('district')) {
                continue;
              }
              
              // Try exact match (case insensitive)
              const match = barangays.find(b => 
                b.name.toLowerCase() === field.toLowerCase()
              );
              
              if (match) {
                barangay = match.name;
                barangayObj = match;
                break;
              }
              
              // Try partial match (contains)
              const partialMatch = barangays.find(b => 
                field.toLowerCase().includes(b.name.toLowerCase()) ||
                b.name.toLowerCase().includes(field.toLowerCase())
              );
              
              if (partialMatch && !field.toLowerCase().includes('district')) {
                barangay = partialMatch.name;
                barangayObj = partialMatch;
                break;
              }
            }
            
            // If still no match, use the first non-district field as fallback
            if (!barangay) {
              for (const field of possibleBarangayFields) {
                if (field && !field.toLowerCase().includes('district')) {
                  barangay = field;
                  // Try one more time to find in database
                  const match = barangays.find(b => 
                    b.name.toLowerCase().includes(field.toLowerCase()) ||
                    field.toLowerCase().includes(b.name.toLowerCase())
                  );
                  if (match) {
                    barangayObj = match;
                    barangay = match.name;
                  }
                  break;
                }
              }
            }
            
            if (barangay && street) {
              const barangayId = barangayObj?.id || '';
              
              // Create temporary schedule entry
              const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const tempEntry = {
                id: tempId,
                street: street,
                barangay: barangay,
                barangayId: barangayId,
                latitude: lat,
                longitude: lng,
                marker: marker,
              };
              
              // Add to temporary storage
              setTemporarySchedules(prev => [...prev, tempEntry]);
              
              // Don't overwrite selected barangay - let user click street tags to see different barangays
              // Only update coordinates if not already set
              if (!selectedBarangayCoords) {
                setSelectedBarangayCoords({ lat, lng });
              }
              
              if (!selectedStreets.includes(street)) {
                setSelectedStreets(prev => [...prev, street]);
              }
              
              // Update marker popup with remove option
              const popupContent = document.createElement('div');
              popupContent.style.cssText = 'text-align: center; padding: 0.5rem;';
              popupContent.innerHTML = `
                <strong>${street}</strong><br/>
                ${barangay}<br/>
                <button 
                  id="remove-temp-${tempId}"
                  style="
                    margin-top: 0.5rem;
                    padding: 0.25rem 0.5rem;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    font-size: 0.75rem;
                  "
                >
                  Remove
                </button>
              `;
              
              marker.bindPopup(popupContent).openPopup();
              
              // Add click handler to remove button
              setTimeout(() => {
                const removeBtn = document.getElementById(`remove-temp-${tempId}`);
                if (removeBtn) {
                  removeBtn.onclick = () => {
                    removeTempScheduleById.current?.(tempId);
                  };
                }
              }, 100);
              
              // Keep map pick mode enabled so user can drop multiple flags
              // Don't set mapPickMode to false here
            } else if (street) {
              // We have street but no valid barangay - allow user to manually select barangay
              marker.bindPopup('Selected Location - Please select barangay manually').openPopup();
              setMapSelectedLocation({ lat, lng, address: addressData });
              setSelectedBarangayCoords({ lat, lng });
              // Don't set barangay automatically - let user select from dropdown
              // Keep map pick mode enabled for multiple picks
            } else {
              // No street or barangay found
              alert('Could not determine street or barangay from location. Please enter manually.');
              marker.bindPopup('Selected Location - Please enter details manually').openPopup();
              setMapSelectedLocation({ lat, lng, address: addressData });
              setSelectedBarangayCoords({ lat, lng });
              // Keep map pick mode enabled for multiple picks
            }
          } else {
            marker.bindPopup('Selected Location - Please enter details manually').openPopup();
            setMapSelectedLocation({ lat, lng });
            setSelectedBarangayCoords({ lat, lng });
            // Keep map pick mode enabled for multiple picks
            alert('Location selected! Please enter barangay and street manually.');
        }
      }
    });
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    // Start initialization after a small delay to ensure DOM is ready
    rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(initMap, 100);
    });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (mapRef.current) {
        mapRef.current.off('click');
        if (flagMarkerRef.current) {
          mapRef.current.removeLayer(flagMarkerRef.current);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array - setup once

  // F key handler for toggling map pick mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only activate if not typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleMapPickModeRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []); // Empty deps - toggleMapPickMode is stable

  // Update map markers when schedules or selected barangay changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing schedule markers but keep temporary schedule markers (red)
    const temporaryMarkerIds = new Set(temporarySchedules.map(t => t.marker._leaflet_id));
    
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker && !temporaryMarkerIds.has((layer as L.Marker)._leaflet_id)) {
        // Only remove non-temporary markers
        mapRef.current?.removeLayer(layer);
      }
    });

    // Build a map of unique collector IDs to assign unique colors
    const uniqueCollectorIds = new Set<string>();
    schedules.forEach(schedule => {
      if (schedule.collector_id) {
        uniqueCollectorIds.add(schedule.collector_id);
      }
    });
    
    // Assign colors sequentially to collectors for uniqueness
    const collectorColorMap = new Map<string, string>();
    const collectorIdsArray = Array.from(uniqueCollectorIds).sort(); // Sort for consistent ordering
    collectorIdsArray.forEach((collectorId, index) => {
      collectorColorMap.set(collectorId, MARKER_COLORS[index % MARKER_COLORS.length]);
    });

    // Add markers for all schedules with coordinates (colored by collector)
    // Only add if not already in temporary schedules
    schedules.forEach(schedule => {
      // Get collector info and assign color
      const collector = collectors.find(c => c.id === schedule.collector_id);
      const collectorName = collector?.name || 'Unknown';
      const color = collectorColorMap.get(schedule.collector_id) || 'blue';
      const markerIcon = createMarkerIcon(color);
      
      // Handle array format for latitude/longitude
      if (schedule.latitude && schedule.longitude && Array.isArray(schedule.latitude) && Array.isArray(schedule.longitude)) {
        // Process each coordinate pair in the arrays
        schedule.latitude.forEach((lat, index) => {
          const lng = schedule.longitude?.[index];
          if (lng !== undefined) {
            // Check if this location is already marked by a temporary schedule
            const isTempLocation = temporarySchedules.some(
              t => Math.abs(t.latitude - lat) < 0.0001 && 
                   Math.abs(t.longitude - lng) < 0.0001
            );
            
            if (!isTempLocation) {
              const marker = L.marker([lat, lng], { icon: markerIcon })
                .addTo(mapRef.current!);
              
              // Get barangay name for this index if available
              const barangayName = Array.isArray(schedule.barangay_name) 
                ? schedule.barangay_name[index] || schedule.barangay_name[0] 
                : schedule.barangay_name || 'N/A';
              
              // Get street name for this index if available (handle array)
              const streetNameForIndex = Array.isArray(schedule.street_name) 
                ? schedule.street_name[index] || schedule.street_name[0] 
                : schedule.street_name || '';
              
              const streetsInfo = streetNameForIndex 
                ? `<br/>Street: ${streetNameForIndex}` 
                : '';
              
              marker.bindPopup(`
                <strong>${collectorName}</strong><br/>
                Truck: ${schedule.truck_no || 'N/A'}<br/>
                Barangay: ${barangayName}${streetsInfo}<br/>
                Days: ${schedule.days.join(', ')}
              `);
            }
          }
        });
      } else if (schedule.latitude && schedule.longitude && typeof schedule.latitude === 'number') {
        // Fallback for single values (backward compatibility with old data)
        const isTempLocation = temporarySchedules.some(
          t => Math.abs(t.latitude - schedule.latitude as number) < 0.0001 && 
               Math.abs(t.longitude - schedule.longitude as number) < 0.0001
        );
        
        if (!isTempLocation) {
          const marker = L.marker([schedule.latitude as number, schedule.longitude as number], { icon: markerIcon })
            .addTo(mapRef.current!);
          
          const barangayName = Array.isArray(schedule.barangay_name) 
            ? schedule.barangay_name[0] 
            : schedule.barangay_name || 'N/A';
          
          // Handle array format for street_name
          const streetName = Array.isArray(schedule.street_name) 
            ? schedule.street_name.join(', ') 
            : schedule.street_name || '';
          
          const streetsInfo = streetName 
            ? `<br/>Streets: ${streetName}` 
            : '';
          
          marker.bindPopup(`
            <strong>${collectorName}</strong><br/>
            Truck: ${schedule.truck_no || 'N/A'}<br/>
            Barangay: ${barangayName}${streetsInfo}<br/>
            Days: ${schedule.days.join(', ')}
          `);
        }
      }
    });

    // Flag marker is already added in the map click handler, so we don't add it here
    // But we can update the view if coordinates are available and flag marker doesn't exist
    if (selectedBarangayCoords && mapRef.current && !flagMarkerRef.current) {
      mapRef.current.setView([selectedBarangayCoords.lat, selectedBarangayCoords.lng], 15);
    }
  }, [schedules, selectedBarangayCoords, selectedBarangay, collectors, temporarySchedules]);

  useEffect(() => {
    if (barangaySearch) {
      const filtered = barangays.filter(b =>
        b.name.toLowerCase().includes(barangaySearch.toLowerCase())
      );
      setFilteredBarangays(filtered);
      setShowBarangayDropdown(true);
    } else {
      setFilteredBarangays([]);
      setShowBarangayDropdown(false);
    }
  }, [barangaySearch, barangays]);

  const loadData = async () => {
    try {
      const [accountsData, schedulesData] = await Promise.all([
        getAllAccounts(),
        supabase.from('collection_schedules').select('*').order('created_at', { ascending: false })
      ]);

      const collectorAccounts = accountsData.filter(a => a.role === 'collector');
      setCollectors(collectorAccounts);

      if (schedulesData.data) {
        setSchedules(schedulesData.data as Schedule[]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBarangays = async () => {
    try {
      // First try to select with latitude/longitude
      let { data, error } = await supabase
        .from('barangays')
        .select('id, name, latitude, longitude')
        .order('name', { ascending: true });

      // If that fails (400 error), try without latitude/longitude
      if (error) {
        console.log('Latitude/longitude columns not found, loading without them');
        const result = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });
        
        data = result.data;
        error = result.error;
      }

      if (!error && data) {
        setBarangays(data.map(bg => ({
          id: bg.id,
          name: bg.name,
          latitude: (bg as any).latitude || undefined,
          longitude: (bg as any).longitude || undefined,
        })));
      } else if (error) {
        console.error('Error loading barangays:', error);
      }
    } catch (error) {
      console.error('Error loading barangays:', error);
      // Try loading without latitude/longitude as fallback
      try {
        const { data, error: fallbackError } = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });

        if (!fallbackError && data) {
          setBarangays(data.map(bg => ({
            id: bg.id,
            name: bg.name,
          })));
        }
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr);
      }
    }
  };

  // Get days already scheduled for the selected collector (excluding current schedule if editing)
  const getScheduledDaysForCollector = (): string[] => {
    if (!selectedCollector) return [];
    
    const scheduledDays: string[] = [];
    schedules
      .filter(schedule => 
        schedule.collector_id === selectedCollector && 
        schedule.id !== editingScheduleId // Exclude current schedule if editing
      )
      .forEach(schedule => {
        if (schedule.days && Array.isArray(schedule.days)) {
          scheduledDays.push(...schedule.days);
        }
      });
    
    // Return unique days
    return [...new Set(scheduledDays)];
  };

  const handleDayToggle = (day: string) => {
    // Allow unchecking (removing) a day even if it's scheduled elsewhere
    const currentlySelected = selectedDays.includes(day);
    if (currentlySelected) {
      // Allow unchecking
      setSelectedDays(prev => prev.filter(d => d !== day));
      return;
    }
    
    // When checking (adding), prevent if day is already scheduled for this collector in another schedule
    const scheduledDays = getScheduledDaysForCollector();
    if (scheduledDays.includes(day)) {
      return; // Don't allow selecting a day that's already scheduled
    }
    
    // Allow checking
    setSelectedDays(prev => [...prev, day]);
  };

  const handleBarangaySelect = (barangay: { id: string; name: string; latitude?: number; longitude?: number }) => {
    if (!mapSelectedLocation) { // Only allow manual selection if not map-picked
      setSelectedBarangay(barangay.name);
      setBarangaySearch(barangay.name);
      setShowBarangayDropdown(false);
      
      if (barangay.latitude && barangay.longitude) {
        setSelectedBarangayCoords({ lat: barangay.latitude, lng: barangay.longitude });
      }
    }
  };

  const handleStreetAdd = (street: string) => {
    if (street && !selectedStreets.includes(street)) {
      setSelectedStreets(prev => [...prev, street]);
      setStreetSearch('');
      setShowStreetDropdown(false);
      
      // If we have barangay and coordinates, create a flag for this street
      if (selectedBarangay && selectedBarangayCoords && mapRef.current) {
        // Check if this street already has a flag
        const existingTemp = temporarySchedules.find(t => t.street === street && t.barangay === selectedBarangay);
        if (!existingTemp) {
          const barangayObj = barangays.find(b => b.name === selectedBarangay);
          const barangayId = barangayObj?.id || '';
          
          const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const flagIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          
          const marker = L.marker([selectedBarangayCoords.lat, selectedBarangayCoords.lng], { icon: flagIcon })
            .addTo(mapRef.current);
          
          // Create popup with remove button
          const popupContent = document.createElement('div');
          popupContent.style.cssText = 'text-align: center; padding: 0.5rem;';
          popupContent.innerHTML = `
            <strong>${street}</strong><br/>
            ${selectedBarangay}<br/>
            <button 
              id="remove-temp-${tempId}"
              style="
                margin-top: 0.5rem;
                padding: 0.25rem 0.5rem;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                font-size: 0.75rem;
              "
            >
              Remove
            </button>
          `;
          
          marker.bindPopup(popupContent);
          
          // Add click handler
          setTimeout(() => {
            const removeBtn = document.getElementById(`remove-temp-${tempId}`);
            if (removeBtn) {
              removeBtn.onclick = () => {
                removeTempScheduleById.current?.(tempId);
              };
            }
          }, 100);
          
          // Add to temporary storage
          const tempEntry = {
            id: tempId,
            street: street,
            barangay: selectedBarangay,
            barangayId: barangayId,
            latitude: selectedBarangayCoords.lat,
            longitude: selectedBarangayCoords.lng,
            marker: marker,
          };
          
          setTemporarySchedules(prev => [...prev, tempEntry]);
        }
      }
    }
  };

  const handleStreetRemove = (street: string) => {
    // Remove from selected streets
    setSelectedStreets(prev => prev.filter(s => s !== street));
    
    // Remove from temporary schedules and remove marker from map
    setTemporarySchedules(prev => {
      const toRemove = prev.filter(temp => temp.street === street);
      toRemove.forEach(temp => {
        // Remove marker from map
        if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
          mapRef.current.removeLayer(temp.marker);
        }
      });
      
      // Check if we need to clear barangay selection
      const remaining = prev.filter(temp => temp.street !== street);
      if (remaining.length === 0) {
        setSelectedBarangay('');
        setBarangaySearch('');
        setSelectedBarangayCoords(null);
        setMapSelectedLocation(null);
      }
      
      return remaining;
    });
  };

  const toggleMapPickModeRef = useRef<() => void>(() => {});
  
  const toggleMapPickMode = () => {
    setMapPickMode(prev => {
      const newMode = !prev;
      mapPickModeRef.current = newMode;
      if (mapRef.current) {
        mapRef.current.getContainer().style.cursor = newMode ? 'crosshair' : '';
        if (!newMode && mapRef.current.getContainer()) {
          // When disabling pick mode, don't remove markers - just change cursor
          // Flags should remain on the map
        }
      }
      return newMode;
    });
  };

  // Update the ref when the function changes
  useEffect(() => {
    toggleMapPickModeRef.current = toggleMapPickMode;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCollector || selectedDays.length === 0) {
      alert('Please select a collector and at least one day');
      return;
    }

    const collector = collectors.find(c => c.id === selectedCollector);
    if (!collector) {
      alert('Collector not found');
      return;
    }

    // Check if we have temporary schedules or manual entry
    const hasTemporarySchedules = temporarySchedules.length > 0;
    const hasManualEntry = selectedBarangay && (selectedStreets.length > 0 || selectedBarangayCoords);

    if (!hasTemporarySchedules && !hasManualEntry) {
      alert('Please drop a flag on the map or enter location details manually');
      return;
    }

    try {
      const schedulesToCreate = [];

      // Collect all data from temporary storage (flag drops)
      if (hasTemporarySchedules) {
        // Extract arrays from all temporary schedules
        const latitudes = temporarySchedules.map(temp => temp.latitude);
        const longitudes = temporarySchedules.map(temp => temp.longitude);
        const barangayNames = temporarySchedules.map(temp => temp.barangay);
        const streetNames = temporarySchedules.map(temp => temp.street);
        
        // Find barangay ID - try to find in barangays list first
        let barangayId = '';
        const firstTemp = temporarySchedules[0];
        if (firstTemp.barangay) {
          // Try to find exact match in barangays list
          const barangayObj = barangays.find(b => 
            b.name.toLowerCase() === firstTemp.barangay.toLowerCase()
          );
          
          if (barangayObj) {
            barangayId = barangayObj.id;
          } else if (firstTemp.barangayId) {
            // Use the barangayId from temporary storage if available
            barangayId = firstTemp.barangayId;
          } else {
            // If no match found, we need to skip or use a default
            // For now, we'll try to find any matching barangay by partial match
            const partialMatch = barangays.find(b => 
              firstTemp.barangay.toLowerCase().includes(b.name.toLowerCase()) ||
              b.name.toLowerCase().includes(firstTemp.barangay.toLowerCase())
            );
            if (partialMatch) {
              barangayId = partialMatch.id;
            }
          }
        }
        
        // If still no valid barangay_id, we can't create the schedule
        if (!barangayId || barangayId.trim() === '') {
          const barangayList = barangays.map(b => b.name).join(', ');
          alert(`Cannot create schedule: Barangay "${firstTemp.barangay || 'Unknown'}" not found in database.\n\nPlease select a valid barangay from the dropdown or ensure the barangay exists in your database.\n\nAvailable barangays: ${barangayList.length > 100 ? barangayList.substring(0, 100) + '...' : barangayList}`);
          return;
        }

        const scheduleData = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          collector_id: collector.id,
          barangay_id: barangayId,
          street_ids: streetNames.length > 0 ? streetNames : null,
          days: selectedDays,
          latitude: latitudes.length > 0 ? latitudes : null,
          longitude: longitudes.length > 0 ? longitudes : null,
          truck_no: collector.truckNo || null,
          barangay_name: barangayNames.length > 0 ? barangayNames : null,
          street_name: streetNames.length > 0 ? streetNames : null, // Array of street names
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // Debug: Log to verify it's an array
        console.log('Schedule data being saved:', {
          ...scheduleData,
          street_name_type: Array.isArray(scheduleData.street_name) ? 'array' : typeof scheduleData.street_name,
          street_name_value: scheduleData.street_name
        });
        
        schedulesToCreate.push(scheduleData);
      }

      // Create schedule from manual entry (if exists and not already in temp storage)
      if (hasManualEntry && !hasTemporarySchedules) {
        const selectedBarangayObj = barangays.find(b => b.name === selectedBarangay);
        
        if (!selectedBarangayObj || !selectedBarangayObj.id || selectedBarangayObj.id.trim() === '') {
          alert(`Cannot create schedule: Barangay "${selectedBarangay}" not found or invalid. Please select a valid barangay from the dropdown.`);
          return;
        }
        
        const barangayId = selectedBarangayObj.id;

        const scheduleData = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          collector_id: collector.id,
          barangay_id: barangayId,
          street_ids: selectedStreets.length > 0 ? selectedStreets : null,
          days: selectedDays,
          latitude: selectedBarangayCoords?.lat ? [selectedBarangayCoords.lat] : null,
          longitude: selectedBarangayCoords?.lng ? [selectedBarangayCoords.lng] : null,
          truck_no: collector.truckNo || null,
          barangay_name: selectedBarangay ? [selectedBarangay] : null,
          street_name: selectedStreets.length > 0 ? selectedStreets : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        schedulesToCreate.push(scheduleData);
      }

      // Update or insert schedules
      if (schedulesToCreate.length > 0) {
        if (editingScheduleId) {
          // Update existing schedule
          const scheduleData = schedulesToCreate[0];
          const { error } = await supabase
            .from('collection_schedules')
            .update({
              collector_id: scheduleData.collector_id,
              barangay_id: scheduleData.barangay_id,
              street_ids: scheduleData.street_ids,
              days: scheduleData.days,
              latitude: scheduleData.latitude,
              longitude: scheduleData.longitude,
              truck_no: scheduleData.truck_no,
              barangay_name: scheduleData.barangay_name,
              street_name: scheduleData.street_name,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingScheduleId);

          if (error) throw error;

          alert('Schedule updated successfully!');
          setEditingScheduleId(null);
        } else {
          // Insert new schedules
          const { error } = await supabase
            .from('collection_schedules')
            .insert(schedulesToCreate);

          if (error) throw error;

          alert(`Successfully created ${schedulesToCreate.length} schedule(s)!`);
        }
        
        // Reset form
        setSelectedCollector('');
        setSelectedDays([]);
        setSelectedBarangay('');
        setBarangaySearch('');
        setSelectedStreets([]);
        setStreetSearch('');
        setSelectedBarangayCoords(null);
        setMapSelectedLocation(null);
        setMapPickMode(false);
        mapPickModeRef.current = false;
        
        // Clear temporary schedules and remove markers
        temporarySchedules.forEach(temp => {
          if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
            mapRef.current.removeLayer(temp.marker);
          }
        });
        setTemporarySchedules([]);
        
        // Remove flag marker
        if (flagMarkerRef.current && mapRef.current) {
          mapRef.current.removeLayer(flagMarkerRef.current);
          flagMarkerRef.current = null;
          setFlagMarker(null);
        }
        
        // Reset cursor
        if (mapRef.current) {
          mapRef.current.getContainer().style.cursor = '';
        }
        
        // Reload schedules
        await loadData();
      }
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      alert(error.message || 'Failed to create schedule(s). Please try again.');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    // Populate form with schedule data
    setEditingScheduleId(schedule.id);
    setSelectedCollector(schedule.collector_id);
    setSelectedDays(schedule.days || []);
    
    // Clear existing temporary schedules and markers
    temporarySchedules.forEach(temp => {
      if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
        mapRef.current.removeLayer(temp.marker);
      }
    });
    setTemporarySchedules([]);
    
    // Populate temporary schedules from schedule data
    if (schedule.street_name && schedule.barangay_name && schedule.latitude && schedule.longitude) {
      const streetNames = Array.isArray(schedule.street_name) ? schedule.street_name : [schedule.street_name];
      const barangayNames = Array.isArray(schedule.barangay_name) ? schedule.barangay_name : [schedule.barangay_name];
      const latitudes = Array.isArray(schedule.latitude) ? schedule.latitude : [schedule.latitude];
      const longitudes = Array.isArray(schedule.longitude) ? schedule.longitude : [schedule.longitude];
      
      const tempSchedules: typeof temporarySchedules = [];
      
      streetNames.forEach((street, index) => {
        const barangay = barangayNames[index] || barangayNames[0] || '';
        const lat = latitudes[index] !== null && latitudes[index] !== undefined ? Number(latitudes[index]) : (latitudes[0] ? Number(latitudes[0]) : 0);
        const lng = longitudes[index] !== null && longitudes[index] !== undefined ? Number(longitudes[index]) : (longitudes[0] ? Number(longitudes[0]) : 0);
        
        if (lat && lng && street && barangay && mapRef.current) {
          const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
          const flagIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          
          const marker = L.marker([lat, lng], { icon: flagIcon }).addTo(mapRef.current);
          
          const popupContent = document.createElement('div');
          popupContent.style.cssText = 'text-align: center; padding: 0.5rem;';
          popupContent.innerHTML = `
            <strong>${street}</strong><br/>
            ${barangay}<br/>
            <button 
              id="remove-temp-${tempId}"
              style="
                margin-top: 0.5rem;
                padding: 0.25rem 0.5rem;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                font-size: 0.75rem;
              "
            >
              Remove
            </button>
          `;
          
          marker.bindPopup(popupContent);
          
          setTimeout(() => {
            const removeBtn = document.getElementById(`remove-temp-${tempId}`);
            if (removeBtn) {
              removeBtn.onclick = () => {
                removeTempScheduleById.current?.(tempId);
              };
            }
          }, 100);
          
          const barangayObj = barangays.find(b => b.name === barangay);
          
          tempSchedules.push({
            id: tempId,
            street: street,
            barangay: barangay,
            barangayId: schedule.barangay_id,
            latitude: lat,
            longitude: lng,
            marker: marker,
          });
        }
      });
      
      setTemporarySchedules(tempSchedules);
      
      // Set first barangay
      if (barangayNames.length > 0) {
        setSelectedBarangay(barangayNames[0]);
        setBarangaySearch(barangayNames[0]);
      }
    }
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingScheduleId(null);
    // Reset form
    setSelectedCollector('');
    setSelectedDays([]);
    setSelectedBarangay('');
    setBarangaySearch('');
    setSelectedStreets([]);
    setStreetSearch('');
    setSelectedBarangayCoords(null);
    setMapSelectedLocation(null);
    setMapPickMode(false);
    mapPickModeRef.current = false;
    
    // Clear temporary schedules and remove markers
    temporarySchedules.forEach(temp => {
      if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
        mapRef.current.removeLayer(temp.marker);
      }
    });
    setTemporarySchedules([]);
    
    // Remove flag marker
    if (flagMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(flagMarkerRef.current);
      flagMarkerRef.current = null;
      setFlagMarker(null);
    }
    
    // Reset cursor
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const { error } = await supabase
        .from('collection_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Schedule deleted successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  if (loading) {
    return <div className="loading">Loading schedules...</div>;
  }

  return (
    <div className="schedules-page">
      <div className="page-header">
        <h1>Collection Schedules</h1>
      </div>

      <div className="schedules-content">
        {/* Form Section */}
        <div className="form-section">
          <h2>Create New Schedule</h2>
          <form onSubmit={handleSubmit} className="schedule-form">
            {/* Collector/Truck Selection */}
            <div className="form-group">
              <label>Assign To *</label>
              <select
                value={selectedCollector}
                onChange={(e) => {
                  const newCollectorId = e.target.value;
                  // Full reset when collector changes
                  if (selectedCollector && selectedCollector !== newCollectorId) {
                    // Clear all temporary schedules and remove all markers
                    temporarySchedules.forEach(temp => {
                      if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
                        mapRef.current.removeLayer(temp.marker);
                      }
                    });
                    setTemporarySchedules([]);
                    
                    // Clear form fields
                    setSelectedBarangay('');
                    setBarangaySearch('');
                    setSelectedStreets([]);
                    setStreetSearch('');
                    setSelectedBarangayCoords(null);
                    setMapSelectedLocation(null);
                    
                    // Remove flag marker
                    if (flagMarkerRef.current && mapRef.current) {
                      mapRef.current.removeLayer(flagMarkerRef.current);
                      flagMarkerRef.current = null;
                      setFlagMarker(null);
                    }
                  }
                  setSelectedCollector(newCollectorId);
                }}
                required
                className="form-select"
              >
                <option value="">Select Collector/Truck</option>
                {collectors.map(collector => (
                  <option key={collector.id} value={collector.id}>
                    {collector.name} ({collector.truckNo || 'No Truck'})
                  </option>
                ))}
              </select>
            </div>

            {/* Day Selection */}
            <div className="form-group">
              <label>Collection Days *</label>
              <div className="days-grid">
                {DAYS_OF_WEEK.map(day => {
                  const scheduledDays = getScheduledDaysForCollector();
                  const isScheduled = scheduledDays.includes(day);
                  const isChecked = selectedDays.includes(day);
                  // Disable only if the day is scheduled elsewhere AND not currently checked
                  // This allows unchecking days that are part of the current schedule being edited
                  const isDisabled = selectedCollector && isScheduled && !isChecked;
                  
                  return (
                    <label 
                      key={day} 
                      className={`day-checkbox ${isDisabled ? 'day-checkbox-disabled' : ''}`}
                      style={isDisabled ? {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                        backgroundColor: '#f3f4f6',
                        borderColor: '#d1d5db'
                      } : {}}
                      title={isDisabled ? `This day is already scheduled for ${selectedCollector ? collectors.find(c => c.id === selectedCollector)?.name : 'this collector'}` : ''}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => handleDayToggle(day)}
                      />
                      <span style={isDisabled ? { color: '#9ca3af' } : {}}>{day}</span>
                      {isDisabled && (
                        <span style={{
                          fontSize: '0.625rem',
                          color: '#ef4444',
                          marginLeft: '0.25rem',
                          fontWeight: 600
                        }} title="Already scheduled for this collector">
                          *
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedCollector && getScheduledDaysForCollector().length > 0 && (
                <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Days marked with * are already scheduled for this collector
                </small>
              )}
            </div>

            {/* Map Pick Button */}
            <div className="form-group">
              <label>Location Selection</label>
              <button
                type="button"
                onClick={toggleMapPickMode}
                className={`btn ${mapPickMode ? 'btn-warning' : 'btn-secondary'}`}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {mapPickMode ? '📍 Click on map to drop flag (Press F to toggle)' : '🗺️ Pick Location on Map (Press F)'}
              </button>
              {mapPickMode && (
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#fef3c7', 
                  border: '1px solid #fbbf24',
                  borderRadius: '0.375rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  color: '#92400e'
                }}>
                  Click on the map to drop a flag at the collection location. Press F again to cancel.
                </div>
              )}
              {(mapSelectedLocation || temporarySchedules.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setMapSelectedLocation(null);
                    setSelectedBarangay('');
                    setBarangaySearch('');
                    setSelectedStreets([]);
                    setSelectedBarangayCoords(null);
                    
                    // Remove all temporary schedule markers
                    temporarySchedules.forEach(temp => {
                      if (mapRef.current && mapRef.current.hasLayer(temp.marker)) {
                        mapRef.current.removeLayer(temp.marker);
                      }
                    });
                    setTemporarySchedules([]);
                    
                    // Remove flag marker
                    if (flagMarkerRef.current && mapRef.current) {
                      mapRef.current.removeLayer(flagMarkerRef.current);
                      flagMarkerRef.current = null;
                      setFlagMarker(null);
                    }
                  }}
                  className="btn btn-secondary btn-small"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Clear All Flags ({temporarySchedules.length})
                </button>
              )}
            </div>

            {/* Combined Barangay and Street Tags Display */}
            <div className="form-group">
              <label>Location (Barangay / Street) *</label>
              {(() => {
                // Get all temporary schedules (each has both barangay and street - they stay separate in storage)
                const allLocations = temporarySchedules.map(temp => ({
                  id: temp.id,
                  barangay: temp.barangay,
                  street: temp.street,
                  barangayId: temp.barangayId,
                  coordinates: { lat: temp.latitude, lng: temp.longitude },
                  marker: temp.marker
                }));
                
                // Add manual entries if they exist (without temporary schedules)
                if (selectedBarangay && temporarySchedules.length === 0 && selectedStreets.length > 0) {
                  selectedStreets.forEach(street => {
                    allLocations.push({
                      id: `manual-${street}-${Date.now()}`,
                      barangay: selectedBarangay,
                      street: street,
                      barangayId: undefined,
                      coordinates: selectedBarangayCoords || null,
                      marker: null
                    });
                  });
                }
                
                if (allLocations.length === 0) {
                  return (
                    <div style={{ 
                      color: '#9ca3af',
                      fontSize: '0.875rem'
                    }}>
                      Drop flags on the map to add locations
                    </div>
                  );
                }
                
                return (
                  <div className="location-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {allLocations.map((location, index) => {
                      return (
                        <span 
                          key={location.id || index} 
                          className="location-tag"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.375rem 0.5rem 0.375rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            color: '#6366f1',
                            cursor: location.coordinates ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => {
                            if (location.coordinates) {
                              setSelectedBarangayCoords(location.coordinates);
                              setSelectedBarangay(location.barangay);
                              // Center map on this location's coordinates
                              if (mapRef.current && location.coordinates) {
                                mapRef.current.setView([location.coordinates.lat, location.coordinates.lng], 15);
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (location.coordinates) {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title={location.coordinates ? `Click to view: ${location.barangay} - ${location.street} (${location.coordinates.lat}, ${location.coordinates.lng})` : `${location.barangay} - ${location.street}`}
                        >
                          <span style={{ fontWeight: 500 }}>{location.barangay}</span>
                          <span style={{ color: '#9ca3af' }}>/</span>
                          <span>{location.street}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Remove from temporary schedules if it exists there (separate storage)
                              if (temporarySchedules.some(t => t.id === location.id)) {
                                setTemporarySchedules(prev => {
                                  const remaining = prev.filter(t => t.id !== location.id);
                                  // Remove marker from map
                                  if (location.marker && mapRef.current && mapRef.current.hasLayer(location.marker)) {
                                    mapRef.current.removeLayer(location.marker);
                                  }
                                  return remaining;
                                });
                                // Also remove from selectedStreets if it exists
                                setSelectedStreets(prev => prev.filter(s => s !== location.street));
                              } else {
                                // Manual entry - just remove from selectedStreets
                                setSelectedStreets(prev => prev.filter(s => s !== location.street));
                                // If this was the last street, clear barangay too
                                const remainingStreets = selectedStreets.filter(s => s !== location.street);
                                if (remainingStreets.length === 0) {
                                  setSelectedBarangay('');
                                  setBarangaySearch('');
                                  setSelectedBarangayCoords(null);
                                }
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#6366f1',
                              cursor: 'pointer',
                              fontSize: '1.25rem',
                              padding: '0',
                              lineHeight: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              transition: 'all 0.2s',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#4f46e5';
                              e.currentTarget.style.backgroundColor = '#e0e7ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#6366f1';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingScheduleId ? 'Update Schedule' : 'Create Schedule'}
              </button>
              {editingScheduleId && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  style={{ backgroundColor: '#6b7280', borderColor: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Map Section */}
        <div className="map-section">
          <h2>Schedule Map View</h2>
          
          {/* Location Search */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Search Location</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                className="form-input"
                placeholder="Search for a location (e.g., Quezon City, Manila, Street Name)"
                value={locationSearch}
                onChange={handleLocationSearchChange}
                onFocus={() => {
                  if (locationSearchResults.length > 0) {
                    setShowLocationSearchDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Delay closing dropdown to allow clicks
                  setTimeout(() => {
                    setShowLocationSearchDropdown(false);
                  }, 200);
                }}
              />
              {showLocationSearchDropdown && locationSearchResults.length > 0 && (
                <div className="autocomplete-dropdown">
                  {locationSearchResults.map((result) => (
                    <div
                      key={result.place_id}
                      className="autocomplete-item"
                      onClick={() => handleLocationSelect(result)}
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                    >
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                        {result.display_name.split(',')[0]}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {result.display_name.split(',').slice(1).join(',').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div ref={mapContainerRef} className="schedule-map"></div>
        </div>
      </div>

      {/* Existing Schedules - Collector Buttons */}
      <div className="schedules-list">
        <h2>Existing Schedules</h2>
        {schedules.length === 0 ? (
          <div className="empty-state">No schedules created yet</div>
        ) : (
          <>
            {/* Collector/Truck Buttons */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.75rem', 
              marginBottom: '1.5rem' 
            }}>
              {(() => {
                // Group schedules by collector_id
                const collectorMap = new Map<string, Schedule[]>();
                schedules.forEach(schedule => {
                  const collectorId = schedule.collector_id;
                  if (!collectorMap.has(collectorId)) {
                    collectorMap.set(collectorId, []);
                  }
                  collectorMap.get(collectorId)!.push(schedule);
                });

                return Array.from(collectorMap.entries()).map(([collectorId, collectorSchedules]) => {
                  const collector = collectors.find(c => c.id === collectorId);
                  const collectorName = collector?.name || 'Unknown';
                  const truckNo = collectorSchedules[0]?.truck_no || collector?.truckNo || '-';
                  const isSelected = selectedCollectorForPanel === collectorId;

                  return (
                    <button
                      key={collectorId}
                      type="button"
                      onClick={() => setSelectedCollectorForPanel(isSelected ? null : collectorId)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                        backgroundColor: isSelected ? '#eff6ff' : 'white',
                        color: isSelected ? '#1e40af' : '#374151',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.875rem',
                        boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {collectorName} ({truckNo})
                    </button>
                  );
                });
              })()}
            </div>

            {/* Schedule Details Panel */}
            {selectedCollectorForPanel && (() => {
              const collectorSchedules = schedules.filter(s => s.collector_id === selectedCollectorForPanel);
              const collector = collectors.find(c => c.id === selectedCollectorForPanel);
              const collectorName = collector?.name || 'Unknown';

              return (
                <div style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                      Schedules for {collectorName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedCollectorForPanel(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        lineHeight: 1,
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Collector</th>
                          <th>Truck No</th>
                          <th>Location</th>
                          <th>Days</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectorSchedules.map(schedule => (
                          <tr key={schedule.id}>
                            <td>{collectorName}</td>
                            <td>{schedule.truck_no || '-'}</td>
                            <td>
                              {Array.isArray(schedule.barangay_name) 
                                ? schedule.barangay_name.join(', ') 
                                : schedule.barangay_name || '-'}
                              {schedule.street_name && (
                                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                  {Array.isArray(schedule.street_name) 
                                    ? schedule.street_name.join(', ') 
                                    : schedule.street_name}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="days-tags">
                                {schedule.days.map(day => (
                                  <span key={day} className="day-tag">{day}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-primary btn-small"
                                  onClick={() => handleEdit(schedule)}
                                  style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-small"
                                  onClick={() => handleDelete(schedule.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

