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
          // Verify session is still valid in database
          const sessionToken = localStorage.getItem('watch_session_token');
          
          if (sessionToken) {
            try {
              // Check if session exists in database
              const session = await databaseService.getSessionByToken(sessionToken);
              
              if (session && session.userId === storedUserId) {
                // Session is valid, set user
                setUser({ 
                  id: storedUserId, 
                  name: storedName, 
                  role: storedRole 
                });
              } else {
                // Session invalid or doesn't match user, clear everything
                localStorage.removeItem('watch_user_id');
                localStorage.removeItem('watch_user_role');
                localStorage.removeItem('watch_user_name');
                localStorage.removeItem('watch_user_email');
                localStorage.removeItem('watch_user_username');
                localStorage.removeItem('watch_session_token');
                setUser(null);
              }
            } catch (error) {
              // If session check fails, clear session for security
              console.error('Error validating session:', error);
              localStorage.removeItem('watch_user_id');
              localStorage.removeItem('watch_user_role');
              localStorage.removeItem('watch_user_name');
              localStorage.removeItem('watch_user_email');
              localStorage.removeItem('watch_user_username');
              localStorage.removeItem('watch_session_token');
              setUser(null);
            }
          } else {
            // No session token, clear user data
            localStorage.removeItem('watch_user_id');
            localStorage.removeItem('watch_user_role');
            localStorage.removeItem('watch_user_name');
            localStorage.removeItem('watch_user_email');
            localStorage.removeItem('watch_user_username');
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