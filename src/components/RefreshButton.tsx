// src/components/RefreshButton.tsx

import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';

interface RefreshButtonProps {
  onRefresh: () => void;
  disabled?: boolean;
  variant?: 'header' | 'fixed'; // 'header' for inline with header, 'fixed' for fixed positioning
}

const RefreshButton: React.FC<RefreshButtonProps> = ({ onRefresh, disabled = false, variant = 'header' }) => {
  if (variant === 'fixed') {
    return (
      <IonButton
        fill="clear"
        onClick={onRefresh}
        disabled={disabled}
        style={{
          position: 'fixed',
          top: '8px',
          right: '8px',
          zIndex: 99999,
          '--color': '#1f2937',
          '--padding-start': '8px',
          '--padding-end': '8px',
          '--background': 'rgba(255, 255, 255, 0.9)',
          '--background-hover': 'rgba(255, 255, 255, 0.95)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        } as React.CSSProperties}
      >
        <IonIcon icon={refreshOutline} slot="icon-only" style={{ fontSize: '24px' }} />
      </IonButton>
    );
  }

  // Header variant - aligns with other header icons
  return (
    <IonButton
      fill="clear"
      onClick={onRefresh}
      disabled={disabled}
      style={{
        '--color': '#1f2937',
        '--padding-start': '8px',
        '--padding-end': '8px',
        minWidth: '48px',
        height: '48px',
      }}
    >
      <IonIcon icon={refreshOutline} slot="icon-only" style={{ fontSize: '24px' }} />
    </IonButton>
  );
};

export default RefreshButton;

