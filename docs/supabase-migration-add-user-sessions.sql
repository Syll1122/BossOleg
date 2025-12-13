-- Migration: Add user_sessions table for session management
-- Run this in Supabase Dashboard → SQL Editor
-- This fixes the error: "Could not find the table 'public.user_sessions' in the schema cache"

-- ==========================================
-- TABLE: user_sessions
-- Tracks active user sessions to prevent concurrent logins
-- ==========================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastActivity" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_userid ON user_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_user_sessions_lastactivity ON user_sessions("lastActivity");

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all access to user_sessions (for now)
CREATE POLICY "Allow all access to user_sessions" ON user_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. The error should be fixed
-- 2. Go to Supabase Dashboard → Table Editor → user_sessions
-- 3. Verify the table was created successfully
--
-- The table will:
-- ✅ Track active user sessions
-- ✅ Prevent concurrent logins from different devices
-- ✅ Support session validation during login


