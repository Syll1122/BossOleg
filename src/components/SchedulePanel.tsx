// src/components/SchedulePanel.tsx
// Panel component to display today's collection schedule

import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { closeOutline, locationOutline } from 'ionicons/icons';

// Schedule locations (matching collector schedule)
const SCHEDULE_LOCATIONS = [
  { name: 'Don Pedro, HOLY SPIRIT', lat: 14.682042, lng: 121.076975 },
  { name: 'Don Primitivo, HOLY SPIRIT', lat: 14.680823, lng: 121.076206 },
  { name: 'Don Elpidio, HOLY SPIRIT', lat: 14.679855, lng: 121.077793 },
];

interface SchedulePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SchedulePanel: React.FC<SchedulePanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '2px solid #e5e7eb',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📅</span>
            Today's Collection Schedule
          </h2>
          <IonButton
            fill="clear"
            onClick={onClose}
            style={{ '--padding-start': '8px', '--padding-end': '8px' }}
          >
            <IonIcon icon={closeOutline} slot="icon-only" />
          </IonButton>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {SCHEDULE_LOCATIONS.map((location, index) => (
            <div
              key={location.name}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              {/* Number Badge */}
              <div
                style={{
                  minWidth: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>

              {/* Location Info */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <IonIcon
                    icon={locationOutline}
                    style={{ fontSize: '1.2rem', color: '#16a34a' }}
                  />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#1f2937',
                    }}
                  >
                    {location.name}
                  </h3>
                </div>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.85rem',
                    color: '#6b7280',
                  }}
                >
                  Collection will be in this area today
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: '#1e40af',
              lineHeight: '1.5',
            }}
          >
            💡 <strong>Tip:</strong> Track trucks in real-time on the map. You'll receive a notification when a truck is within 400m of your location.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulePanel;

