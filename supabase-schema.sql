-- Supabase Schema for WatchApp
-- Run this SQL in your Supabase Dashboard → SQL Editor

-- ==========================================
-- TABLE: accounts
-- ==========================================
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('resident', 'collector', 'admin')),
  "truckNo" TEXT UNIQUE,
  address TEXT,
  "phoneNumber" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
CREATE INDEX IF NOT EXISTS idx_accounts_truckno ON accounts("truckNo");

-- ==========================================
-- TABLE: reports
-- ==========================================
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "reportType" TEXT NOT NULL CHECK ("reportType" IN ('select', 'type')),
  issue TEXT NOT NULL,
  barangay TEXT NOT NULL,
  "truckNo" TEXT NOT NULL,
  "collectorId" TEXT REFERENCES accounts(id) ON DELETE SET NULL, -- Direct link to collector
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_userid ON reports("userId");
CREATE INDEX IF NOT EXISTS idx_reports_collectorid ON reports("collectorId");
CREATE INDEX IF NOT EXISTS idx_reports_truckno ON reports("truckNo");
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_createdat ON reports("createdAt");

-- ==========================================
-- TABLE: truck_status
-- ==========================================
CREATE TABLE IF NOT EXISTS truck_status (
  id TEXT PRIMARY KEY,
  "isFull" BOOLEAN NOT NULL DEFAULT FALSE,
  "isCollecting" BOOLEAN NOT NULL DEFAULT FALSE,
  latitude DOUBLE PRECISION, -- GPS latitude
  longitude DOUBLE PRECISION, -- GPS longitude
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_truck_status_updatedat ON truck_status("updatedAt");

-- ==========================================
-- Row Level Security (RLS) Policies
-- Enable RLS for security (optional but recommended)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_status ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can customize these later)
-- For accounts table
CREATE POLICY "Allow all access to accounts" ON accounts
  FOR ALL USING (true) WITH CHECK (true);

-- For reports table
CREATE POLICY "Allow all access to reports" ON reports
  FOR ALL USING (true) WITH CHECK (true);

-- For truck_status table
CREATE POLICY "Allow all access to truck_status" ON truck_status
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- DONE!
-- ==========================================
-- After running this SQL:
-- 1. Go to your Supabase Dashboard → Table Editor to verify tables were created
-- 2. Update your .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
-- 3. Switch your app to use database-supabase.ts instead of database.ts

