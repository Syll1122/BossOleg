// src/utils/geolocation.ts
// Utility functions for geolocation

/**
 * Check if the current context allows geolocation
 * Browsers require HTTPS for geolocation (except localhost)
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Check if we're on a secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || 
         window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
}

/**
 * Get a user-friendly error message for geolocation errors
 */
export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  let baseMessage = '';
  let solution = '';

  switch (error.code) {
    case error.PERMISSION_DENIED:
      baseMessage = 'Location permission was denied.';
      solution = 'Please enable location permissions in your browser settings.';
      break;
    case error.POSITION_UNAVAILABLE:
      baseMessage = 'Location information is unavailable.';
      solution = 'Please check your GPS settings and try again.';
      break;
    case error.TIMEOUT:
      baseMessage = 'Location request timed out.';
      solution = 'Please try again or check your internet connection.';
      break;
    default:
      baseMessage = 'An unknown error occurred while getting your location.';
      solution = 'Please try again.';
  }

  // Check if it might be an HTTPS issue
  if (!isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    solution = 'GPS requires HTTPS. Access the app via https:// or use localhost. For network access, use a service like ngrok or set up HTTPS.';
  }

  return `${baseMessage} ${solution}`;
}

/**
 * Request geolocation with better error handling
 */
export function requestGeolocation(
  successCallback: (position: GeolocationPosition) => void,
  errorCallback: (error: GeolocationPositionError | Error) => void,
  options?: PositionOptions
): void {
  if (!isGeolocationAvailable()) {
    errorCallback(new Error('Geolocation is not supported by your browser.'));
    return;
  }

  if (!isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    errorCallback(new Error('GPS requires HTTPS. Please access the app via https:// or use localhost.'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    successCallback,
    (error) => {
      errorCallback(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    }
  );
}

