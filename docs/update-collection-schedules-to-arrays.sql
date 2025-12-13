-- Migration: Update collection_schedules table to support arrays for latitude, longitude, barangay_name, and street_name
-- This allows storing multiple flag drops in a single row instead of multiple rows

-- Step 1: Make barangay_id nullable temporarily (if needed) or ensure it's properly set
-- First, check if barangay_id is NOT NULL and if we need to handle empty values
-- If you have existing data with empty barangay_id, you may want to:
-- 1. Update existing records to have valid barangay_id
-- 2. Or make barangay_id nullable: ALTER TABLE collection_schedules ALTER COLUMN barangay_id DROP NOT NULL;

-- Step 2: Drop existing columns (if you have existing data, you may need to back it up first)
ALTER TABLE collection_schedules DROP COLUMN IF EXISTS latitude;
ALTER TABLE collection_schedules DROP COLUMN IF EXISTS longitude;
ALTER TABLE collection_schedules DROP COLUMN IF EXISTS barangay_name;
ALTER TABLE collection_schedules DROP COLUMN IF EXISTS street_name;

-- Step 3: Add new array columns
ALTER TABLE collection_schedules ADD COLUMN latitude DECIMAL(10, 8)[];
ALTER TABLE collection_schedules ADD COLUMN longitude DECIMAL(11, 8)[];
ALTER TABLE collection_schedules ADD COLUMN barangay_name TEXT[];
ALTER TABLE collection_schedules ADD COLUMN street_name TEXT[];

-- Step 4: Ensure barangay_id foreign key allows empty string or make it nullable
-- If your foreign key constraint requires a valid barangay_id, make sure to always provide one
-- Option 1: Make barangay_id nullable (uncomment if needed)
-- ALTER TABLE collection_schedules ALTER COLUMN barangay_id DROP NOT NULL;

-- Option 2: Keep NOT NULL but ensure code always provides valid barangay_id (recommended)
-- The application code should validate barangay_id before inserting

-- Optional: Add comments for documentation
COMMENT ON COLUMN collection_schedules.latitude IS 'Array of latitude coordinates for multiple flag drops';
COMMENT ON COLUMN collection_schedules.longitude IS 'Array of longitude coordinates for multiple flag drops';
COMMENT ON COLUMN collection_schedules.barangay_name IS 'Array of barangay names corresponding to each flag drop location';
COMMENT ON COLUMN collection_schedules.street_name IS 'Array of street names corresponding to each flag drop location';

