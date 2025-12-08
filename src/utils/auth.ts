// src/utils/auth.ts
// Authentication utility functions

import { databaseService } from '../services/database';

/**
 * Logout the current user
 * Clears all stored user data from localStorage and Supabase session
 */
export const logout = async (): Promise<void> => {
  // Get user ID and session token before clearing localStorage
  const userId = localStorage.getItem('watch_user_id');
  const sessionToken = localStorage.getItem('watch_session_token');
  
  // Mark user as offline in database
  if (userId) {
    try {
      await databaseService.setUserOnlineStatus(userId, false);
    } catch (error) {
      console.error('Error updating user offline status:', error);
      // Continue with logout even if status update fails
    }
  }
  
  // Clear session from database if token exists
  if (sessionToken) {
    try {
      await databaseService.deleteSession(sessionToken);
    } catch (error) {
      console.error('Error deleting session:', error);
      // Continue with logout even if session deletion fails
    }
  }

  // Clear all stored user data from localStorage
  localStorage.removeItem('watch_user_id');
  localStorage.removeItem('watch_user_role');
  localStorage.removeItem('watch_user_name');
  localStorage.removeItem('watch_user_email');
  localStorage.removeItem('watch_user_username');
  localStorage.removeItem('watch_session_token');
  
  // Sign out from Supabase Auth
  try {
    const { supabase } = await import('../services/supabase');
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out from Supabase:', error);
  }
  
  // Reload to reset app state
  window.location.href = '/login';
};

/**
 * Check if user is logged in
 */
export const isLoggedIn = (): boolean => {
  return !!localStorage.getItem('watch_user_id');
};

/**
 * Get current user ID from storage
 */
export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('watch_user_id');
};


