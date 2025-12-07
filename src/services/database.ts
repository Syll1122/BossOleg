// src/services/database.ts
// Re-export from Supabase implementation
// To switch back to IndexedDB, change this import to './database-indexeddb'

// Using IndexedDB until Supabase package is installed
// Once installed, change to: export { databaseService } from './database-supabase';
export { databaseService } from './database-indexeddb';


