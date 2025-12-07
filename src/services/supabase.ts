// src/services/supabase.ts
// Supabase client configuration

import { createClient } from '@supabase/supabase-js';

// ⚠️ Replace these with your actual Supabase credentials
// You can find these in your Supabase Dashboard → Project Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ddyudqmtqtusnhycomcw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeXVkcW10cXR1c25oeWNvbWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODY0MzQsImV4cCI6MjA4MDY2MjQzNH0.0I-Exw6_H_gLbsxS8EdTZDiwmRqiKORKlock-GhNQhg';

if (SUPABASE_URL === 'https://ddyudqmtqtusnhycomcw.supabase.co' || SUPABASE_ANON_KEY === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeXVkcW10cXR1c25oeWNvbWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODY0MzQsImV4cCI6MjA4MDY2MjQzNH0.0I-Exw6_H_gLbsxS8EdTZDiwmRqiKORKlock-GhNQhg') {
  console.warn(
    '⚠️ Supabase credentials not configured!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file\n' +
    'or update the values in src/services/supabase.ts'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

