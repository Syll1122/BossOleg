// src/contexts/NotificationContext.tsx
// Context for managing notifications

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Notification } from '../models/types';
import { databaseService } from '../services/database-supabase';
import { getCurrentUserId } from '../utils/auth';
import { subscribeToPushNotifications, isSubscribedToPushNotifications } from '../services/pushNotificationService';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  isPushEnabled: boolean;
  enablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
        return;
      }

      await databaseService.init();
      const userNotifications = await databaseService.getNotificationsByUserId(userId);
      const unread = await databaseService.getUnreadNotificationCount(userId);
      
      setNotifications(userNotifications);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkPushStatus = useCallback(async () => {
    try {
      const enabled = await isSubscribedToPushNotifications();
      setIsPushEnabled(enabled);
    } catch (error) {
      console.error('Error checking push status:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    checkPushStatus();

    // Refresh notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications, checkPushStatus]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await databaseService.markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;

      await databaseService.markAllNotificationsAsRead(userId);
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [loadNotifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await databaseService.deleteNotification(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [loadNotifications]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const enablePush = useCallback(async () => {
    try {
      await subscribeToPushNotifications();
      await checkPushStatus();
    } catch (error) {
      console.error('Error enabling push notifications:', error);
    }
  }, [checkPushStatus]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications,
        isPushEnabled,
        enablePush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

