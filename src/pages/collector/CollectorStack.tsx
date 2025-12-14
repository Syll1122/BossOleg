// src/pages/collector/CollectorStack.tsx

import React, { useState } from 'react';
import CollectorRoutePage from './CollectorRoutePage';
import CollectorHomePage from './CollectorHomePage';

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

export const CollectorStack: React.FC = () => {
  const [screen, setScreen] = useState<'home' | 'route'>('home');
  const [selectedLocation, setSelectedLocation] = useState<ScheduleLocation | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasStoppedCollecting, setHasStoppedCollecting] = useState(false);
  // Store selected day and locations to pass to route page
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayLocations, setDayLocations] = useState<DayLocation[]>([]);

  if (screen === 'home') {
    return (
      <CollectorHomePage
        key={refreshKey}
        hasStoppedCollecting={hasStoppedCollecting}
        onStartCollecting={(location, day, locations) => {
          setSelectedLocation(location);
          setSelectedDay(day || null);
          setDayLocations(locations || []);
          setHasStoppedCollecting(false); // Reset when starting to collect
          setScreen('route');
        }}
        onClearStoppedFlag={() => setHasStoppedCollecting(false)}
        selectedDayFromStack={selectedDay}
        dayLocationsFromStack={dayLocations}
      />
    );
  }

  return (
    <CollectorRoutePage
      onBack={(stoppedCollecting) => {
        setSelectedLocation(undefined);
        // Keep selectedDay and dayLocations when going back so they show on home page
        setHasStoppedCollecting(stoppedCollecting || false);
        setScreen('home');
        // Force refresh of homepage to update truck status (isFull should now be false)
        // Add a small delay to ensure database update is complete
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
        }, 500);
      }}
      selectedLocation={selectedLocation}
      selectedDay={selectedDay}
      dayLocations={dayLocations}
    />
  );
};

export default CollectorStack;
