// src/services/database-supabase.ts
// Database service using Supabase (PostgreSQL)

import { supabase } from './supabase';
import { Account, UserRole, Report, TruckStatus } from '../models/types';

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
   * Authenticate user (check username/email and password)
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

    // In production, use proper password hashing (bcrypt, etc.)
    if (account.password === password) {
      return account;
    }

    return null;
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
    latitude?: number,
    longitude?: number
  ): Promise<TruckStatus> {
    // Get existing status to preserve values if not provided
    const existingStatus = await this.getTruckStatus(truckId);
    
    const status: TruckStatus = {
      id: truckId,
      isFull,
      isCollecting: isCollecting !== undefined ? isCollecting : (existingStatus?.isCollecting ?? false),
      latitude: latitude !== undefined ? latitude : (existingStatus?.latitude),
      longitude: longitude !== undefined ? longitude : (existingStatus?.longitude),
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
}

// Export singleton instance
export const databaseService = new SupabaseDatabaseService();

// Initialize (no-op for Supabase, but kept for API compatibility)
databaseService.init().catch((error) => {
  console.error('Failed to initialize database:', error);
});

