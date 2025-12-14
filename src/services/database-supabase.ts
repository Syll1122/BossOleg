// src/services/database-supabase.ts
// Database service using Supabase (PostgreSQL)

import { supabase } from './supabase';
import { Account, UserRole, Report, TruckStatus, Notification, PushSubscription } from '../models/types';

class SupabaseDatabaseService {
  /**
   * Initialize the database (no-op for Supabase - tables are created via migrations)
   */
  async init(): Promise<void> {
    // Supabase is ready to use immediately
    // Tables should be created via Supabase Dashboard or migrations
    return Promise.resolve();
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== ACCOUNTS METHODS ==========

  /**
   * Create a new account
   */
  async createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const newAccount: Account = {
      ...account,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Set registrationStatus for collectors (pending by default, approved for others)
      registrationStatus: account.role === 'collector' 
        ? (account.registrationStatus || 'pending')
        : 'approved',
    };

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('accounts')
      .select('id')
      .eq('email', account.email)
      .single();

    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('accounts')
      .select('id')
      .eq('username', account.username)
      .single();

    if (existingUsername) {
      throw new Error('Username already exists');
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert(newAccount)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Account;
  }

  /**
   * Get account by email
   */
  async getAccountByEmail(email: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error(error.message);
    }

    return data as Account | null;
  }

  /**
   * Get account by username
   */
  async getAccountByUsername(username: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data as Account | null;
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data as Account | null;
  }

  /**
   * Authenticate user using Supabase Auth
   */
  async authenticate(identifier: string, password: string): Promise<Account | null> {
    // Try to find by email first, then by username
    let account = await this.getAccountByEmail(identifier);
    if (!account) {
      account = await this.getAccountByUsername(identifier);
    }

    if (!account) {
      return null;
    }

    // Verify password matches
    if (account.password !== password) {
      return null;
    }
    
    // Mark user as online in database
    await this.setUserOnlineStatus(account.id, true);
    
    return account;
  }

