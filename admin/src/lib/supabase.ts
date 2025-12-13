import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ddyudqmtqtusnhycomcw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeXVkcW10cXR1c25oeWNvbWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODY0MzQsImV4cCI6MjA4MDY2MjQzNH0.0I-Exw6_H_gLbsxS8EdTZDiwmRqiKORKlock-GhNQhg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



