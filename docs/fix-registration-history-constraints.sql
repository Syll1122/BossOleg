-- Fix Registration History Table Constraints
-- This allows history entries to persist even after account deletion
-- Run this in your Supabase Dashboard → SQL Editor

-- Drop the foreign key constraint on collectorId if it exists
ALTER TABLE registration_history 
  DROP CONSTRAINT IF EXISTS registration_history_collectorId_fkey;

-- Drop the foreign key constraint on reviewedBy if it exists
ALTER TABLE registration_history 
  DROP CONSTRAINT IF EXISTS registration_history_reviewedBy_fkey;

-- Update the status check constraint to include 'deleted'
ALTER TABLE registration_history 
  DROP CONSTRAINT IF EXISTS registration_history_status_check;

ALTER TABLE registration_history 
  ADD CONSTRAINT registration_history_status_check 
  CHECK (status IN ('approved', 'rejected', 'deleted'));

-- Make reviewedBy nullable (in case the reviewer account is deleted)
ALTER TABLE registration_history 
  ALTER COLUMN "reviewedBy" DROP NOT NULL;