  /**
   * Get all accounts (for admin purposes)
   */
  async getAllAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Account[];
  }

  /**
   * Update account
   */
  async updateAccount(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Account not found');
    }

    return data as Account;
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Clear all accounts (for testing/reset)
   */
  async clearAllAccounts(): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .neq('id', ''); // Delete all rows

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get accounts by role
   */
  async getAccountsByRole(role: UserRole): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('role', role)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Account[];
  }

  /**
   * Get account by truck number
   */
  async getAccountByTruckNo(truckNo: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('truckNo', truckNo)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data as Account | null;
  }

  // ========== REPORTS METHODS ==========

  /**
   * Create a new report
   */
  async createReport(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Report> {
    const newReport: Report = {
      ...report,
      id: this.generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reports')
      .insert(newReport)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Report;
  }

  /**
   * Get all reports (for admin)
   */
  async getAllReports(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Report[];
  }

  /**
   * Get reports by user ID
   */
  async getReportsByUserId(userId: string): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Report[];
  }

  /**
   * Update report status (for admin)
   */
  async updateReportStatus(id: string, status: Report['status']): Promise<Report> {
    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Report not found');
    }

    return data as Report;
  }

  // ========== TRUCK STATUS METHODS ==========

  /**
   * Update or create truck status
   */
  async updateTruckStatus(
    truckId: string, 
    isFull: boolean, 
    updatedBy: string, 
    isCollecting?: boolean,
    latitude?: number | null,
    longitude?: number | null
  ): Promise<TruckStatus> {
    // Get existing status to preserve values if not provided
    const existingStatus = await this.getTruckStatus(truckId);
    
    // Don't clear GPS coordinates - preserve them even when not collecting
    // This allows trucks to reappear correctly when restarting collection
    // Only clear if explicitly set to null
    const shouldClearCoordinates = latitude === null && longitude === null;
    
    const status: TruckStatus = {
      id: truckId,
      isFull,
      isCollecting: isCollecting !== undefined ? isCollecting : (existingStatus?.isCollecting ?? false),
      // Preserve coordinates unless explicitly cleared (null) or new coordinates provided
      latitude: shouldClearCoordinates ? undefined : (latitude !== undefined ? (latitude === null ? undefined : latitude) : (existingStatus?.latitude)),
      longitude: shouldClearCoordinates ? undefined : (longitude !== undefined ? (longitude === null ? undefined : longitude) : (existingStatus?.longitude)),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    const { data, error } = await supabase
      .from('truck_status')
      .upsert(status, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as TruckStatus;
  }

  /**
   * Get truck status by truck ID
   */
  async getTruckStatus(truckId: string): Promise<TruckStatus | null> {
    const { data, error } = await supabase
      .from('truck_status')
      .select('*')
      .eq('id', truckId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    // Ensure isCollecting field exists (for backward compatibility)
    const status = data as TruckStatus;
    if (status.isCollecting === undefined) {
      status.isCollecting = false;
    }

    return status;
  }

  /**
   * Get all truck statuses
   */
  async getAllTruckStatuses(): Promise<TruckStatus[]> {
    const { data, error } = await supabase
      .from('truck_status')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TruckStatus[];
  }

  // ========== USER LOGIN STATUS METHODS ==========

  /**
   * Set user online/offline status in accounts table
   */
  async setUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const updateData: any = {
        isOnline: isOnline,
        updatedAt: new Date().toISOString(),
      };
      
      if (isOnline) {
        updateData.lastLoginAt = new Date().toISOString();
      } else {
        updateData.lastLogoutAt = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', userId);
      
      if (error) {
        console.error('Error updating user online status:', error);
        // Don't throw - allow login to continue even if status update fails
      }
    } catch (error) {
      console.error('Unexpected error updating user online status:', error);
      // Don't throw - allow login to continue
    }
  }

  /**
   * Get user online status from accounts table
   */
  async getUserOnlineStatus(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('isOnline')
        .eq('id', userId)
        .single();
      
      if (error) {
        // PGRST116 = no rows found
        if (error.code === 'PGRST116') {
          return false;
        }
        console.error('Error getting user online status:', error);
        return false;
      }
      
      return data?.isOnline || false;
    } catch (error) {
      console.error('Unexpected error getting user online status:', error);
      return false;
    }
  }

  /**
   * Get online status for multiple users at once (more efficient for batch queries)
   */
  async getUsersOnlineStatus(userIds: string[]): Promise<Map<string, boolean>> {
    const statusMap = new Map<string, boolean>();
    
    if (userIds.length === 0) {
      return statusMap;
    }
    
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, isOnline')
        .in('id', userIds);
      
      if (error) {
        console.error('Error getting users online status:', error);
        // Return all as false if error
        userIds.forEach(id => statusMap.set(id, false));
        return statusMap;
      }
      
      // Create map from results
      (data || []).forEach((account: any) => {
        statusMap.set(account.id, account.isOnline || false);
      });
      
      // Set false for any users not found
      userIds.forEach(id => {
        if (!statusMap.has(id)) {
          statusMap.set(id, false);
        }
      });
      
      return statusMap;
    } catch (error) {
      console.error('Unexpected error getting users online status:', error);
      // Return all as false on error
      userIds.forEach(id => statusMap.set(id, false));
      return statusMap;
    }
  }

  // ========== SESSION MANAGEMENT METHODS ==========

  /**
   * Check if user has an active session
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('userId', userId)
        .limit(1);

      // If there's an error
      if (error) {
        // PGRST116 = no rows found (this is expected when no session exists)
        // 42P01 = relation does not exist (table doesn't exist)
        if (error.code === 'PGRST116') {
          return false; // No session found
        }
        // If table doesn't exist, return false (allow login, but log warning)
        if (error.message && error.message.includes('does not exist')) {
          console.warn('user_sessions table does not exist yet. Please run the SQL migration in supabase-schema.sql');
          return false; // Allow login if table doesn't exist
        }
        // For other errors, log and return false to be safe
        console.error('Error checking session:', error.message, error.code);
        return false;
      }

      // If we have data, user has an active session
      const hasSession = data && data.length > 0;
      console.log('hasActiveSession check:', { userId, hasSession, dataLength: data?.length });
      return hasSession;
    } catch (err: any) {
      // Catch any unexpected errors and return false
      console.error('Unexpected error checking session:', err);
      return false;
    }
  }

  /**
   * Create a new session for a user
   * This will also delete any existing sessions for the user (single session enforcement)
   */
  async createSession(userId: string, sessionToken: string): Promise<void> {
    // First, delete any existing sessions for this user (enforce single session)
    await this.deleteUserSessions(userId);

    // Create new session
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        id: this.generateId(),
        userId: userId,
        sessionToken: sessionToken,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Delete a session by session token
   */
  async deleteSession(sessionToken: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('sessionToken', sessionToken);

    if (error) {
      throw new Error(error.message);
    }

    // Also clear from localStorage
    localStorage.removeItem('watch_session_token');
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('userId', userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Update session last activity time
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({ lastActivity: new Date().toISOString() })
      .eq('sessionToken', sessionToken);

    if (error) {
      // If session doesn't exist, it's okay - might have been cleared
      if (error.code !== 'PGRST116') {
        throw new Error(error.message);
      }
    }
  }

  /**
   * Get session by token
   */
  async getSessionByToken(sessionToken: string): Promise<{ userId: string } | null> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('userId')
      .eq('sessionToken', sessionToken)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data ? { userId: data.userId } : null;
  }

  // ========== BARANGAYS METHODS ==========

  /**
   * Fallback list of common Quezon City barangays (if table doesn't exist)
   */
  private getDefaultBarangays(): Array<{ id: string; name: string; code?: string }> {
    return [
      { id: 'bg001', name: 'Bagong Silangan' },
      { id: 'bg002', name: 'Bagong Pag-asa' },
      { id: 'bg003', name: 'Bago Bantay' },
      { id: 'bg033', name: 'Holy Spirit' },
      { id: 'bg030', name: 'Fairview' },
      { id: 'bg031', name: 'Greater Lagro' },
      { id: 'bg057', name: 'North Fairview' },
      { id: 'bg058', name: 'Novaliches Proper' },
      { id: 'bg013', name: 'Commonwealth' },
      { id: 'bg024', name: 'E. Rodriguez' },
      { id: 'bg079', name: 'Sacred Heart' },
      { id: 'bg084', name: 'San Isidro' },
      { id: 'bg086', name: 'San Jose' },
      { id: 'bg091', name: 'Santa Monica' },
      { id: 'bg107', name: 'Tandang Sora' },
      { id: 'bg096', name: 'Santol' },
      { id: 'bg054', name: 'Nagkaisang Nayon' },
      { id: 'bg048', name: 'Malaya' },
      { id: 'bg070', name: 'Payatas' },
      { id: 'bg068', name: 'Pasong Putik Proper' },
    ];
  }

  /**
   * Get all barangays (for dropdowns/selects)
   */
  async getAllBarangays(): Promise<Array<{ id: string; name: string; code?: string }>> {
    try {
      const { data, error } = await supabase
        .from('barangays')
        .select('id, name, code')
        .order('name', { ascending: true });

      if (error) {
        // If table doesn't exist, return fallback list
        if (error.message && error.message.includes('does not exist')) {
          console.warn('barangays table does not exist. Using fallback list. Please run the migration SQL.');
          return this.getDefaultBarangays();
        }
        throw new Error(error.message);
      }

      // If table exists but is empty, return fallback list
      if (!data || data.length === 0) {
        console.warn('barangays table is empty. Using fallback list. Please run the migration SQL to populate it.');
        return this.getDefaultBarangays();
      }

      return data as Array<{ id: string; name: string; code?: string }>;
    } catch (error: any) {
      console.error('Error fetching barangays:', error);
      // Return fallback list on error
      return this.getDefaultBarangays();
    }
  }

  /**
   * Search barangays by name
   */
  async searchBarangays(searchTerm: string): Promise<Array<{ id: string; name: string; code?: string }>> {
    try {
      const { data, error } = await supabase
        .from('barangays')
        .select('id, name, code')
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) {
        // If table doesn't exist, search in fallback list
        if (error.message && error.message.includes('does not exist')) {
          const fallback = this.getDefaultBarangays();
          const searchLower = searchTerm.toLowerCase();
          return fallback.filter(b => b.name.toLowerCase().includes(searchLower));
        }
        throw new Error(error.message);
      }

      // If no results from database but table exists, search fallback as backup
      if (!data || data.length === 0) {
        const fallback = this.getDefaultBarangays();
        const searchLower = searchTerm.toLowerCase();
        return fallback.filter(b => b.name.toLowerCase().includes(searchLower));
      }

      return data as Array<{ id: string; name: string; code?: string }>;
    } catch (error: any) {
      console.error('Error searching barangays:', error);
      // Fallback to searching default list
      const fallback = this.getDefaultBarangays();
      const searchLower = searchTerm.toLowerCase();
      return fallback.filter(b => b.name.toLowerCase().includes(searchLower));
    }
  }

  // ========== NOTIFICATIONS METHODS ==========

  /**
   * Create a new notification
   */
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(newNotification)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Notification;
  }

  /**
   * Get all notifications for a user
   */
  async getNotificationsByUserId(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Notification[];
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('userId', userId)
      .eq('read', false);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('read', false);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }

  // ========== PUSH SUBSCRIPTIONS METHODS ==========

  /**
   * Save push subscription
   */
  async savePushSubscription(subscription: Omit<PushSubscription, 'id' | 'createdAt'>): Promise<PushSubscription> {
    const newSubscription: PushSubscription = {
      ...subscription,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    // Check if subscription already exists for this endpoint
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { data, error } = await supabase
        .from('push_subscriptions')
        .update({
          userId: subscription.userId,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        })
        .eq('endpoint', subscription.endpoint)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as PushSubscription;
    }

    // Create new subscription
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert(newSubscription)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as PushSubscription;
  }

  /**
   * Get push subscriptions for a user
   */
  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('userId', userId);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as PushSubscription[];
  }

  /**
   * Delete push subscription
   */
  async deletePushSubscription(endpoint: string): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      throw new Error(error.message);
    }
  }

  // ========== COLLECTION SCHEDULES METHODS ==========

  /**
   * Get collection schedules for a specific collector
   */
  async getSchedulesByCollectorId(collectorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('collection_schedules')
      .select('*')
      .eq('collector_id', collectorId);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get collection schedules for today's day of week
   */
  async getTodaySchedulesByCollectorId(collectorId: string): Promise<any[]> {
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDayName = dayNames[today.getDay()];

    const { data, error } = await supabase
      .from('collection_schedules')
      .select('*')
      .eq('collector_id', collectorId)
      .contains('days', [todayDayName]);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get collection schedules by barangay name and day
   */
  async getSchedulesByBarangayAndDay(barangayName: string, dayAbbr: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('collection_schedules')
      .select('*')
      .contains('days', [dayAbbr]);

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return [];

    // Filter by barangay name (can be in array or string)
    return data.filter(schedule => {
      const scheduleBarangayNames = Array.isArray(schedule.barangay_name) 
        ? schedule.barangay_name 
        : schedule.barangay_name ? [schedule.barangay_name] : [];
      
      return scheduleBarangayNames.some((name: string) => 
        name && name.toLowerCase().includes(barangayName.toLowerCase()) ||
        barangayName.toLowerCase().includes(name?.toLowerCase() || '')
      );
    });
  }

  /**
   * Get all collection schedules by barangay (for all days)
   */
  async getSchedulesByBarangay(barangayName: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('collection_schedules')
      .select('*');

    if (error) {
      console.error('Error fetching schedules:', error);
      throw new Error(error.message);
    }

    if (!data) {
      console.log('No schedules found in database');
      return [];
    }

    console.log(`Filtering ${data.length} schedules for barangay: ${barangayName}`);

    // Filter by barangay name (can be in array or string)
    const filtered = data.filter(schedule => {
      const scheduleBarangayNames = Array.isArray(schedule.barangay_name) 
        ? schedule.barangay_name 
        : schedule.barangay_name ? [schedule.barangay_name] : [];
      
      // Normalize both names for comparison
      const normalizedResidentBarangay = barangayName.toLowerCase().trim();
      
      const matches = scheduleBarangayNames.some((name: string) => {
        if (!name) return false;
        const normalizedScheduleBarangay = name.toLowerCase().trim();
        
        // Check for exact match or substring match
        return normalizedScheduleBarangay === normalizedResidentBarangay ||
               normalizedScheduleBarangay.includes(normalizedResidentBarangay) ||
               normalizedResidentBarangay.includes(normalizedScheduleBarangay);
      });
      
      if (matches) {
        console.log(`Match found: schedule barangay(s): ${scheduleBarangayNames.join(', ')}, resident barangay: ${barangayName}`);
      }
      
      return matches;
    });

    console.log(`Found ${filtered.length} matching schedules`);
    return filtered;
  }

  /**
   * Remove a location from a collection schedule by removing the item at the specified index
   * from street_name, barangay_name, latitude, and longitude arrays
   */
}

// Export singleton instance
export const databaseService = new SupabaseDatabaseService();

// Initialize (no-op for Supabase, but kept for API compatibility)
databaseService.init().catch((error) => {
  console.error('Failed to initialize database:', error);
});



