// src/pages/Home.tsx

import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonButton,
  IonText,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonIcon,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  IonModal,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { menuOutline, calendarOutline, timeOutline, homeOutline, personOutline, logInOutline, logOutOutline, personAddOutline, busOutline, playOutline, alertCircleOutline, documentTextOutline, closeOutline } from 'ionicons/icons';
import { logout, getCurrentUserId } from '../utils/auth';
import useCurrentUser from '../state/useCurrentUser';
import NotificationBell from '../components/NotificationBell';
import { initializeResidentNotifications, checkReportStatusChanges } from '../services/residentNotificationService';
import RefreshButton from '../components/RefreshButton';

interface ScheduleItem {
  day: string;
  time: string;
  street: string;
}

const Home: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [menuEvent, setMenuEvent] = useState<MouseEvent | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // All weekly schedules
  const allSchedules: ScheduleItem[] = [
    { day: 'Monday', time: '7:00 AM', street: 'Military Road' },
    { day: 'Tuesday', time: '7:15 AM', street: 'Quezon Avenue' },
    { day: 'Wednesday', time: '7:30 AM', street: 'Leyte Gulf St.' },
    { day: 'Thursday', time: '7:45 AM', street: 'Rizal Street' },
    { day: 'Friday', time: '8:00 AM', street: 'Commodore Rd.' },
    { day: 'Saturday', time: '8:15 AM', street: 'Manila Bay Drive' },
    { day: 'Sunday', time: '8:30 AM', street: 'Pasig Boulevard' },
  ];

  // Get current day name
  const getCurrentDay = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Get schedules for today
  const getTodaySchedules = (): ScheduleItem[] => {
    const today = getCurrentDay();
    return allSchedules.filter(schedule => schedule.day === today);
  };

  // Get schedules for other days
  const getOtherDaySchedules = (): ScheduleItem[] => {
    const today = getCurrentDay();
    return allSchedules.filter(schedule => schedule.day !== today);
  };

  // Initialize resident notifications on mount (for residents only)
  useEffect(() => {
    const initNotifications = async () => {
      const userId = getCurrentUserId();
      if (userId && user?.role === 'resident') {
        await initializeResidentNotifications(userId);
      }
    };
    initNotifications();
  }, [user]);

  // Monitor report status changes periodically (for residents only)
  useEffect(() => {
    if (user?.role !== 'resident') return;

    const checkReports = async () => {
      const userId = getCurrentUserId();
      if (userId) {
        await checkReportStatusChanges(userId);
      }
    };

    // Check immediately
    checkReports();

    // Then check every 30 seconds
    const reportInterval = setInterval(checkReports, 30000);

    return () => clearInterval(reportInterval);
  }, [user]);

  // Refresh function - reload notifications and report status
  const handleRefresh = async () => {
    const userId = getCurrentUserId();
    if (userId && user?.role === 'resident') {
      await initializeResidentNotifications(userId);
      await checkReportStatusChanges(userId);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar
          style={{
            '--background': '#141414',
            '--color': '#ffffff',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <IonTitle>WATCH</IonTitle>
          <IonButtons slot="end">
            <RefreshButton onRefresh={handleRefresh} variant="header" />
            <NotificationBell />
            <IonButton 
              onClick={(e) => setMenuEvent(e.nativeEvent)}
              style={{
                minWidth: '48px',
                height: '48px',
              }}
            >
              <IonIcon icon={menuOutline} style={{ fontSize: '1.75rem' }} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '1.25rem 1.5rem 2rem',
            background: '#0a0a0a',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated Background Elements */}
          <style>
            {`
              @keyframes float {
                0%, 100% { transform: translateY(0px) translateX(0px); }
                33% { transform: translateY(-20px) translateX(10px); }
                66% { transform: translateY(10px) translateX(-10px); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
              }
              @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}
          </style>
          
          {/* Floating green orbs */}
          <div
            style={{
              position: 'absolute',
              top: '10%',
              left: '5%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
              filter: 'blur(40px)',
              animation: 'float 8s ease-in-out infinite',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '30%',
              right: '8%',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
              filter: 'blur(50px)',
              animation: 'float 10s ease-in-out infinite reverse',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '10%',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
              filter: 'blur(35px)',
              animation: 'float 12s ease-in-out infinite',
              zIndex: 0,
            }}
          />
          
          {/* Subtle grid pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              opacity: 0.4,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          
          {/* Rotating gradient circles */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '-100px',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent, rgba(34, 197, 94, 0.08), transparent, rgba(59, 130, 246, 0.08), transparent)',
              filter: 'blur(60px)',
              animation: 'rotate 20s linear infinite',
              zIndex: 0,
            }}
          />
          <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
            {/* Greeting card */}
            <div
              className="watch-card"
              style={{
                padding: '1.5rem 1.4rem 1.3rem',
                marginTop: '1rem',
                marginBottom: '1rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Green radiance effect */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #22c55e, #4ade80, #22c55e, transparent)',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)',
                  animation: 'glowPulse 3s ease-in-out infinite',
                }}
              />
              <style>
                {`
                  @keyframes glowPulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                  }
                `}
              </style>
              <IonText>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#b0b0b0' }}>Hello,</p>
                <h2 style={{ margin: '0.15rem 0 0.6rem', fontSize: '1.4rem', color: '#ffffff' }}>
                  {user ? user.name : 'WATCH Resident'}
                </h2>
              </IonText>

              <div
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: 18,
                  backgroundColor: '#242424',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <IonIcon icon={calendarOutline} style={{ fontSize: '1rem', color: '#22c55e', filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }} />
                    <span style={{ fontSize: '0.78rem', color: '#b0b0b0' }}>Next collection</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>Click truck icon below to track</div>
                </div>
              </div>
            </div>

            {/* Weekly schedule */}
            <div
              className="watch-card"
              style={{
                padding: '1.3rem 1.4rem 1rem',
                marginBottom: '1rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Green radiance effect */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #22c55e, #4ade80, #22c55e, transparent)',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)',
                  animation: 'glowPulse 3s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <IonText>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Weekly schedule</h3>
                </IonText>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.78rem',
                    color: '#22c55e',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  View all
                </button>
              </div>

              {[
                { day: 'Monday', time: '7:00 AM', street: 'Military Road' },
                { day: 'Wednesday', time: '7:30 AM', street: 'Leyte Gulf St.' },
                { day: 'Friday', time: '8:00 AM', street: 'Commodore Rd.' },
              ].map((item) => (
                <div
                  key={item.day}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.7rem 0',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{item.day}</div>
                    <div style={{ fontSize: '0.78rem', color: '#b0b0b0' }}>{item.street}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#ffffff' }}>
                    <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem', color: '#22c55e', filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' }} />
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Decorative Elements in the Gap */}
            <div
              style={{
                width: '100%',
                marginTop: '2rem',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Stats or Info Cards */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(34, 197, 94, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                  }}
                >
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.25rem' }}>♻️</div>
                  <div style={{ fontSize: '0.75rem', color: '#b0b0b0' }}>Eco-Friendly</div>
                </div>
                
                <div
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.05)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                  }}
                >
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6', marginBottom: '0.25rem' }}>📊</div>
                  <div style={{ fontSize: '0.75rem', color: '#b0b0b0' }}>Track Progress</div>
                </div>
                
                <div
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(34, 197, 94, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                  }}
                >
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.25rem' }}>🌱</div>
                  <div style={{ fontSize: '0.75rem', color: '#b0b0b0' }}>Sustainable</div>
                </div>
              </div>
              
              {/* Quick Action Card */}
              <div
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.15)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(34, 197, 94, 0.05)',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 40px rgba(34, 197, 94, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(34, 197, 94, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.15)';
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#b0b0b0', marginBottom: '0.5rem' }}>
                  Stay connected with your collection schedule
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>💡</span>
                  <span style={{ fontSize: '0.75rem', color: '#ffffff', fontWeight: 500 }}>
                    Real-time tracking • Instant notifications • Easy reporting
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Simple bottom nav look */}
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              marginTop: 'auto',
              paddingTop: '0.75rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '0.5rem 0.75rem 0',
                borderRadius: 999,
                backgroundColor: '#141414',
                border: '1px solid #2a2a2a',
                boxShadow: '0 -6px 18px rgba(0, 0, 0, 0.5)',
              }}
            >
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.1)',
                  minWidth: '60px',
                }}
              >
                <IonIcon icon={homeOutline} style={{ fontSize: '1.3rem', color: '#ffffff', transition: 'all 0.3s ease' }} />
                <span style={{ color: '#ffffff', marginTop: '4px', fontSize: '0.65rem', opacity: 1, transition: 'all 0.3s ease' }}>Home</span>
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.filter = 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                  }
                }}
                onClick={() => history.push('/resident/truck')}
              >
                <IonIcon icon={busOutline} style={{ fontSize: '1.2rem', color: '#ffffff', transition: 'all 0.3s ease' }} />
                <span style={{ color: '#ffffff', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Truck</span>
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.filter = 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                  }
                }}
                onClick={() => history.push('/resident/report')}
              >
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '1.2rem', color: '#ffffff', transition: 'all 0.3s ease' }} />
                <span style={{ color: '#ffffff', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Report</span>
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.filter = 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                  }
                }}
                onClick={() => history.push('/resident/reports')}
              >
                <IonIcon icon={documentTextOutline} style={{ fontSize: '1.2rem', color: '#ffffff', transition: 'all 0.3s ease' }} />
                <span style={{ color: '#ffffff', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>View Reports</span>
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.filter = 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #15803d 50%, #0a0a0a 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                  }
                }}
                onClick={() => history.push('/resident/profile')}
              >
                <IonIcon icon={personOutline} style={{ fontSize: '1.2rem', color: '#ffffff', transition: 'all 0.3s ease' }} />
                <span style={{ color: '#ffffff', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Profile</span>
              </button>
            </div>
          </div>
        </div>
      </IonContent>

      {/* Header menu popover */}
      <IonPopover
        isOpen={!!menuEvent}
        event={menuEvent ?? undefined}
        onDidDismiss={() => setMenuEvent(null)}
      >
        <IonList>
          {user?.role === 'collector' ? (
            <IonItem
              button
              onClick={() => {
                setMenuEvent(null);
                history.push('/collector');
              }}
            >
              <IonIcon slot="start" icon={playOutline} />
              <IonLabel>Start Collecting</IonLabel>
            </IonItem>
          ) : (
            <IonItem button onClick={() => setMenuEvent(null)}>
              <IonIcon slot="start" icon={homeOutline} />
              <IonLabel>Dashboard</IonLabel>
            </IonItem>
          )}
          {user?.role === 'collector' && (
            <IonItem
              button
              onClick={() => {
                setMenuEvent(null);
                history.push('/collector');
              }}
            >
              <IonIcon slot="start" icon={busOutline} />
              <IonLabel>Collector view</IonLabel>
            </IonItem>
          )}
          {user ? (
            <IonItem
              button
              onClick={() => {
                setMenuEvent(null);
                logout();
              }}
            >
              <IonIcon slot="start" icon={logOutOutline} />
              <IonLabel>Log out</IonLabel>
            </IonItem>
          ) : (
            <>
              <IonItem
                button
                onClick={() => {
                  setMenuEvent(null);
                  history.push('/login');
                }}
              >
                <IonIcon slot="start" icon={logInOutline} />
                <IonLabel>Log in</IonLabel>
              </IonItem>
              <IonItem
                button
                onClick={() => {
                  setMenuEvent(null);
                  history.push('/signup');
                }}
              >
                <IonIcon slot="start" icon={personAddOutline} />
                <IonLabel>Sign up</IonLabel>
              </IonItem>
            </>
          )}
        </IonList>
      </IonPopover>

      {/* Weekly Schedule Modal */}
      <IonModal isOpen={showScheduleModal} onDidDismiss={() => setShowScheduleModal(false)}>
        <IonHeader>
          <IonToolbar style={{ '--background': '#141414', '--color': '#ffffff', borderBottom: '1px solid #2a2a2a' }}>
            <IonTitle>Weekly Schedule</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowScheduleModal(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: '#0a0a0a', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              {/* Today's Schedule */}
              {getTodaySchedules().length > 0 && (
                <div className="watch-card" style={{ padding: '1.3rem 1.4rem', marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <IonText>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#22c55e' }}>
                        Today ({getCurrentDay()})
                      </h3>
                    </IonText>
                  </div>
                  {getTodaySchedules().map((item, index) => (
                    <div
                      key={`today-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.7rem 0',
                        borderBottom: index < getTodaySchedules().length - 1 ? '1px solid #2a2a2a' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{item.street}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#22c55e' }}>
                        <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem' }} />
                        <span style={{ fontWeight: 600 }}>{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All Weekly Schedules */}
              <div className="watch-card" style={{ padding: '1.3rem 1.4rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <IonText>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff' }}>Full Weekly Schedule</h3>
                  </IonText>
                </div>
                {allSchedules.map((item, index) => {
                  const isToday = item.day === getCurrentDay();
                  return (
                    <div
                      key={item.day}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.7rem 0',
                        borderBottom: index < allSchedules.length - 1 ? '1px solid #2a2a2a' : 'none',
                        backgroundColor: isToday ? '#242424' : 'transparent',
                        borderRadius: isToday ? '8px' : '0',
                        paddingLeft: isToday ? '0.75rem' : '0',
                        paddingRight: isToday ? '0.75rem' : '0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isToday ? '#22c55e' : '#ffffff' }}>
                          {item.day} {isToday && '(Today)'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#b0b0b0' }}>{item.street}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: isToday ? '#22c55e' : '#ffffff' }}>
                        <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem' }} />
                        <span style={{ fontWeight: isToday ? 600 : 400 }}>{item.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default Home;
