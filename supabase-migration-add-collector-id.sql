-- Migration: Add direct collector connection to reports table
-- Run this in Supabase Dashboard → SQL Editor

-- Add collectorId column to reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS "collectorId" TEXT REFERENCES accounts(id) ON DELETE SET NULL;

-- Create index for faster queries by collector
CREATE INDEX IF NOT EXISTS idx_reports_collectorid ON reports("collectorId");

-- Create index for truckNo lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_reports_truckno ON reports("truckNo");

-- Optional: Populate collectorId from truckNo for existing reports
-- This finds the collector account that owns the truck number
UPDATE reports r
SET "collectorId" = (
  SELECT a.id 
  FROM accounts a 
  WHERE a."truckNo" = r."truckNo" 
  AND a.role = 'collector' 
  LIMIT 1
)
WHERE "collectorId" IS NULL;

-- ==========================================
-- DONE!
-- ==========================================
-- Now you can:
-- 1. Query reports by collector: SELECT * FROM reports WHERE "collectorId" = '...'
-- 2. Join reports with collector accounts directly
-- 3. Get all residents who reported a specific collector
-- 
-- Note: Both truckNo and collectorId are maintained for backward compatibility


