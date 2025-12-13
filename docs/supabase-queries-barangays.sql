-- Useful Queries for Barangays
-- Use these in Supabase Dashboard → SQL Editor or in your app

-- ==========================================
-- Get all barangays (alphabetically sorted)
-- ==========================================
SELECT id, name, code 
FROM barangays 
ORDER BY name ASC;

-- ==========================================
-- Get all barangays as a simple list (for dropdowns)
-- ==========================================
SELECT name 
FROM barangays 
ORDER BY name ASC;

-- ==========================================
-- Count total barangays
-- ==========================================
SELECT COUNT(*) as total_barangays FROM barangays;

-- ==========================================
-- Search barangay by name (partial match)
-- ==========================================
SELECT * FROM barangays 
WHERE LOWER(name) LIKE LOWER('%holy%')  -- Example: search for "Holy Spirit"
ORDER BY name;

-- ==========================================
-- Get barangays with most residents (if you want to add statistics later)
-- ==========================================
-- This query will work once you have accounts with barangay data:
-- SELECT 
--   b.name as barangay_name,
--   COUNT(a.id) as resident_count
-- FROM barangays b
-- LEFT JOIN accounts a ON a.barangay = b.name
-- WHERE a.role = 'resident'
-- GROUP BY b.id, b.name
-- ORDER BY resident_count DESC;


