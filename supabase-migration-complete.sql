-- Complete Migration: Add missing columns to truck_status table
-- Run this ONCE in Supabase Dashboard → SQL Editor

-- ==========================================
-- Add isCollecting column (if not exists)
-- ==========================================
ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS "isCollecting" BOOLEAN NOT NULL DEFAULT FALSE;

-- ==========================================
-- Add GPS coordinates columns (if not exists)
-- ==========================================
ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. Go to Supabase Dashboard → Table Editor → truck_status
-- 2. Verify the table now has these columns:
--    - isCollecting (BOOLEAN)
--    - latitude (DOUBLE PRECISION)
--    - longitude (DOUBLE PRECISION)
--
-- Your app will now:
-- ✅ Show trucks on resident map when collector starts collecting
-- ✅ Use real GPS coordinates from collector's device
-- ✅ Update truck positions in real-time
