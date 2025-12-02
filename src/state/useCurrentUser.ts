// src/state/useCurrentUser.ts

import { useEffect, useState } from 'react';
import { User } from '../models/types';

interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for user role (set by login)
    const storedRole = localStorage.getItem('watch_user_role') as User['role'] | null;
    const storedName = localStorage.getItem('watch_user_name') || 'User';
    
    // Simulate loading current user (from storage/API)
    const timeout = setTimeout(() => {
      if (storedRole) {
        setUser({ id: 'u1', name: storedName, role: storedRole });
      } else {
        // Default to resident if no role stored
        setUser({ id: 'u1', name: 'Guest User', role: 'resident' });
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  return { user, loading };
}

export default useCurrentUser;