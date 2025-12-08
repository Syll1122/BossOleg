// src/services/residentNotificationService.ts
// Service for managing resident notifications (schedule, truck proximity, report progress)

import { databaseService } from './database-supabase';
import { getCurrentUserId } from '../utils/auth';
import { calculateDistance, isValidCoordinate } from '../utils/coordinates';

// Schedule locations (matching collector schedule)
const SCHEDULE_LOCATIONS = [
  { name: 'Don Pedro, HOLY SPIRIT', lat: 14.682042, lng: 121.076975 },
  { name: 'Don Primitivo, HOLY SPIRIT', lat: 14.680823, lng: 121.076206 },
  { name: 'Don Elpidio, HOLY SPIRIT', lat: 14.679855, lng: 121.077793 },
];

const NOTIFICATION_RADIUS_METERS = 400; // 400 meters radius

interface NotificationState {
  scheduleNotifiedToday: boolean;
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
      scheduleNotifiedToday: false,
      lastReportCheck: new Map(),
      notifiedTrucks: new Set(),
    });
  }
  return notificationStates.get(userId)!;
}

/**
 * Check if we've already notified about today's schedule
 */
function isTodayScheduleNotified(userId: string): boolean {
  const state = getNotificationState(userId);
  const today = new Date().toDateString();
  const lastNotified = localStorage.getItem(`schedule_notified_${userId}_${today}`);
  return lastNotified === 'true' || state.scheduleNotifiedToday;
}

/**
 * Mark today's schedule as notified
 */
function markScheduleNotifiedToday(userId: string): void {
  const state = getNotificationState(userId);
  state.scheduleNotifiedToday = true;
  const today = new Date().toDateString();
  localStorage.setItem(`schedule_notified_${userId}_${today}`, 'true');
}

/**
 * Notify resident about today's collection schedule
 */
export async function notifyTodaySchedule(userId: string): Promise<void> {
  try {
    // Check if already notified today
    if (isTodayScheduleNotified(userId)) {
      return;
    }

    // Get user's account to check barangay
    const account = await databaseService.getAccountById(userId);
    if (!account || account.role !== 'resident') {
      return;
    }

    // Create schedule notification
    const scheduleList = SCHEDULE_LOCATIONS.map(loc => loc.name).join(', ');
    
    await databaseService.createNotification({
      userId,
      title: '📅 Today\'s Collection Schedule',
      message: `Collection schedule for today: ${scheduleList}. Trucks will be in these areas.`,
      type: 'info',
      read: false,
      link: '/resident/truck',
    });

    markScheduleNotifiedToday(userId);
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
  // Clear localStorage entries for this user
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(`schedule_notified_${userId}_`)) {
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

