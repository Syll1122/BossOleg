// src/utils/auth.ts
// Authentication utility functions

/**
 * Logout the current user
 * Clears all stored user data from localStorage
 */
export const logout = (): void => {
  localStorage.removeItem('watch_user_id');
  localStorage.removeItem('watch_user_role');
  localStorage.removeItem('watch_user_name');
  localStorage.removeItem('watch_user_email');
  localStorage.removeItem('watch_user_username');
  
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


