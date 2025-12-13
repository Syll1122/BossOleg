import { supabase } from '../lib/supabase';
import { Account } from '../types';

export async function authenticateAdmin(identifier: string, password: string): Promise<Account | null> {
  // Try to find by email first, then by username
  let account: Account | null = null;

  // Try email
  const { data: emailData } = await supabase
    .from('accounts')
    .select('*')
    .eq('email', identifier)
    .eq('role', 'admin')
    .single();

  if (emailData) {
    account = emailData as Account;
  } else {
    // Try username
    const { data: usernameData } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', identifier)
      .eq('role', 'admin')
      .single();

    if (usernameData) {
      account = usernameData as Account;
    }
  }

  if (!account) {
    return null;
  }

  // Verify password (in production, use proper hashing)
  if (account.password !== password) {
    return null;
  }

  return account;
}

export function saveAdminSession(account: Account): void {
  localStorage.setItem('admin_session', JSON.stringify({
    account,
    timestamp: Date.now(),
  }));
}

export function getAdminSession(): Account | null {
  const session = localStorage.getItem('admin_session');
  if (!session) return null;

  try {
    const parsed = JSON.parse(session);
    // Session expires after 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      clearAdminSession();
      return null;
    }
    return parsed.account;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem('admin_session');
}




