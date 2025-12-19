import { supabase } from '../lib/supabase';
import { Account, Report, TruckStatus, Notification } from '../types';

// Accounts
export async function getAllAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []) as Account[];
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
  const newAccount: Account = {
    ...account,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    registrationStatus: account.role === 'collector' 
      ? ((account as any).registrationStatus || 'approved')
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

export async function deleteAccount(id: string, adminId?: string, adminName?: string): Promise<void> {
  // Get account info before deleting (to record in history if collector)
  const { data: accountData, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error('Account not found');
  }

  const account = accountData as Account;

  // If it was a collector, record deletion in history BEFORE deleting
  if (account && account.role === 'collector' && adminId) {
    try {
      console.log('Attempting to create deletion history for:', account.email, account.id);
      await createRegistrationHistory(
        id,
        'deleted',
        adminId,
        'Account deleted by admin',
        account // Pass the account data we already have
      );
      console.log('✅ Deletion recorded in history for collector:', account.email);
    } catch (historyError: any) {
      // Log error but continue with deletion
      console.error('❌ Failed to record deletion in history:', historyError);
      console.error('Error message:', historyError?.message);
      console.error('Error code:', historyError?.code);
      // Don't throw - allow deletion to continue even if history fails
      alert('Account deleted but failed to record in history. Check console for details.');
    }
  }

  // Delete the account
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Reports
export async function getAllReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []) as Report[];
}

export async function updateReportStatus(id: string, status: Report['status']): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .update({ status, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Report;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Truck Status
export async function getAllTruckStatuses(): Promise<TruckStatus[]> {
  const { data, error } = await supabase
    .from('truck_status')
    .select('*')
    .order('updatedAt', { ascending: false });

  if (error) throw error;
  return (data || []) as TruckStatus[];
}

export async function updateTruckStatus(id: string, updates: Partial<TruckStatus>): Promise<TruckStatus> {
  const { data, error } = await supabase
    .from('truck_status')
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TruckStatus;
}

// Notifications
export async function getAllNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []) as Notification[];
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Statistics
export interface DashboardStats {
  totalUsers: number;
  totalResidents: number;
  totalCollectors: number;
  totalAdmins: number;
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  activeTrucks: number;
  totalTrucks: number;
  pendingRegistrations: number;
  missedCollectionReports: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [accounts, reports, trucks] = await Promise.all([
    getAllAccounts(),
    getAllReports(),
    getAllTruckStatuses(),
  ]);

  const pendingRegistrations = accounts.filter(
    a => a.role === 'collector' && (a as any).registrationStatus === 'pending'
  ).length;

  return {
    totalUsers: accounts.length,
    totalResidents: accounts.filter(a => a.role === 'resident').length,
    totalCollectors: accounts.filter(a => a.role === 'collector').length,
    totalAdmins: accounts.filter(a => a.role === 'admin').length,
    totalReports: reports.length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    resolvedReports: reports.filter(r => r.status === 'resolved').length,
    activeTrucks: trucks.filter(t => t.isCollecting).length,
    totalTrucks: trucks.length,
    pendingRegistrations,
    missedCollectionReports: reports.filter(r => r.issue.toLowerCase().includes('missed collection')).length,
  };
}

// Registration Approval
export async function getPendingRegistrations(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('role', 'collector')
    .eq('registrationStatus', 'pending')
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []) as Account[];
}

export interface RegistrationHistory {
  id: string;
  collectorId: string;
  collectorName: string;
  collectorEmail: string;
  truckNo?: string;
  status: 'approved' | 'rejected' | 'deleted';
  reviewedBy: string | null;
  reviewedByName: string;
  reviewedAt: string;
  notes?: string;
}

