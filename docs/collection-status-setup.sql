-- SQL Migration: Collection Status Tracking System
-- Run this in your Supabase Dashboard → SQL Editor

-- Create collection_status table
CREATE TABLE IF NOT EXISTS collection_status (
  id TEXT PRIMARY KEY,
  "collectorId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "truckNo" TEXT NOT NULL,
  street TEXT NOT NULL,
  barangay TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'collected')),
  "collectionDate" DATE NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("collectorId", "truckNo", street, barangay, "collectionDate")
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_collection_status_collectorid ON collection_status("collectorId");
CREATE INDEX IF NOT EXISTS idx_collection_status_date ON collection_status("collectionDate");
CREATE INDEX IF NOT EXISTS idx_collection_status_status ON collection_status(status);

-- Enable RLS
ALTER TABLE collection_status ENABLE ROW LEVEL SECURITY;

-- Allow all access (admin panel uses anon key)
CREATE POLICY "Allow all access to collection_status" ON collection_status
  FOR ALL USING (true) WITH CHECK (true);

