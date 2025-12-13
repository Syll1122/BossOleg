-- SQL Migration: Registration Approval System
-- Run this in your Supabase Dashboard → SQL Editor

-- Create registration_history table to track approval/rejection actions
CREATE TABLE IF NOT EXISTS registration_history (
  id TEXT PRIMARY KEY,
  "collectorId" TEXT NOT NULL, -- Removed foreign key to allow history to persist after account deletion
  "collectorName" TEXT NOT NULL,
  "collectorEmail" TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'deleted')),
  "reviewedBy" TEXT, -- Made nullable and removed foreign key constraint
  "reviewedByName" TEXT NOT NULL,
  "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_registration_history_collectorid ON registration_history("collectorId");
CREATE INDEX IF NOT EXISTS idx_registration_history_status ON registration_history(status);
CREATE INDEX IF NOT EXISTS idx_registration_history_reviewedat ON registration_history("reviewedAt");

-- Enable RLS
ALTER TABLE registration_history ENABLE ROW LEVEL SECURITY;

-- Allow all access (admin panel uses anon key)
CREATE POLICY "Allow all access to registration_history" ON registration_history
  FOR ALL USING (true) WITH CHECK (true);

-- Update existing collector accounts to have pending status if not set
UPDATE accounts
SET "registrationStatus" = 'pending'
WHERE role = 'collector' 
  AND ("registrationStatus" IS NULL OR "registrationStatus" = '');

-- Set existing collectors to approved (for accounts that were created before this system)
-- Comment this out if you want all existing collectors to be pending
-- UPDATE accounts
-- SET "registrationStatus" = 'approved'
-- WHERE role = 'collector' AND "registrationStatus" = 'pending';

