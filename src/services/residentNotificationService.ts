// src/services/residentNotificationService.ts
// Service for managing resident notifications (schedule, truck proximity, report progress)

import { databaseService } from './database-supabase';
import { getCurrentUserId } from '../utils/auth';
import { calculateDistance, isValidCoordinate } from '../utils/coordinates';
import { supabase } from './supabase';

// Schedule locations (matching collector schedule)
const SCHEDULE_LOCATIONS = [
  { name: 'Don Pedro, HOLY SPIRIT', lat: 14.682042, lng: 121.076975 },
  { name: 'Don Primitivo, HOLY SPIRIT', lat: 14.680823, lng: 121.076206 },
  { name: 'Don Elpidio, HOLY SPIRIT', lat: 14.679855, lng: 121.077793 },
];

const NOTIFICATION_RADIUS_METERS = 400; // 400 meters radius

interface NotificationState {
  scheduleNotifiedCount: number; // Count of schedule notifications sent today (max 3)
  lastReportCheck: Map<string, string>; // reportId -> last known status
  notifiedTrucks: Set<string>; // trucks that have already notified
}

// Store notification state per user
const notificationStates = new Map<string, NotificationState>();

/**
 * Get or create notification state for a user
 */
function getNotificationState(userId: string): NotificationState {
  if (!notificationStates.has(userId)) {
    notificationStates.set(userId, {
      scheduleNotifiedCount: 0,
      lastReportCheck: new Map(),
      notifiedTrucks: new Set(),
    });
  }
  return notificationStates.get(userId)!;
}

/**
 * Get today's schedule notification count
 */
function getTodayScheduleNotificationCount(userId: string): number {
  const state = getNotificationState(userId);
  const today = new Date().toDateString();
  const storedCount = localStorage.getItem(`schedule_notified_count_${userId}_${today}`);
  
  if (storedCount) {
    const count = parseInt(storedCount, 10);
    state.scheduleNotifiedCount = count;
    return count;
  }
  
  return state.scheduleNotifiedCount;
}

/**
 * Check if we can send another schedule notification today (max 3)
 */
function canSendScheduleNotification(userId: string): boolean {
  return getTodayScheduleNotificationCount(userId) < 3;
}

/**
 * Increment today's schedule notification count
 */
function incrementScheduleNotificationCount(userId: string): void {
  const state = getNotificationState(userId);
  state.scheduleNotifiedCount += 1;
  const today = new Date().toDateString();
  localStorage.setItem(`schedule_notified_count_${userId}_${today}`, state.scheduleNotifiedCount.toString());
}

/**
 * Notify resident about today's collection schedule (responsive based on actual schedules)
 */
export async function notifyTodaySchedule(userId: string): Promise<void> {
  try {
    // Check if we can send another notification today (max 3)
    if (!canSendScheduleNotification(userId)) {
      return;
    }

    // Get user's account to check barangay
    const account = await databaseService.getAccountById(userId);
    if (!account || account.role !== 'resident') {
      return;
    }

    // Get today's schedules from database
    const today = new Date();
    const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
    
    const { data: todaySchedules, error } = await supabase
      .from('collection_schedules')
      .select('*');
    
    if (error) {
      console.error('Error fetching schedules:', error);
      return;
    }

    // Filter schedules for today and user's barangay
    const relevantSchedules = (todaySchedules || []).filter((s: any) => {
      const barangayName = Array.isArray(s.barangay_name) ? s.barangay_name[0] : s.barangay_name;
      return s.days.includes(dayAbbr) && barangayName === account.barangay;
    });

    if (relevantSchedules.length === 0) {
      return; // No schedules for today
    }

    // Create schedule list with times
    const scheduleList = relevantSchedules.map((s: any) => {
      const streetName = Array.isArray(s.street_name) ? s.street_name[0] : s.street_name;
      const time = s.collection_time || '08:00';
      return `${streetName || 'Route'} (${time})`;
    }).join(', ');
    
    await databaseService.createNotification({
      userId,
      title: '📅 Today\'s Collection Schedule',
      message: `Collection scheduled for today: ${scheduleList}. Please prepare your waste.`,
      type: 'info',
      read: false,
      link: '/resident/truck',
    });

    incrementScheduleNotificationCount(userId);
    console.log('Schedule notification created for user:', userId);
  } catch (error) {
    console.error('Error creating schedule notification:', error);
  }
}

/**
 * Check if truck is within notification radius and notify resident
 */
