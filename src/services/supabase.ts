// src/services/supabase.ts
// Supabase client configuration

import { createClient } from '@supabase/supabase-js';

// ⚠️ Replace these with your actual Supabase credentials
// You can find these in your Supabase Dashboard → Project Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn(
    '⚠️ Supabase credentials not configured!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file\n' +
    'or update the values in src/services/supabase.ts'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

