-- ============================================================================
-- ADD LOGIN STATUS TRACKING TO ACCOUNTS TABLE
-- ============================================================================
-- This adds login status tracking columns to track if users are currently logged in
-- Matches existing camelCase column naming convention (createdAt, updatedAt, etc.)
-- ============================================================================

-- Add isOnline column to accounts table (using camelCase to match existing columns)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT FALSE;

-- Add lastLoginAt to track when user last logged in
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

-- Add lastLogoutAt to track when user last logged out
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS "lastLogoutAt" TIMESTAMPTZ;

-- Create indexes for faster queries of online users
CREATE INDEX IF NOT EXISTS idx_accounts_is_online ON public.accounts("isOnline");
CREATE INDEX IF NOT EXISTS idx_accounts_last_login ON public.accounts("lastLoginAt");

-- Verify columns were added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'accounts'
AND column_name IN ('isOnline', 'lastLoginAt', 'lastLogoutAt')
ORDER BY column_name;

SELECT '✅ Login status columns added to accounts table!' as status;
SELECT 'Users will now be tracked as online/offline in the database' as note;
