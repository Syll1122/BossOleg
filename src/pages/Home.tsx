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

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar
          style={{
            '--background': '#16a34a',
            '--color': '#ecfdf3',
          }}
        >
          <IonTitle>WATCH</IonTitle>
          <IonButtons slot="end">
            <NotificationBell />
            <IonButton onClick={(e) => setMenuEvent(e.nativeEvent)}>
              <IonIcon icon={menuOutline} />
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
            background: '#ecfdf3',
          }}
        >
          <div style={{ width: '100%', maxWidth: 480 }}>
            {/* Greeting card */}
            <div
              className="watch-card"
              style={{
                padding: '1.5rem 1.4rem 1.3rem',
                marginTop: '1rem',
                marginBottom: '1rem',
              }}
            >
              <IonText>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Hello,</p>
                <h2 style={{ margin: '0.15rem 0 0.6rem', fontSize: '1.4rem' }}>
                  {user ? user.name : 'WATCH Resident'}
                </h2>
              </IonText>

              <div
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: 18,
                  backgroundColor: '#ecfdf3',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <IonIcon icon={calendarOutline} style={{ fontSize: '1rem', color: '#16a34a' }} />
                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Next collection</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Click truck icon below to track</div>
                </div>
              </div>
            </div>

            {/* Weekly schedule */}
            <div
              className="watch-card"
              style={{
                padding: '1.3rem 1.4rem 1rem',
                marginBottom: '1rem',
              }}
            >
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
                    color: '#16a34a',
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
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.day}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{item.street}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                    <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem', color: '#16a34a' }} />
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simple bottom nav look */}
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              marginTop: 'auto',
              paddingTop: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '0.5rem 0.75rem 0',
                borderRadius: 999,
                backgroundColor: '#ffffff',
                boxShadow: '0 -6px 18px rgba(15,23,42,0.12)',
              }}
            >
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  color: '#16a34a',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                <IonIcon icon={homeOutline} style={{ fontSize: '1.2rem' }} />
                Home
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  color: '#6b7280',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#16a34a';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  if (icon) {
                    icon.style.fontSize = '1.5rem';
                    icon.style.transition = 'all 0.2s ease';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                  }
                }}
                onClick={() => history.push('/resident/truck')}
              >
                <IonIcon icon={busOutline} style={{ fontSize: '1.2rem', transition: 'all 0.2s ease' }} />
                Truck
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  color: '#6b7280',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
                onClick={() => history.push('/resident/report')}
              >
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '1.2rem' }} />
                Report
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  color: '#6b7280',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
                onClick={() => history.push('/resident/reports')}
              >
                <IonIcon icon={documentTextOutline} style={{ fontSize: '1.2rem' }} />
                View Reports
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  color: '#6b7280',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
                onClick={() => history.push('/resident/profile')}
              >
                <IonIcon icon={personOutline} style={{ fontSize: '1.2rem' }} />
                Profile
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
          <IonToolbar style={{ '--background': '#16a34a', '--color': '#ecfdf3' }}>
            <IonTitle>Weekly Schedule</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowScheduleModal(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: '#ecfdf3', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              {/* Today's Schedule */}
              {getTodaySchedules().length > 0 && (
                <div className="watch-card" style={{ padding: '1.3rem 1.4rem', marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <IonText>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#16a34a' }}>
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
                        borderBottom: index < getTodaySchedules().length - 1 ? '1px solid #e5e7eb' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.street}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#16a34a' }}>
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
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Full Weekly Schedule</h3>
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
                        borderBottom: index < allSchedules.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: isToday ? '#ecfdf3' : 'transparent',
                        borderRadius: isToday ? '8px' : '0',
                        paddingLeft: isToday ? '0.75rem' : '0',
                        paddingRight: isToday ? '0.75rem' : '0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isToday ? '#16a34a' : '#111827' }}>
                          {item.day} {isToday && '(Today)'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{item.street}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: isToday ? '#16a34a' : '#111827' }}>
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
