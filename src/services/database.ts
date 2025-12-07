// src/services/database.ts
// Re-export from Supabase implementation
// To switch back to IndexedDB, change this import to './database-indexeddb'

// Temporarily using IndexedDB until Supabase package is properly installed
// After installing: npm install @supabase/supabase-js
// Then change to: export { databaseService } from './database-supabase';
export { databaseService } from './database-indexeddb';


