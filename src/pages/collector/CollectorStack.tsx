// src/pages/collector/CollectorStack.tsx

import React, { useState } from 'react';
import CollectorRoutePage from './CollectorRoutePage';
import CollectorHomePage from './CollectorHomePage';

interface ScheduleLocation {
  name: string;
  lat: number;
  lng: number;
}

export const CollectorStack: React.FC = () => {
  const [screen, setScreen] = useState<'home' | 'route'>('home');
  const [selectedLocation, setSelectedLocation] = useState<ScheduleLocation | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  if (screen === 'home') {
    return (
      <CollectorHomePage
        key={refreshKey}
        onStartCollecting={(location) => {
          setSelectedLocation(location);
          setScreen('route');
        }}
      />
    );
  }

  return (
    <CollectorRoutePage
      onBack={() => {
        setSelectedLocation(undefined);
        setScreen('home');
        // Force refresh of homepage to update truck status
        setRefreshKey(prev => prev + 1);
      }}
      selectedLocation={selectedLocation}
    />
  );
};

export default CollectorStack;
