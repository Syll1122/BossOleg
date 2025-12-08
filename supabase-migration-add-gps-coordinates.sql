-- Migration: Add GPS coordinates to truck_status table
-- Run this in Supabase Dashboard → SQL Editor

-- Add latitude and longitude columns if they don't exist
ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ==========================================
-- DONE!
-- ==========================================
-- After running this, verify in Table Editor that truck_status table has latitude and longitude columns