export async function createRegistrationHistory(
  collectorId: string,
  status: 'approved' | 'rejected' | 'deleted',
  reviewedBy: string,
  notes?: string,
  collectorData?: Account
): Promise<void> {
  // Get collector info if not provided
  let collector = collectorData;
  if (!collector) {
    try {
      const accounts = await getAllAccounts();
      collector = accounts.find(a => a.id === collectorId);
    } catch (error) {
      console.error('Error fetching collector for history:', error);
      throw new Error('Could not fetch collector information');
    }
  }
  
  if (!collector) {
    console.error('Collector not found for history:', collectorId);
    throw new Error('Collector not found');
  }

  // Get reviewer info
  let reviewer: Account | undefined;
  try {
    const accounts = await getAllAccounts();
    reviewer = accounts.find(a => a.id === reviewedBy);
  } catch (error) {
    console.warn('Could not fetch reviewer info:', error);
  }

  const history: RegistrationHistory = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    collectorId,
    collectorName: collector.name,
    collectorEmail: collector.email,
    truckNo: collector.truckNo || null,
    status,
    reviewedBy: reviewedBy || null,
    reviewedByName: reviewer?.name || 'Admin',
    reviewedAt: new Date().toISOString(),
    notes: notes || null,
  };

  console.log('Creating history entry:', history);

  // Insert into registration_history table
  const { error } = await supabase
    .from('registration_history')
    .insert(history);

  if (error) {
    console.error('Failed to create registration history:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error; // Throw so caller knows it failed
  }
  
  console.log('History entry created successfully');
}

export async function approveRegistration(
  collectorId: string,
  adminId: string,
  adminName: string
): Promise<Account> {
  // Update account status
  const updatedAccount = await updateAccount(collectorId, {
    registrationStatus: 'approved',
  });

  // Create history entry
  try {
    await createRegistrationHistory(collectorId, 'approved', adminId, undefined, updatedAccount);
  } catch (error) {
    console.warn('Failed to create history entry:', error);
  }

  return updatedAccount;
}

export async function rejectRegistration(
  collectorId: string,
  adminId: string,
  adminName: string,
  notes?: string
): Promise<Account> {
  // Update account status
  const updatedAccount = await updateAccount(collectorId, {
    registrationStatus: 'rejected',
  });

  // Create history entry
  try {
    await createRegistrationHistory(collectorId, 'rejected', adminId, notes);
  } catch (error) {
    console.warn('Failed to create history entry:', error);
  }

  return updatedAccount;
}

export async function getRegistrationHistory(): Promise<RegistrationHistory[]> {
  // Get history from registration_history table
  let historyEntries: RegistrationHistory[] = [];
  
  const { data, error } = await supabase
    .from('registration_history')
    .select('*')
    .in('status', ['approved', 'rejected', 'deleted'])
    .order('reviewedAt', { ascending: false });

  if (error) {
    // If table doesn't exist, we'll continue and get from accounts
    if (error.code !== '42P01') {
      console.warn('Error loading registration history:', error);
    }
  } else if (data) {
    historyEntries = data as RegistrationHistory[];
  }

  // Also get approved/rejected collectors from accounts table
  // This catches accounts that were approved/rejected before history system was added
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('role', 'collector')
    .in('registrationStatus', ['approved', 'rejected'])
    .order('updatedAt', { ascending: false });

  if (accountsError) {
    console.warn('Error loading accounts for history:', accountsError);
    return historyEntries;
  }

  // Create history entries for accounts that don't have history entries
  const collectorIdsWithHistory = new Set(historyEntries.map(h => h.collectorId));
  
  const accountsWithoutHistory = (accounts || []).filter(
    account => !collectorIdsWithHistory.has(account.id)
  );

  // Convert accounts to history format
  const accountHistoryEntries: RegistrationHistory[] = accountsWithoutHistory.map(account => ({
    id: `account-${account.id}`,
    collectorId: account.id,
    collectorName: account.name,
    collectorEmail: account.email,
    truckNo: account.truckNo,
    status: (account as any).registrationStatus === 'approved' ? 'approved' : 'rejected',
    reviewedBy: '',
    reviewedByName: 'System',
    reviewedAt: account.updatedAt || account.createdAt,
    notes: 'Approved/rejected before history tracking was implemented',
  }));

  // Get truck numbers for history entries that don't have them
  const historyWithTrucks = await Promise.all(
    historyEntries.map(async (entry) => {
      if (entry.truckNo) return entry;
      
      // Look up truck number from account
      const account = (accounts || []).find(a => a.id === entry.collectorId);
      return {
        ...entry,
        truckNo: account?.truckNo || '-',
      };
    })
  );

  // Combine and sort by date
  const allHistory = [...historyWithTrucks, ...accountHistoryEntries].sort(
    (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()
  );

  return allHistory;
}
