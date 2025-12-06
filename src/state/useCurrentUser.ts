// src/state/useCurrentUser.ts

import { useEffect, useState } from 'react';
import { User } from '../models/types';
import { databaseService } from '../services/database';

interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Initialize database
        await databaseService.init();

        // Check localStorage for user ID (set by login)
        const storedUserId = localStorage.getItem('watch_user_id');
        const storedRole = localStorage.getItem('watch_user_role') as User['role'] | null;
        const storedName = localStorage.getItem('watch_user_name') || 'User';
        
        if (storedUserId && storedRole) {
          // Try to get account from database to ensure it still exists
          try {
            // For now, use localStorage data (can be enhanced to fetch from DB)
            setUser({ 
              id: storedUserId, 
              name: storedName, 
              role: storedRole 
            });
          } catch (error) {
            // If account not found in DB, clear session
            localStorage.removeItem('watch_user_id');
            localStorage.removeItem('watch_user_role');
            localStorage.removeItem('watch_user_name');
            localStorage.removeItem('watch_user_email');
            setUser(null);
          }
        } else {
          // No user logged in
          setUser(null);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  return { user, loading };
}

export default useCurrentUser;