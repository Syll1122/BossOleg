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

  if (screen === 'home') {
    return (
      <CollectorHomePage
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
      }}
      selectedLocation={selectedLocation}
    />
  );
};

export default CollectorStack;
