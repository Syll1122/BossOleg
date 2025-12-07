-- Migration: Add isCollecting column to truck_status table
-- Run this in Supabase Dashboard → SQL Editor

-- Add isCollecting column if it doesn't exist
ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS "isCollecting" BOOLEAN NOT NULL DEFAULT FALSE;

-- ==========================================
-- DONE!
-- ==========================================
-- After running this, verify in Table Editor that truck_status table has isCollecting column