export async function checkTruckProximity(
  userId: string,
  residentLat: number,
  residentLng: number,
  truckNo: string,
  truckLat: number,
  truckLng: number,
  collectorName: string
): Promise<void> {
  try {
    if (!isValidCoordinate(residentLat, residentLng) || !isValidCoordinate(truckLat, truckLng)) {
      return;
    }

    const state = getNotificationState(userId);
    
    // Calculate distance in meters
    const distanceKm = calculateDistance(residentLat, residentLng, truckLat, truckLng);
    const distanceMeters = distanceKm * 1000;

    // Check if truck is within 400m radius
    if (distanceMeters <= NOTIFICATION_RADIUS_METERS) {
      // Check if we've already notified about this truck
      if (!state.notifiedTrucks.has(truckNo)) {
        // Create proximity notification
        await databaseService.createNotification({
          userId,
          title: '🚛 Truck Nearby',
          message: `Truck ${truckNo} (${collectorName}) is within 400m of your location! Get ready for collection.`,
          type: 'info',
          read: false,
          link: '/resident/truck',
        });

        // Mark this truck as notified
        state.notifiedTrucks.add(truckNo);
        console.log(`Proximity notification created: Truck ${truckNo} is ${Math.round(distanceMeters)}m away`);
      }
    } else {
      // Truck is outside radius - remove from notified set so it can notify again if it comes back
      if (state.notifiedTrucks.has(truckNo)) {
        state.notifiedTrucks.delete(truckNo);
        console.log(`Truck ${truckNo} left the 400m radius. Will notify again if it comes back.`);
      }
    }
  } catch (error) {
    console.error('Error checking truck proximity:', error);
  }
}

/**
 * Check for report status changes and notify resident
 */
export async function checkReportStatusChanges(userId: string): Promise<void> {
  try {
    // Get all reports for this user
    const reports = await databaseService.getReportsByUserId(userId);
    const state = getNotificationState(userId);

    for (const report of reports) {
      const lastKnownStatus = state.lastReportCheck.get(report.id);
      const currentStatus = report.status;

      // If status changed, create notification
      if (lastKnownStatus && lastKnownStatus !== currentStatus) {
        let title = '';
        let message = '';
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';

        switch (currentStatus) {
          case 'reviewed':
            title = '📋 Report Under Review';
            message = `Your report about "${report.issue}" is now being reviewed by the admin.`;
            type = 'info';
            break;
          case 'resolved':
            title = '✅ Report Resolved';
            message = `Your report about "${report.issue}" has been resolved!`;
            type = 'success';
            break;
          case 'pending':
            // Only notify if it was previously reviewed/resolved and went back to pending
            if (lastKnownStatus !== 'pending') {
              title = '⏳ Report Status Updated';
              message = `Your report about "${report.issue}" status has been updated.`;
              type = 'info';
            }
            break;
        }

        if (title && message) {
          await databaseService.createNotification({
            userId,
            title,
            message,
            type,
            read: false,
            link: '/resident/reports/progress',
          });

          console.log(`Report status notification created: Report ${report.id} changed from ${lastKnownStatus} to ${currentStatus}`);
        }
      }

      // Update last known status
      state.lastReportCheck.set(report.id, currentStatus);
    }
  } catch (error) {
    console.error('Error checking report status changes:', error);
  }
}

/**
 * Initialize notification monitoring for a resident
 * This should be called when a resident logs in or opens the app
 */
export async function initializeResidentNotifications(userId: string): Promise<void> {
  try {
    // Notify about today's schedule (only once per day)
    await notifyTodaySchedule(userId);

    // Initialize report status tracking
    const reports = await databaseService.getReportsByUserId(userId);
    const state = getNotificationState(userId);
    
    // Initialize last known status for all existing reports
    for (const report of reports) {
      state.lastReportCheck.set(report.id, report.status);
    }

    console.log('Resident notifications initialized for user:', userId);
  } catch (error) {
    console.error('Error initializing resident notifications:', error);
  }
}

/**
 * Clean up notification state for a user (e.g., on logout)
 */
export function cleanupResidentNotifications(userId: string): void {
  notificationStates.delete(userId);
  // Clear localStorage entries for this user (both old boolean and new count-based)
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(`schedule_notified_${userId}_`) || key.startsWith(`schedule_notified_count_${userId}_`)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Reset truck notifications (call when truck stops collecting)
 */
export function resetTruckNotifications(userId: string, truckNo: string): void {
  const state = getNotificationState(userId);
  state.notifiedTrucks.delete(truckNo);
}

/**
 * Notify all residents when a collector starts collecting
 * This sends today's schedule notification to all residents
 */
export async function notifyAllResidentsCollectionStarted(): Promise<void> {
  try {
    // Get all resident accounts
    const residents = await databaseService.getAccountsByRole('resident');
    
    // Create schedule list
    const scheduleList = SCHEDULE_LOCATIONS.map(loc => loc.name).join(', ');
    
    // Notify each resident (up to 3 times per day per resident)
    for (const resident of residents) {
      if (!resident.id) continue;
      
      // Check if we can send another notification today (max 3)
      if (!canSendScheduleNotification(resident.id)) {
        continue;
      }
      
      // Create schedule notification with special link to open schedule panel
      await databaseService.createNotification({
        userId: resident.id,
        title: '📅 Today\'s Collection Schedule',
        message: `Collection has started! Today's schedule: ${scheduleList}. Click to view details.`,
        type: 'info',
        read: false,
        link: '/resident/truck?showSchedule=true', // Special link to trigger schedule panel
      });
      
      incrementScheduleNotificationCount(resident.id);
      console.log(`Schedule notification sent to resident: ${resident.id} (count: ${getTodayScheduleNotificationCount(resident.id)})`);
    }
    
    console.log(`Collection started notifications sent to ${residents.length} residents`);
  } catch (error) {
    console.error('Error notifying residents about collection start:', error);
  }
}

