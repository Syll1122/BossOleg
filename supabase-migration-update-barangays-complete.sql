-- Migration: Update barangays table with complete list from SignUpPage.tsx
-- Run this in Supabase Dashboard → SQL Editor
-- This will add any missing barangays from your SignUpPage

-- ==========================================
-- Insert/Update All Barangays from SignUpPage
-- Uses ON CONFLICT to avoid duplicates (based on name)
-- ==========================================

INSERT INTO barangays (id, name, code) VALUES
  -- A
  ('bg_001', 'Alicia', NULL),
  ('bg_002', 'Amihan', NULL),
  ('bg_003', 'Apollo', NULL),
  
  -- B
  ('bg_004', 'Bagong Lipunan ng Crame', NULL),
  ('bg_005', 'Bagong Pag-asa', NULL),
  ('bg_006', 'Bagong Silangan', NULL),
  ('bg_007', 'Bagumbayan', NULL),
  ('bg_008', 'Bahay Toro', NULL),
  ('bg_009', 'Balingasa', NULL),
  ('bg_010', 'Balong Bato', NULL),
  ('bg_011', 'Balong-Bato', NULL), -- Alternative spelling
  ('bg_012', 'Batasan Hills', NULL),
  ('bg_013', 'Bayani', NULL),
  ('bg_014', 'Blue Ridge A', NULL),
  ('bg_015', 'Blue Ridge B', NULL),
  ('bg_016', 'Botocan', NULL),
  ('bg_017', 'Bungad', NULL),
  
  -- C
  ('bg_018', 'Camp Aguinaldo', NULL),
  ('bg_019', 'Capri', NULL),
  ('bg_020', 'Central', NULL),
  ('bg_021', 'Claro', NULL),
  ('bg_022', 'Commonwealth', NULL),
  ('bg_023', 'Culiat', NULL),
  
  -- D
  ('bg_024', 'Damar', NULL),
  ('bg_025', 'Damayan', NULL),
  ('bg_026', 'Damayang Lagi', NULL),
  ('bg_027', 'Del Monte', NULL),
  ('bg_028', 'Dioquino Zobel', NULL),
  ('bg_029', 'Don Manuel', NULL),
  ('bg_030', 'Doña Aurora', NULL),
  ('bg_031', 'Doña Imelda', NULL),
  ('bg_032', 'Doña Josefa', NULL),
  ('bg_033', 'Duyan-Duyan', NULL),
  
  -- E
  ('bg_034', 'E. Rodriguez', NULL),
  ('bg_035', 'East Kamias', NULL),
  ('bg_036', 'Escopa I', NULL),
  ('bg_037', 'Escopa II', NULL),
  ('bg_038', 'Escopa III', NULL),
  ('bg_039', 'Escopa IV', NULL),
  
  -- F-G
  ('bg_040', 'Fairview', NULL),
  ('bg_041', 'Greater Lagro', NULL),
  ('bg_042', 'Gulod', NULL),
  
  -- H
  ('bg_043', 'Holy Spirit', NULL),
  ('bg_044', 'Horseshoe', NULL),
  
  -- I
  ('bg_045', 'Immaculate Concepcion', NULL),
  ('bg_046', 'Immaculate Conception', NULL), -- Alternative spelling
  
  -- K
  ('bg_047', 'Kaligayahan', NULL),
  ('bg_048', 'Kalusugan', NULL),
  ('bg_049', 'Kamias', NULL),
  ('bg_050', 'Kamuning', NULL),
  ('bg_051', 'Katipunan', NULL),
  ('bg_052', 'Kaunlaran', NULL),
  ('bg_053', 'Kristong Hari', NULL),
  ('bg_054', 'Krus na Ligas', NULL),
  
  -- L
  ('bg_055', 'Laging Handa', NULL),
  ('bg_056', 'Libis', NULL),
  ('bg_057', 'Lourdes', NULL),
  ('bg_058', 'Loyola Heights', NULL),
  
  -- M
  ('bg_059', 'Maharlika', NULL),
  ('bg_060', 'Malaya', NULL),
  ('bg_061', 'Mangga', NULL),
  ('bg_062', 'Manresa', NULL),
  ('bg_063', 'Mariblo', NULL),
  ('bg_064', 'Marilag', NULL),
  ('bg_065', 'Masagana', NULL),
  ('bg_066', 'Masambong', NULL),
  ('bg_067', 'Matandang Balara', NULL),
  ('bg_068', 'Milagrosa', NULL),
  
  -- N
  ('bg_069', 'N. S. Amoranto', NULL),
  ('bg_070', 'N.S. Amoranto', NULL), -- Alternative spelling
  ('bg_071', 'Nagkaisang Nayon', NULL),
  ('bg_072', 'Nayong Kanluran', NULL),
  ('bg_073', 'New Era', NULL),
  ('bg_074', 'North Fairview', NULL),
  ('bg_075', 'Novaliches Proper', NULL),
  
  -- O
  ('bg_076', 'Obrero', NULL),
  ('bg_077', 'Old Balara', NULL),
  ('bg_078', 'Old Capitol Site', NULL),
  
  -- P
  ('bg_079', 'Paang Bundok', NULL),
  ('bg_080', 'Pag-Ibig sa Nayon', NULL),
  ('bg_081', 'Pag-ibig sa Nayon', NULL), -- Alternative spelling
  ('bg_082', 'Paligsahan', NULL),
  ('bg_083', 'Paltok', NULL),
  ('bg_084', 'Pansol', NULL),
  ('bg_085', 'Paraiso', NULL),
  ('bg_086', 'Pasong Putik Proper', NULL),
  ('bg_087', 'Pasong Tamo', NULL),
  ('bg_088', 'Payatas', NULL),
  ('bg_089', 'Phil-Am', NULL),
  ('bg_090', 'Pinyahan', NULL),
  ('bg_091', 'Project 6', NULL),
  
  -- Q
  ('bg_092', 'Quirino 2-A', NULL),
  ('bg_093', 'Quirino 2-B', NULL),
  ('bg_094', 'Quirino 2-C', NULL),
  ('bg_095', 'Quirino 3-A', NULL),
  
  -- R
  ('bg_096', 'Ramon Magsaysay', NULL),
  ('bg_097', 'Roxas', NULL),
  
  -- S
  ('bg_098', 'Sacred Heart', NULL),
  ('bg_099', 'Saint Ignatius', NULL),
  ('bg_100', 'St. Ignatius', NULL), -- Alternative spelling
  ('bg_101', 'Saint Peter', NULL),
  ('bg_102', 'St. Peter', NULL), -- Alternative spelling
  ('bg_103', 'Salvacion', NULL),
  ('bg_104', 'San Agustin', NULL),
  ('bg_105', 'San Antonio', NULL),
  ('bg_106', 'San Bartolome', NULL),
  ('bg_107', 'San Isidro', NULL),
  ('bg_108', 'San Isidro Labrador', NULL),
  ('bg_109', 'San Jose', NULL),
  ('bg_110', 'San Martin de Porres', NULL),
  ('bg_111', 'San Roque', NULL),
  ('bg_112', 'San Vicente', NULL),
  ('bg_113', 'Santa Cruz', NULL),
  ('bg_114', 'Santa Lucia', NULL),
  ('bg_115', 'Santa Monica', NULL),
  ('bg_116', 'Santa Teresita', NULL),
  ('bg_117', 'Santo Cristo', NULL),
  ('bg_118', 'Santo Domingo', NULL),
  ('bg_119', 'Santo Niño', NULL),
  ('bg_120', 'Santol', NULL),
  ('bg_121', 'Sauyo', NULL),
  ('bg_122', 'Sienna', NULL),
  ('bg_123', 'Sikatuna Village', NULL),
  ('bg_124', 'Silangan', NULL),
  ('bg_125', 'Socorro', NULL),
  ('bg_126', 'South Triangle', NULL),
  
  -- T
  ('bg_127', 'Tagumpay', NULL),
  ('bg_128', 'Talampas', NULL),
  ('bg_129', 'Talayan', NULL),
  ('bg_130', 'Talipapa', NULL),
  ('bg_131', 'Tandang Sora', NULL),
  ('bg_132', 'Tatalon', NULL),
  ('bg_133', 'Teachers Village East', NULL),
  ('bg_134', 'Teachers Village West', NULL),
  
  -- U
  ('bg_135', 'Ugong Norte', NULL),
  ('bg_136', 'Unang Sigaw', NULL),
  ('bg_137', 'University Hills', NULL),
  ('bg_138', 'University of the Philippines Campus', NULL),
  ('bg_139', 'UP Campus', NULL),
  
  -- V
  ('bg_140', 'Valencia', NULL),
  ('bg_141', 'Vasra', NULL),
  ('bg_142', 'Veterans Village', NULL),
  ('bg_143', 'Villa Maria Clara', NULL),
  
  -- W
  ('bg_144', 'West Kamias', NULL),
  ('bg_145', 'West Triangle', NULL),
  ('bg_146', 'White Plains', NULL)
ON CONFLICT (name) DO NOTHING; -- Prevents duplicates based on name

-- ==========================================
-- Optional: Clean up any duplicate entries
-- ==========================================
-- Remove duplicates where name is the same but id is different
-- (Keep the one with the lower id)
DELETE FROM barangays a
USING barangays b
WHERE a.name = b.name
  AND a.id > b.id;

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. Go to Supabase Dashboard → Table Editor → barangays
-- 2. Verify the table has all barangay entries from SignUpPage
-- 3. Check count: SELECT COUNT(*) FROM barangays;
--
-- The query will:
-- ✅ Add all barangays from SignUpPage.tsx
-- ✅ Skip duplicates (based on name)
-- ✅ Remove any duplicate entries


