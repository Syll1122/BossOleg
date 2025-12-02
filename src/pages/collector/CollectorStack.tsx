// src/pages/collector/CollectorStack.tsx

import React, { useState } from 'react';
import CollectorRoutePage from './CollectorRoutePage';
import CollectorHomePage from './CollectorHomePage';

export const CollectorStack: React.FC = () => {
  const [screen, setScreen] = useState<'home' | 'route'>('home');

  if (screen === 'home') {
    return <CollectorHomePage onStartCollecting={() => setScreen('route')} />;
  }

  return <CollectorRoutePage onBack={() => setScreen('home')} />;
};

export default CollectorStack;
