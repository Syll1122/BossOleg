// src/utils/truckAssignment.ts
// Utility to assign truck numbers based on location zones

import { calculateDistance, isValidCoordinate } from './coordinates';

/**
 * Location zones with assigned truck numbers
 * Each zone has a center point and radius, and an assigned truck number
 */
interface LocationZone {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number; // Radius in meters
  truckNo: string;
}

// Define location zones for Quezon City
// You can customize these based on your actual service areas
const LOCATION_ZONES: LocationZone[] = [
  {
    name: 'Holy Spirit Area',
    centerLat: 14.683726,
    centerLng: 121.076224,
    radiusMeters: 2000, // 2km radius
    truckNo: 'BCG 12*5',
  },
  {
    name: 'Fairview Area',
    centerLat: 14.700000,
    centerLng: 121.100000,
    radiusMeters: 2000,
    truckNo: 'BCG 13*6',
  },
  {
    name: 'Novaliches Area',
    centerLat: 14.720000,
    centerLng: 121.050000,
    radiusMeters: 2000,
    truckNo: 'BCG 14*7',
  },
  // Add more zones as needed
];

/**
 * Determine truck number based on current location
 * @param lat - Current latitude
 * @param lng - Current longitude
 * @returns Truck number if location matches a zone, null otherwise
 */
export function getTruckNumberByLocation(lat: number, lng: number): string | null {
  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  // Check each zone to see if location is within radius
  for (const zone of LOCATION_ZONES) {
    const distanceKm = calculateDistance(lat, lng, zone.centerLat, zone.centerLng);
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters <= zone.radiusMeters) {
      console.log(`Location (${lat}, ${lng}) is in zone "${zone.name}" - assigned truck: ${zone.truckNo}`);
      return zone.truckNo;
    }
  }

  console.log(`Location (${lat}, ${lng}) does not match any zone`);
  return null;
}

/**
 * Get all available location zones
 */
export function getLocationZones(): LocationZone[] {
  return LOCATION_ZONES;
}

/**
 * Get zone information for a given location
 */
export function getZoneForLocation(lat: number, lng: number): LocationZone | null {
  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  for (const zone of LOCATION_ZONES) {
    const distanceKm = calculateDistance(lat, lng, zone.centerLat, zone.centerLng);
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters <= zone.radiusMeters) {
      return zone;
    }
  }

  return null;
}

