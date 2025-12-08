-- Migration: Add barangay column to accounts table
-- Run this in Supabase Dashboard → SQL Editor
-- This fixes the error: "Could not find the 'barangay' column of 'accounts' in the schema cache"

-- ==========================================
-- Add barangay column to accounts table
-- ==========================================
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS barangay TEXT;

-- ==========================================
-- Create index for faster barangay lookups (optional but recommended)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_accounts_barangay ON accounts(barangay);

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. The error should be fixed
-- 2. Go to Supabase Dashboard → Table Editor → accounts
-- 3. Verify the table now has a "barangay" column
--
-- The column will:
-- ✅ Store the barangay name selected during signup
-- ✅ Allow filtering/searching users by barangay
-- ✅ Support queries like: SELECT * FROM accounts WHERE barangay = 'Holy Spirit'


