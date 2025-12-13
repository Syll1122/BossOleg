-- SQL Migration: Collection Schedules System
-- Run this in your Supabase Dashboard → SQL Editor

-- Create collection_schedules table
CREATE TABLE IF NOT EXISTS collection_schedules (
  id TEXT PRIMARY KEY,
  "collectorId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "collectorName" TEXT NOT NULL,
  "truckNo" TEXT,
  barangay TEXT NOT NULL,
  streets TEXT[], -- Array of street names
  days TEXT[] NOT NULL, -- Array of day abbreviations: ['Mon', 'Tue', 'Wed', etc.]
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_collection_schedules_collectorid ON collection_schedules("collectorId");
CREATE INDEX IF NOT EXISTS idx_collection_schedules_barangay ON collection_schedules(barangay);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_days ON collection_schedules USING GIN(days);

-- Enable RLS
ALTER TABLE collection_schedules ENABLE ROW LEVEL SECURITY;

-- Allow all access (admin panel uses anon key)
CREATE POLICY "Allow all access to collection_schedules" ON collection_schedules
  FOR ALL USING (true) WITH CHECK (true);

-- Add latitude and longitude columns to barangays table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'barangays' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE barangays ADD COLUMN latitude DECIMAL(10, 8);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'barangays' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE barangays ADD COLUMN longitude DECIMAL(11, 8);
  END IF;
END $$;

