-- Create trucks table to manage available truck numbers
-- Run this ONCE in Supabase Dashboard → SQL Editor

-- ==========================================
-- TABLE: trucks
-- ==========================================
CREATE TABLE IF NOT EXISTS trucks (
  id TEXT PRIMARY KEY,
  "truckNo" TEXT UNIQUE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trucks_truckno ON trucks("truckNo");
CREATE INDEX IF NOT EXISTS idx_trucks_isactive ON trucks("isActive");

-- Insert initial truck numbers (adjust as needed)
INSERT INTO trucks (id, "truckNo", "isActive") VALUES
  ('truck-1', 'BCG 12*5', TRUE),
  ('truck-2', 'BCG 13*6', TRUE),
  ('truck-3', 'BCG 14*7', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. Go to Supabase Dashboard → Table Editor → trucks
-- 2. Verify the table has the truck numbers
-- 3. You can add more trucks via the admin interface or SQL

