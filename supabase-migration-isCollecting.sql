-- Migration: Add isCollecting column to truck_status table
-- Run this in your Supabase Dashboard → SQL Editor if you already have the truck_status table

-- Add isCollecting column if it doesn't exist
ALTER TABLE truck_status 
ADD COLUMN IF NOT EXISTS "isCollecting" BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing records to set isCollecting = false (they're not collecting by default)
UPDATE truck_status 
SET "isCollecting" = FALSE 
WHERE "isCollecting" IS NULL;

