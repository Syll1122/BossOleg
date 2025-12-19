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
import ThemeToggle from '../components/ThemeToggle';
import { databaseService } from '../services/database-supabase';
import { supabase } from '../services/supabase';

interface ScheduleItem {
  day: string;
  time: string;
  street: string;
}

// Day abbreviations mapping
const DAY_ABBREVIATIONS: { [key: string]: string } = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
  'Saturday': 'Sat',
  'Sunday': 'Sun'
};

const DAY_NAMES: { [key: string]: string } = {
  'Mon': 'Monday',
  'Tue': 'Tuesday',
  'Wed': 'Wednesday',
  'Thu': 'Thursday',
  'Fri': 'Friday',
  'Sat': 'Saturday',
  'Sun': 'Sunday'
};

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
    return residentSchedules.filter(schedule => schedule.day === today);
  };

  // Get schedules for other days
  const getOtherDaySchedules = (): ScheduleItem[] => {
    const today = getCurrentDay();
    return residentSchedules.filter(schedule => schedule.day !== today);
  };

  // Load resident schedules from database
  const loadResidentSchedules = async () => {
    if (user?.role !== 'resident') return;
    
    setIsLoadingSchedules(true);
    try {
      await databaseService.init();
      const userId = getCurrentUserId();
      if (!userId) {
        console.log('No user ID found');
        setIsLoadingSchedules(false);
        return;
      }

      // Get resident's barangay from account
      const account = await databaseService.getAccountById(userId);
      console.log('Resident account:', account);

      // Get all schedules (we'll filter by barangay if available, otherwise show all)
      const { data: allSchedulesData, error: fetchError } = await supabase
        .from('collection_schedules')
        .select('*');
      
      if (fetchError) {
        console.error('Error fetching schedules:', fetchError);
        throw fetchError;
      }
      
      console.log('All schedules in database:', allSchedulesData);
      
      // Filter by barangay if resident has one set, otherwise show all schedules
      let schedules = allSchedulesData || [];
      
      if (account?.barangay && schedules.length > 0) {
        console.log(`Resident barangay: ${account.barangay}`);
        console.log(`Filtering ${schedules.length} schedules for barangay: ${account.barangay}`);
        const filteredSchedules = await databaseService.getSchedulesByBarangay(account.barangay);
        console.log('Found schedules after filtering:', filteredSchedules);
        
        // Use filtered schedules if matches found, otherwise show all
        if (filteredSchedules.length > 0) {
          schedules = filteredSchedules;
        } else {
          console.log('No schedules matched barangay, showing all schedules');
          // Keep all schedules
        }
      } else {
        if (!account?.barangay) {
          console.log('No barangay set for resident, showing all schedules');
        } else {
          console.log('No schedules found in database');
        }
      }
      
      // Convert schedules to ScheduleItem format
      const scheduleMap = new Map<string, ScheduleItem>();
      
      console.log(`Processing ${schedules.length} schedules to convert to schedule items...`);
      
      schedules.forEach((schedule, index) => {
        console.log(`\nProcessing schedule ${index + 1}:`, {
          id: schedule.id,
          days: schedule.days,
          street_name: schedule.street_name,
          barangay_name: schedule.barangay_name
        });
        
        const days = Array.isArray(schedule.days) ? schedule.days : [];
        const streetNames = Array.isArray(schedule.street_name) 
          ? schedule.street_name 
          : schedule.street_name ? [schedule.street_name] : [];
        
        console.log(`  Parsed - Days: [${days.join(', ')}], Streets: [${streetNames.join(', ')}]`);
        
        if (days.length === 0) {
          console.log(`  Skipping schedule - no days`);
          return;
        }
        
        days.forEach(dayAbbr => {
          const dayName = DAY_NAMES[dayAbbr] || dayAbbr;
          
          // If multiple streets, create entries for each
          if (streetNames.length > 0) {
            streetNames.forEach(street => {
              if (street) {
                const key = `${dayName}-${street}`;
                if (!scheduleMap.has(key)) {
                  // Default time (can be enhanced later with actual time from schedule)
                  const time = '7:00 AM'; // Default time
                  scheduleMap.set(key, {
                    day: dayName,
                    time: time,
                    street: street
                  });
                  console.log(`  ✓ Added: ${dayName} - ${street}`);
                } else {
                  console.log(`  ⊗ Skipped duplicate: ${dayName} - ${street}`);
                }
              }
            });
          } else {
            // If no street name, use barangay name
            const barangayName = Array.isArray(schedule.barangay_name) 
              ? schedule.barangay_name[0] 
              : schedule.barangay_name || account?.barangay || 'Unknown Location';
            
            const key = `${dayName}-${barangayName}`;
            if (!scheduleMap.has(key)) {
              const time = '7:00 AM';
              scheduleMap.set(key, {
                day: dayName,
                time: time,
                street: barangayName
              });
              console.log(`  ✓ Added: ${dayName} - ${barangayName} (no street)`);
            } else {
              console.log(`  ⊗ Skipped duplicate: ${dayName} - ${barangayName}`);
            }
          }
        });
      });
      
      console.log(`\nTotal unique schedule items created: ${scheduleMap.size}`);

      // Convert map to array and sort by day order, with today's schedules first
      const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const today = getCurrentDay();
      
      const sortedSchedules = Array.from(scheduleMap.values()).sort((a, b) => {
        // If one is today and the other is not, today comes first
        const aIsToday = a.day === today;
        const bIsToday = b.day === today;
        
        if (aIsToday && !bIsToday) return -1; // a (today) comes before b
        if (!aIsToday && bIsToday) return 1;  // b (today) comes before a
        
        // If both are today or neither is today, sort by day order
        return allDays.indexOf(a.day) - allDays.indexOf(b.day);
      });

      setResidentSchedules(sortedSchedules);
    } catch (error) {
      console.error('Error loading resident schedules:', error);
      setResidentSchedules([]);
    } finally {
      setIsLoadingSchedules(false);
    }
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

  // Load schedules when user is available
  useEffect(() => {
    if (user?.role === 'resident') {
      loadResidentSchedules();
    }
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
      await loadResidentSchedules();
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>WATCH</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
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
            background: 'var(--app-bg-primary)',
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
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--app-text-secondary)' }}>Hello,</p>
                <h2 style={{ margin: '0.15rem 0 0.6rem', fontSize: '1.4rem', color: 'var(--app-text-primary)' }}>
                  {user ? user.name : 'WATCH Resident'}
                </h2>
              </IonText>

              <div
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: 18,
                  backgroundColor: 'var(--app-surface-elevated)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px var(--app-shadow), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <IonIcon icon={calendarOutline} style={{ fontSize: '1rem', color: '#22c55e', filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--app-text-secondary)' }}>Next collection</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--app-text-primary)' }}>Click truck icon below to track</div>
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
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--app-text-primary)' }}>Weekly schedule</h3>
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

              {isLoadingSchedules ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                  Loading schedule...
                </div>
              ) : residentSchedules.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                  No collection schedule available. Please update your barangay in your profile.
                </div>
              ) : (
                (() => {
                  const today = getCurrentDay();
                  const todaySchedules = residentSchedules.filter(s => s.day === today);
                  const otherSchedules = residentSchedules.filter(s => s.day !== today);
                  
                  // Show today's schedules first, then others (up to 3 total, prioritizing today)
                  const displaySchedules = [...todaySchedules, ...otherSchedules].slice(0, 3);
                  
                  return displaySchedules.map((item, index) => {
                    const isToday = item.day === today;
                    return (
                      <div
                        key={`${item.day}-${item.street}-${index}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.7rem 0',
                          borderBottom: index < displaySchedules.length - 1 ? '1px solid var(--app-border)' : 'none',
                        }}
                      >
                        <div>
                          <div style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 600, 
                            color: isToday ? '#22c55e' : 'var(--app-text-primary)' 
                          }}>
                            {item.day} {isToday && '(Today)'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--app-text-secondary)' }}>{item.street}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--app-text-primary)' }}>
                          <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem', color: '#22c55e', filter: isToday ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' : 'none' }} />
                          <span style={{ color: '#22c55e', fontWeight: isToday ? 600 : 400 }}>{item.time}</span>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
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
                  onClick={() => setShowEcoFriendlyModal(true)}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>Eco-Friendly</div>
                </div>
                
                <div
                  onClick={() => setShowSustainableModal(true)}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>Sustainable</div>
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
                <div style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', marginBottom: '0.5rem' }}>
                  Stay connected with your collection schedule
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>💡</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-text-primary)', fontWeight: 500 }}>
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
                backgroundColor: 'var(--app-bg-secondary)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 -6px 18px var(--app-shadow-lg)',
              }}
            >
              <button
                type="button"
                style={{
                  border: '2px solid #22c55e',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3), inset 0 0 15px rgba(34, 197, 94, 0.1)',
                  minWidth: '60px',
                }}
              >
                <IonIcon icon={homeOutline} style={{ fontSize: '1.3rem', color: '#22c55e', transition: 'all 0.3s ease', filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))' }} />
                <span style={{ color: '#22c55e', marginTop: '4px', fontSize: '0.65rem', opacity: 1, transition: 'all 0.3s ease', fontWeight: 700 }}>Home</span>
              </button>
              <button
                type="button"
                style={{
                  border: '2px solid rgba(34, 197, 94, 0.4)',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.6), 0 0 50px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.color = '#22c55e';
                    icon.style.filter = 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                    text.style.color = '#22c55e';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.color = 'var(--app-text-primary)';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                    text.style.color = 'var(--app-text-primary)';
                  }
                }}
                onClick={() => history.push('/resident/truck')}
              >
                <IonIcon icon={busOutline} style={{ fontSize: '1.2rem', color: 'var(--app-text-primary)', transition: 'all 0.3s ease' }} />
                <span style={{ color: 'var(--app-text-primary)', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Truck</span>
              </button>
              <button
                type="button"
                style={{
                  border: '2px solid rgba(34, 197, 94, 0.4)',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.6), 0 0 50px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.color = '#22c55e';
                    icon.style.filter = 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                    text.style.color = '#22c55e';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.color = 'var(--app-text-primary)';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                    text.style.color = 'var(--app-text-primary)';
                  }
                }}
                onClick={() => history.push('/resident/report')}
              >
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '1.2rem', color: 'var(--app-text-primary)', transition: 'all 0.3s ease' }} />
                <span style={{ color: 'var(--app-text-primary)', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Report</span>
              </button>
              <button
                type="button"
                style={{
                  border: '2px solid rgba(34, 197, 94, 0.4)',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.6), 0 0 50px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.color = '#22c55e';
                    icon.style.filter = 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                    text.style.color = '#22c55e';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.color = 'var(--app-text-primary)';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                    text.style.color = 'var(--app-text-primary)';
                  }
                }}
                onClick={() => history.push('/resident/reports')}
              >
                <IonIcon icon={documentTextOutline} style={{ fontSize: '1.2rem', color: 'var(--app-text-primary)', transition: 'all 0.3s ease' }} />
                <span style={{ color: 'var(--app-text-primary)', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>View Reports</span>
              </button>
              <button
                type="button"
                style={{
                  border: '2px solid rgba(34, 197, 94, 0.4)',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
                  minWidth: '60px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.6), 0 0 50px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.4rem';
                    icon.style.color = '#22c55e';
                    icon.style.filter = 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))';
                  }
                  if (text) {
                    text.style.opacity = '1';
                    text.style.fontSize = '0.7rem';
                    text.style.fontWeight = '700';
                    text.style.color = '#22c55e';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  const icon = e.currentTarget.querySelector('ion-icon');
                  const text = e.currentTarget.querySelector('span');
                  if (icon) {
                    icon.style.fontSize = '1.2rem';
                    icon.style.color = 'var(--app-text-primary)';
                    icon.style.filter = 'none';
                  }
                  if (text) {
                    text.style.opacity = '0.7';
                    text.style.fontSize = '0.65rem';
                    text.style.fontWeight = '400';
                    text.style.color = 'var(--app-text-primary)';
                  }
                }}
                onClick={() => history.push('/resident/profile')}
              >
                <IonIcon icon={personOutline} style={{ fontSize: '1.2rem', color: 'var(--app-text-primary)', transition: 'all 0.3s ease' }} />
                <span style={{ color: 'var(--app-text-primary)', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Profile</span>
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
          <IonToolbar>
            <IonTitle>Weekly Schedule</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowScheduleModal(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
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
                        borderBottom: index < getTodaySchedules().length - 1 ? '1px solid var(--app-border)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--app-text-primary)' }}>{item.street}</div>
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
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--app-text-primary)' }}>Full Weekly Schedule</h3>
                  </IonText>
                </div>
                {(() => {
                  const today = getCurrentDay();
                  const todaySchedules = residentSchedules.filter(s => s.day === today);
                  const otherSchedules = residentSchedules.filter(s => s.day !== today);
                  
                  // Combine: today's schedules first, then others
                  const sortedForDisplay = [...todaySchedules, ...otherSchedules];
                  
                  if (sortedForDisplay.length === 0) {
                    return (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                        No collection schedule available. Please update your barangay in your profile.
                      </div>
                    );
                  }
                  
                  return sortedForDisplay.map((item, index) => {
                    const isToday = item.day === today;
                    return (
                      <div
                        key={`${item.day}-${item.street}-${index}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.7rem 0',
                          borderBottom: index < sortedForDisplay.length - 1 ? '1px solid var(--app-border)' : 'none',
                          backgroundColor: isToday ? 'var(--app-surface-elevated)' : 'transparent',
                          borderRadius: isToday ? '8px' : '0',
                          paddingLeft: isToday ? '0.75rem' : '0',
                          paddingRight: isToday ? '0.75rem' : '0',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isToday ? '#22c55e' : 'var(--app-text-primary)' }}>
                            {item.day} {isToday && '(Today)'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--app-text-secondary)' }}>{item.street}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: isToday ? '#22c55e' : 'var(--app-text-primary)' }}>
                          <IonIcon icon={timeOutline} style={{ fontSize: '0.9rem' }} />
                          <span style={{ fontWeight: isToday ? 600 : 400 }}>{item.time}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Eco-Friendly Modal */}
      <IonModal isOpen={showEcoFriendlyModal} onDidDismiss={() => setShowEcoFriendlyModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>♻️ Eco-Friendly</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowEcoFriendlyModal(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div className="watch-card" style={{ padding: '1.5rem 1.4rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>♻️</div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#22c55e', fontWeight: 700 }}>Eco-Friendly Practices</h2>
                </div>

                {ecoSlides.length > 0 && (
                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <img
                      src={`${ecoSlides[ecoSlideIndex].image}&sig=eco-${ecoSlideIndex}`}
                      alt={ecoSlides[ecoSlideIndex].title}
                      style={{
                        width: '100%',
                        borderRadius: 16,
                        marginBottom: '0.75rem',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                        objectFit: 'cover',
                        maxHeight: 220,
                        transition: 'opacity 0.6s ease',
                        opacity: 1,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => cycleSlide('prev', ecoSlides.length, setEcoSlideIndex)}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: 12,
                        transform: 'translateY(-50%)',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: 'none',
                        color: 'white',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => cycleSlide('next', ecoSlides.length, setEcoSlideIndex)}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: 12,
                        transform: 'translateY(-50%)',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: 'none',
                        color: 'white',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      ›
                    </button>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ fontSize: '1.1rem', color: '#22c55e', marginBottom: '0.35rem' }}>{ecoSlides[ecoSlideIndex].title}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: 1.5 }}>
                        {ecoSlides[ecoSlideIndex].description}
                      </p>
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    What is Eco-Friendly Waste Collection?
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    Eco-friendly waste collection refers to waste management practices that minimize environmental impact and promote sustainability. This includes proper sorting, recycling, and disposal methods that reduce pollution and conserve natural resources.
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Key Benefits
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Reduces landfill waste and greenhouse gas emissions</li>
                    <li>Conserves natural resources through recycling</li>
                    <li>Protects wildlife and ecosystems from pollution</li>
                    <li>Promotes a cleaner, healthier environment for communities</li>
                    <li>Supports circular economy principles</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Eco-Friendly Actions You Can Take Today
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Organize a neighborhood “reverse booth” that collects plastics for upcycling.</li>
                    <li>Switch to biodegradable liners made from cassava or cornstarch for organic bins.</li>
                    <li>Host community repair cafes to keep electronics and bikes out of landfills.</li>
                    <li>Designate a “reusable day” each week where the household avoids disposables entirely.</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    How You Can Help
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Sort your waste properly (recyclables, organic, general)</li>
                    <li>Reduce waste by choosing reusable products</li>
                    <li>Follow collection schedules to ensure proper disposal</li>
                    <li>Report improper waste disposal when you see it</li>
                    <li>Educate others about eco-friendly practices</li>
                  </ul>
                </div>

                <div style={{
                  padding: '1rem',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', margin: 0, fontStyle: 'italic' }}>
                    "Every small action counts. Together, we can create a more sustainable future for our planet."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Sustainable Modal */}
      <IonModal isOpen={showSustainableModal} onDidDismiss={() => setShowSustainableModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>🌱 Sustainable</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowSustainableModal(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div className="watch-card" style={{ padding: '1.5rem 1.4rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🌱</div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#22c55e', fontWeight: 700 }}>Sustainable Waste Management</h2>
                </div>

              {sustainableSpotlights.length > 0 && (
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <img
                    src={`${sustainableSpotlights[sustainableSlideIndex].image}&sig=sus-${sustainableSlideIndex}`}
                    alt={sustainableSpotlights[sustainableSlideIndex].title}
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      marginBottom: '0.75rem',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                      objectFit: 'cover',
                      maxHeight: 220,
                      transition: 'opacity 0.6s ease',
                      opacity: 1,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => cycleSlide('prev', sustainableSpotlights.length, setSustainableSlideIndex)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 12,
                      transform: 'translateY(-50%)',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: 'none',
                      color: 'white',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleSlide('next', sustainableSpotlights.length, setSustainableSlideIndex)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 12,
                      transform: 'translateY(-50%)',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: 'none',
                      color: 'white',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                  >
                    ›
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#22c55e', marginBottom: '0.35rem' }}>
                      {sustainableSpotlights[sustainableSlideIndex].title}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: 1.5 }}>
                      {sustainableSpotlights[sustainableSlideIndex].description}
                    </p>
                  </div>
                </div>
              )}
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    What is Sustainability?
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    Sustainability means meeting our current needs without compromising the ability of future generations to meet their own needs. In waste management, this involves creating systems that can operate long-term without depleting resources or harming the environment.
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Sustainable Practices
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Efficient collection routes that minimize fuel consumption</li>
                    <li>Waste-to-energy programs that generate renewable power</li>
                    <li>Composting organic waste to create nutrient-rich soil</li>
                    <li>Material recovery facilities that maximize recycling</li>
                    <li>Community education programs on waste reduction</li>
                    <li>Depot solar roofs that power compactors and overnight charging bays</li>
                    <li>Reclaimed water systems for washing bins and fleet vehicles</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Innovation Highlights
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Deploy AI route-planning to reduce idle time and fuel burn on collection days.</li>
                    <li>Adopt smart bins that alert crews when full to prevent overflow and missed pickups.</li>
                    <li>Partner with local artisans who transform recyclables into market-ready products.</li>
                    <li>Use digital QR tags on bins so residents can view collection history and tips.</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--app-text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Long-Term Impact
                  </h3>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', lineHeight: '1.8', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Preserves natural resources for future generations</li>
                    <li>Reduces dependency on landfills</li>
                    <li>Creates green jobs and economic opportunities</li>
                    <li>Improves air and water quality in communities</li>
                    <li>Builds resilience against environmental challenges</li>
                  </ul>
                </div>

                <div style={{
                  padding: '1rem',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', margin: 0, fontStyle: 'italic' }}>
                    "Sustainability is not about perfection, it's about progress. Every step towards a greener future matters."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default Home;
