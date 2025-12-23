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
  IonToast,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonRadioGroup,
  IonRadio,
  IonAlert,
  IonSpinner,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { menuOutline, calendarOutline, timeOutline, homeOutline, personOutline, logInOutline, logOutOutline, personAddOutline, busOutline, playOutline, alertCircleOutline, documentTextOutline, closeOutline, listOutline } from 'ionicons/icons';
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
  scheduleId?: string;
  collectorId?: string;
  truckNo?: string;
}

// Helper function to format time from HH:MM to 12-hour format
const formatTime = (timeStr: string): string => {
  if (!timeStr) return '8:00 AM';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes || '00'} ${ampm}`;
};

// Helper function to get week dates (responsive to current date)
const getWeekDates = (weekOffset: number = 0) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
  monday.setHours(0, 0, 0, 0);
  
  // Apply week offset
  if (weekOffset !== 0) {
    monday.setDate(monday.getDate() + (weekOffset * 7));
  }
  
  const week = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    week.push({
      day: dayNames[i],
      date: date.getDate(),
      fullDate: new Date(date),
      isToday: date.getTime() === todayDate.getTime(),
      isPast: date < todayDate
    });
  }
  return week;
};

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
  const [residentSchedules, setResidentSchedules] = useState<ScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [showEcoFriendlyModal, setShowEcoFriendlyModal] = useState(false);
  const [showSustainableModal, setShowSustainableModal] = useState(false);
  const [ecoSlideIndex, setEcoSlideIndex] = useState(0);
  const [sustainableSlideIndex, setSustainableSlideIndex] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [collectionStatuses, setCollectionStatuses] = useState<any[]>([]);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date>(new Date());
  const [allSchedulesData, setAllSchedulesData] = useState<any[]>([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = previous, 1 = next
  const weekDates = getWeekDates(currentWeekOffset);
  
  // Create Report Modal State
  const [reportType, setReportType] = useState<'type' | 'select' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customReport, setCustomReport] = useState('');
  const [barangay, setBarangay] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReportAlert, setShowReportAlert] = useState(false);
  const [reportAlertMessage, setReportAlertMessage] = useState('');
  const [reportAlertHeader, setReportAlertHeader] = useState('');

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

  // Eco-friendly slides data
  const ecoSlides = [
    {
      image: 'https://images.unsplash.com/photo-1587426368191-9b10ad7ccc0a?w=800',
      title: 'Reduce, Reuse, Recycle',
      description: 'The three R\'s of waste management help minimize environmental impact and conserve resources.'
    },
    {
      image: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=800',
      title: 'Composting Organic Waste',
      description: 'Transform food scraps and yard waste into nutrient-rich compost for gardens.'
    },
    {
      image: 'https://images.unsplash.com/photo-1610878180933-123728745d22?w=800',
      title: 'Plastic Alternatives',
      description: 'Switching to reusable and biodegradable materials reduces plastic pollution.'
    }
  ];

  // Sustainable spotlights data
  const sustainableSpotlights = [
    {
      image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800',
      title: 'Smart Waste Management',
      description: 'Technology-driven solutions for efficient and sustainable waste collection.'
    },
    {
      image: 'https://images.unsplash.com/photo-1593113616828-c4b68e50e3b7?w=800',
      title: 'Green Energy Initiatives',
      description: 'Solar-powered facilities and renewable energy systems for waste processing.'
    },
    {
      image: 'https://images.unsplash.com/photo-1569163139394-de44cb75ae9a?w=800',
      title: 'Circular Economy',
      description: 'Creating closed-loop systems where waste becomes valuable resources.'
    }
  ];

  // Cycle through slides
  const cycleSlide = (direction: 'prev' | 'next', total: number, setIndex: React.Dispatch<React.SetStateAction<number>>) => {
    setIndex((prev) => {
      if (direction === 'next') {
        return (prev + 1) % total;
      } else {
        return (prev - 1 + total) % total;
      }
    });
  };

  // Get schedules for today
  const getTodaySchedules = (): ScheduleItem[] => {
    const today = getCurrentDay();
    return residentSchedules.filter((schedule: ScheduleItem) => schedule.day === today);
  };

  // Get schedules for other days
  const getOtherDaySchedules = (): ScheduleItem[] => {
    const today = getCurrentDay();
    return residentSchedules.filter((schedule: ScheduleItem) => schedule.day !== today);
  };

  // Get schedule status using updated collection_status schema
  const getScheduleStatus = (scheduleItem: ScheduleItem, scheduleDate: Date): 'pending' | 'completed' | 'skipped' | 'in-progress' => {
    if (!scheduleItem.scheduleId) return 'pending';
    
    const dateStr = scheduleDate.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDateOnly = new Date(scheduleDate);
    scheduleDateOnly.setHours(0, 0, 0, 0);
    
    const isPastDate = scheduleDateOnly < today;
    
    // Find the original schedule data to get barangay and street info
    const originalSchedule = allSchedulesData.find(s => s.id === scheduleItem.scheduleId);
    if (!originalSchedule) return 'pending';
    
    const barangayName = Array.isArray(originalSchedule.barangay_name) 
      ? originalSchedule.barangay_name[0] 
      : originalSchedule.barangay_name || '';
    const streetName = scheduleItem.street;
    
    // Find collection status using updated schema (scheduleId + streetName + collectionDate)
    const collectionStatus = collectionStatuses.find(cs => {
      const matchesSchedule = cs.scheduleId === scheduleItem.scheduleId;
      const matchesDate = cs.collectionDate === dateStr;
      const matchesStreet = cs.streetName === streetName;
      const matchesBarangay = cs.barangayName === barangayName;
      return matchesSchedule && matchesDate && matchesStreet && matchesBarangay;
    });
    
    if (collectionStatus) {
      if (collectionStatus.status === 'collected') return 'completed';
      if (collectionStatus.status === 'skipped' || collectionStatus.status === 'missed') return 'skipped';
      if (collectionStatus.status === 'pending') return 'in-progress';
    }
    
    // If date is past and no collection status, mark as skipped (missed)
    if (isPastDate) return 'skipped';
    return 'pending';
  };

  // Get schedules for a specific date (all statuses)
  const getSchedulesForDate = (date: Date, showAllStatuses: boolean = false): ScheduleItem[] => {
    const dayIndex = date.getDay();
    const dayName = dayIndex === 0 ? 'Sunday' : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex - 1];
    
    let filtered = residentSchedules.filter(schedule => schedule.day === dayName);
    
    if (!showAllStatuses) {
      // Only show pending schedules in the main view
      filtered = filtered.filter(schedule => {
        const status = getScheduleStatus(schedule, date);
        return status === 'pending';
      });
    }
    
    return filtered;
  };

  // Get all schedules for the week grouped by day
  const getSchedulesForWeek = (weekOffset: number = 0): { [key: string]: ScheduleItem[] } => {
    const week = getWeekDates(weekOffset);
    const schedulesByDay: { [key: string]: ScheduleItem[] } = {};
    
    week.forEach(weekDay => {
      const dayIndex = weekDay.fullDate.getDay();
      const dayName = dayIndex === 0 ? 'Sunday' : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex - 1];
      
      const schedulesForDay = residentSchedules
        .filter(schedule => schedule.day === dayName)
        .map(schedule => ({
          ...schedule,
          status: getScheduleStatus(schedule, weekDay.fullDate),
          date: weekDay.fullDate
        }));
      
      if (schedulesForDay.length > 0) {
        schedulesByDay[dayName] = schedulesForDay;
      }
    });
    
    return schedulesByDay;
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
        
        days.forEach((dayAbbr: string) => {
          const dayName = DAY_NAMES[dayAbbr] || dayAbbr;
          
          // If multiple streets, create entries for each
          if (streetNames.length > 0) {
            streetNames.forEach((street: string) => {
              if (street) {
                  const key = `${dayName}-${street}`;
                if (!scheduleMap.has(key)) {
                  // Get time from schedule or use default
                  const scheduleTime = schedule.collection_time || '08:00';
                  const time = formatTime(scheduleTime);
                  scheduleMap.set(key, {
                    day: dayName,
                    time: time,
                    street: street,
                    scheduleId: schedule.id,
                    collectorId: schedule.collector_id,
                    truckNo: schedule.truck_no
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
              const scheduleTime = schedule.collection_time || '08:00';
              const time = formatTime(scheduleTime);
              scheduleMap.set(key, {
                day: dayName,
                time: time,
                street: barangayName,
                scheduleId: schedule.id,
                collectorId: schedule.collector_id,
                truckNo: schedule.truck_no
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
      setAllSchedulesData(schedules);

      // Load collection statuses for the current week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: collectionStatusData } = await supabase
        .from('collection_status')
        .select('*')
        .gte('collectionDate', weekStart.toISOString().split('T')[0])
        .lte('collectionDate', weekEnd.toISOString().split('T')[0]);

      if (collectionStatusData) {
        const mappedStatuses = collectionStatusData.map((status: any) => ({
          id: status.id,
          scheduleId: status.scheduleId || status.schedule_id,
          collectorId: status.collectorId || status.collector_id,
          streetName: status.streetName || status.street_name || status.street || '',
          streetId: status.streetId || status.street_id || null,
          barangayName: status.barangayName || status.barangay_name || status.barangay || '',
          status: status.status || 'pending',
          collectionDate: status.collectionDate || status.collection_date,
          updatedAt: status.updatedAt || status.updated_at
        }));
        setCollectionStatuses(mappedStatuses);
      }
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

  // Load collection statuses for the selected week (updates when week changes)
  const loadCollectionStatusesForWeek = async (weekOffset: number) => {
    try {
      const weekDates = getWeekDates(weekOffset);
      if (weekDates.length === 0) return;

      const weekStart = new Date(weekDates[0].fullDate);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekDates[weekDates.length - 1].fullDate);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: collectionStatusData } = await supabase
        .from('collection_status')
        .select('*')
        .gte('collectionDate', weekStart.toISOString().split('T')[0])
        .lte('collectionDate', weekEnd.toISOString().split('T')[0]);

      if (collectionStatusData) {
        const mappedStatuses = collectionStatusData.map((status: any) => ({
          id: status.id,
          scheduleId: status.scheduleId || status.schedule_id,
          collectorId: status.collectorId || status.collector_id,
          streetName: status.streetName || status.street_name || status.street || '',
          streetId: status.streetId || status.street_id || null,
          barangayName: status.barangayName || status.barangay_name || status.barangay || '',
          status: status.status || 'pending',
          collectionDate: status.collectionDate || status.collection_date,
          updatedAt: status.updatedAt || status.updated_at
        }));
        setCollectionStatuses(mappedStatuses);
      }
    } catch (error) {
      console.error('Error loading collection statuses:', error);
    }
  };

  // Load collection statuses when week changes
  useEffect(() => {
    if (user?.role === 'resident' && allSchedulesData.length > 0) {
      loadCollectionStatusesForWeek(currentWeekOffset);
    }
  }, [currentWeekOffset, user, allSchedulesData]);

  // Auto-refresh collection statuses every 30 seconds to update schedule status
  useEffect(() => {
    if (user?.role !== 'resident' || allSchedulesData.length === 0) return;

    const refreshCollectionStatuses = async () => {
      await loadCollectionStatusesForWeek(currentWeekOffset);
    };

    // Refresh immediately
    refreshCollectionStatuses();

    // Then refresh every 30 seconds
    const interval = setInterval(refreshCollectionStatuses, 30000);
    return () => clearInterval(interval);
  }, [user, allSchedulesData, currentWeekOffset]);

  // Refresh function - reload notifications and report status
  const handleRefresh = async () => {
    const userId = getCurrentUserId();
    if (userId && user?.role === 'resident') {
      await initializeResidentNotifications(userId);
      await checkReportStatusChanges(userId);
      await loadResidentSchedules();
    }
  };

  // Handle authentication check for protected actions
  const handleAuthRequired = (action: 'report' | 'viewReports') => {
    if (!user) {
      setToastMessage('You must log in first before accessing this feature.');
      setShowToast(true);
      return false;
    }
    return true;
  };

  // Handle Reports button click - navigate directly to View Reports
  const handleReportsClick = () => {
    if (handleAuthRequired('report')) {
      history.push('/resident/reports');
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

              {/* Week Date Slider */}
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                marginBottom: '1rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <style>
                  {`
                    div::-webkit-scrollbar {
                      display: none;
                    }
                  `}
                </style>
                {getWeekDates(currentWeekOffset).map((weekDay, index) => {
                  const isSelected = selectedScheduleDate.getTime() === weekDay.fullDate.getTime();
                  const schedulesForDay = getSchedulesForDate(weekDay.fullDate, true); // Show all statuses in slider
                  const routeCount = schedulesForDay.length;
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedScheduleDate(weekDay.fullDate)}
                      style={{
                        minWidth: '60px',
                        padding: '0.75rem 0.5rem',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #3b82f6' : '1px solid var(--app-border)',
                        background: isSelected 
                          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))'
                          : weekDay.isToday
                          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))'
                          : 'var(--app-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected 
                          ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                          : weekDay.isToday
                          ? '0 2px 8px rgba(34, 197, 94, 0.2)'
                          : '0 1px 4px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: isSelected ? '#3b82f6' : weekDay.isToday ? '#22c55e' : 'var(--app-text-secondary)',
                        fontWeight: isSelected || weekDay.isToday ? 600 : 400,
                        marginBottom: '0.25rem'
                      }}>
                        {weekDay.day}
                      </div>
                      <div style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 700,
                        color: isSelected ? '#3b82f6' : weekDay.isToday ? '#22c55e' : 'var(--app-text-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        {weekDay.date}
                      </div>
                      <div style={{ 
                        fontSize: '0.7rem', 
                        color: isSelected ? '#3b82f6' : 'var(--app-text-secondary)',
                        fontWeight: 500
                      }}>
                        {routeCount} {routeCount === 1 ? 'route' : 'routes'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Date Schedule List */}
              {isLoadingSchedules ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                  Loading schedule...
                </div>
              ) : (() => {
                const schedulesForSelectedDate = getSchedulesForDate(selectedScheduleDate, true); // Show all statuses
                
                if (schedulesForSelectedDate.length === 0) {
                  return (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                      No collection schedules for this date.
                    </div>
                  );
                }
                
                // Get original schedule data for barangay name
                return schedulesForSelectedDate.map((item, index) => {
                  const status = getScheduleStatus(item, selectedScheduleDate);
                  const originalSchedule = allSchedulesData.find(s => s.id === item.scheduleId);
                  const barangayName = originalSchedule 
                    ? (Array.isArray(originalSchedule.barangay_name) 
                        ? originalSchedule.barangay_name[0] 
                        : originalSchedule.barangay_name || 'Unknown')
                    : 'Unknown';
                  const streetName = item.street;
                  
                  return (
                    <div
                      key={`${item.day}-${item.street}-${index}`}
                      style={{
                        display: 'flex',
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '0.75rem',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Status bar on left */}
                      <div style={{
                        width: '4px',
                        background: status === 'completed' ? '#10b981' : 
                                   status === 'skipped' ? '#ef4444' : 
                                   status === 'in-progress' ? '#3b82f6' : '#f59e0b',
                        flexShrink: 0,
                      }} />
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        gap: '1rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          {/* Barangay name as title */}
                          <h4 style={{ 
                            margin: '0 0 0.5rem 0', 
                            fontSize: '1rem', 
                            fontWeight: 600, 
                            color: 'var(--app-text-primary)'
                          }}>
                            {barangayName}
                          </h4>
                          {/* Location and time details */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                            fontSize: '0.875rem',
                            color: 'var(--app-text-secondary)',
                            marginBottom: '0.75rem'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '1rem' }}>📍</span>
                              <span>{streetName || 'Zone'}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '1rem' }}>🕐</span>
                              <span>{item.time}</span>
                            </span>
                          </div>
                          {/* Type tag */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ 
                              padding: '0.25rem 0.75rem',
                              background: '#f3f4f6',
                              color: '#374151',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              General
                            </span>
                          </div>
                        </div>
                        {/* Status badge */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {status === 'completed' ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              color: '#16a34a',
                              fontWeight: 500
                            }}>
                              <span>✓</span>
                              <span>completed</span>
                            </div>
                          ) : status === 'skipped' ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              color: '#ef4444',
                              fontWeight: 500
                            }}>
                              <span>⚠</span>
                              <span>missed</span>
                            </div>
                          ) : status === 'in-progress' ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              color: '#3b82f6',
                              fontWeight: 500
                            }}>
                              <span>🕐</span>
                              <span>in progress</span>
                            </div>
                          ) : (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              color: '#f59e0b',
                              fontWeight: 500
                            }}>
                              <span>🕐</span>
                              <span>pending</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
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
                onClick={handleReportsClick}
              >
                <IonIcon icon={documentTextOutline} style={{ fontSize: '1.2rem', color: 'var(--app-text-primary)', transition: 'all 0.3s ease' }} />
                <span style={{ color: 'var(--app-text-primary)', marginTop: '4px', fontSize: '0.65rem', opacity: 0.7, transition: 'all 0.3s ease' }}>Reports</span>
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

      {/* Weekly Schedule Modal - All Routes by Day */}
      <IonModal isOpen={showScheduleModal} onDidDismiss={() => {
        setShowScheduleModal(false);
        setCurrentWeekOffset(0); // Reset to current week when closing
      }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Weekly Schedule</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => {
                setShowScheduleModal(false);
                setCurrentWeekOffset(0);
              }}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              {/* Week Navigation */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'var(--app-surface)',
                borderRadius: '12px',
                border: '1px solid var(--app-border)'
              }}>
                <button
                  type="button"
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-surface-elevated)',
                    color: 'var(--app-text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>‹</span> Previous
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--app-text-primary)', fontWeight: 600 }}>
                  {(() => {
                    const week = getWeekDates(currentWeekOffset);
                    if (week.length > 0) {
                      const startDate = week[0].fullDate;
                      const endDate = week[6].fullDate;
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      if (startDate.getMonth() === endDate.getMonth()) {
                        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`;
                      } else {
                        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${startDate.getFullYear()}`;
                      }
                    }
                    return 'This Week';
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-surface-elevated)',
                    color: 'var(--app-text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Next <span>›</span>
                </button>
              </div>

              {/* All Weekly Schedules Grouped by Day */}
              {(() => {
                const schedulesByDay = getSchedulesForWeek(currentWeekOffset);
                const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const today = getCurrentDay();
                
                if (Object.keys(schedulesByDay).length === 0) {
                  return (
                    <div className="watch-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--app-text-secondary)' }}>
                      No collection schedules available for this week. Please update your barangay in your profile.
                    </div>
                  );
                }
                
                return dayOrder.map((dayName) => {
                  const schedules = schedulesByDay[dayName] || [];
                  if (schedules.length === 0) return null;
                  
                  const isToday = dayName === today;
                  const week = getWeekDates(currentWeekOffset);
                  const dayDate = week.find(w => {
                    const dayIndex = w.fullDate.getDay();
                    const dayNameFromDate = dayIndex === 0 ? 'Sunday' : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex - 1];
                    return dayNameFromDate === dayName;
                  });
                  
                  return (
                    <div key={dayName} className="watch-card" style={{ 
                      padding: '1.3rem 1.4rem', 
                      marginBottom: '1rem',
                      border: isToday ? '2px solid #22c55e' : '1px solid var(--app-border)'
                    }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <IonText>
                          <h3 style={{ 
                            margin: 0, 
                            fontSize: '1rem', 
                            color: isToday ? '#22c55e' : 'var(--app-text-primary)',
                            fontWeight: 600
                          }}>
                            {dayName} {isToday && '(Today)'}
                            {dayDate && (
                              <span style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', fontWeight: 400, marginLeft: '0.5rem' }}>
                                - {dayDate.fullDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </h3>
                        </IonText>
                      </div>
                      {schedules.map((item, index) => {
                        const status = getScheduleStatus(item, dayDate?.fullDate || new Date());
                        const statusColors: { [key: string]: string } = {
                          'pending': '#f59e0b',
                          'done': '#10b981',
                          'skipped': '#ef4444',
                          'in-progress': '#3b82f6'
                        };
                        const statusLabels: { [key: string]: string } = {
                          'pending': 'pending',
                          'done': 'done',
                          'skipped': 'skipped',
                          'in-progress': 'in progress'
                        };
                        
                        return (
                          <div
                            key={`${dayName}-${item.street}-${index}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.7rem 0',
                              borderBottom: index < schedules.length - 1 ? '1px solid var(--app-border)' : 'none',
                              backgroundColor: isToday ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                              borderRadius: isToday ? '8px' : '0',
                              paddingLeft: isToday ? '0.75rem' : '0',
                              paddingRight: isToday ? '0.75rem' : '0',
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: '0.25rem' }}>
                                {Array.isArray(item.street) ? item.street[0] : item.street}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>
                                  ⏰ {item.time}
                                </span>
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '12px',
                                  background: statusColors[status] || '#6b7280',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  {statusLabels[status] || status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }).filter(Boolean);
              })()}
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

      {/* Toast notification for authentication required */}
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="top"
        color="warning"
      />
    </IonPage>
  );
};

export default Home;
