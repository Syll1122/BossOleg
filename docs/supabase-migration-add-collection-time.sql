-- Migration: Add collection_time column to collection_schedules table
-- This allows storing the scheduled collection time for each route
-- Run this in your Supabase Dashboard → SQL Editor

-- Step 1: Check if column exists and add it if it doesn't
DO $$ 
BEGIN
  -- Check if collection_time column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'collection_schedules' 
    AND column_name = 'collection_time'
  ) THEN
    -- Add the collection_time column
    ALTER TABLE collection_schedules 
    ADD COLUMN collection_time TEXT DEFAULT '08:00';
    
    -- Add comment for documentation
    COMMENT ON COLUMN collection_schedules.collection_time IS 'Collection start time in HH:MM format (24-hour format, e.g., 08:00, 14:30)';
    
    RAISE NOTICE 'Column collection_time added successfully';
  ELSE
    RAISE NOTICE 'Column collection_time already exists';
  END IF;
END $$;

-- Step 2: Update existing records that have NULL collection_time
-- Set default time for any existing schedules without a time
UPDATE collection_schedules 
SET collection_time = '08:00' 
WHERE collection_time IS NULL OR collection_time = '';

-- Step 3: Optional - Add a check constraint to validate time format
-- This ensures the time is in HH:MM format (24-hour)
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'collection_schedules_collection_time_format_check'
  ) THEN
    ALTER TABLE collection_schedules
    ADD CONSTRAINT collection_schedules_collection_time_format_check
    CHECK (
      collection_time IS NULL OR 
      collection_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
    );
    
    RAISE NOTICE 'Time format constraint added successfully';
  ELSE
    RAISE NOTICE 'Time format constraint already exists';
  END IF;
END $$;

-- Verification query (optional - run this to verify the migration)
-- SELECT 
--   column_name, 
--   data_type, 
--   column_default,
--   is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'collection_schedules' 
-- AND column_name = 'collection_time';

