// src/utils/coordinates.ts
// Utility functions for GPS coordinate validation and manipulation

/**
 * Validates if latitude and longitude are valid GPS coordinates
 * @param lat - Latitude value
 * @param lng - Longitude value
 * @returns true if coordinates are valid, false otherwise
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
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

/**
 * Formats coordinates for display
 * @param lat - Latitude value
 * @param lng - Longitude value
 * @param precision - Number of decimal places (default: 6)
 * @returns Formatted string
 */
export const formatCoordinates = (lat: number, lng: number, precision: number = 6): string => {
  if (!isValidCoordinate(lat, lng)) {
    return 'Invalid coordinates';
  }
  return `Lat: ${lat.toFixed(precision)}, Lng: ${lng.toFixed(precision)}`;
};

/**
 * Calculates distance between two coordinates using Haversine formula
 * @param lat1 - First point latitude
 * @param lng1 - First point longitude
 * @param lat2 - Second point latitude
 * @param lng2 - Second point longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return NaN;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};




