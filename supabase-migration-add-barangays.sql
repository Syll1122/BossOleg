-- Migration: Add barangays reference table
-- Run this in Supabase Dashboard → SQL Editor

-- ==========================================
-- TABLE: barangays
-- Reference table for Quezon City barangays
-- ==========================================
CREATE TABLE IF NOT EXISTS barangays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE, -- Optional: official barangay code
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_barangays_name ON barangays(name);

-- Enable RLS
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;

-- Allow all access to barangays (public reference data)
CREATE POLICY "Allow all access to barangays" ON barangays
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Insert Quezon City Barangays
-- ==========================================
-- Quezon City has 142 barangays. Here are the most common ones:

INSERT INTO barangays (id, name, code) VALUES
  ('bg001', 'Bagong Silangan', NULL),
  ('bg002', 'Bagong Pag-asa', NULL),
  ('bg003', 'Bago Bantay', NULL),
  ('bg004', 'Bahay Toro', NULL),
  ('bg005', 'Balingasa', NULL),
  ('bg006', 'Balong-Bato', NULL),
  ('bg007', 'Batal', NULL),
  ('bg008', 'Batasan Hills', NULL),
  ('bg009', 'Bayani', NULL),
  ('bg010', 'Blue Ridge A', NULL),
  ('bg011', 'Blue Ridge B', NULL),
  ('bg012', 'Botocan', NULL),
  ('bg013', 'Commonwealth', NULL),
  ('bg014', 'Culiat', NULL),
  ('bg015', 'Damar', NULL),
  ('bg016', 'Damayan', NULL),
  ('bg017', 'Damayang Lagi', NULL),
  ('bg018', 'Diliman', NULL),
  ('bg019', 'Don Manuel', NULL),
  ('bg020', 'Doña Aurora', NULL),
  ('bg021', 'Doña Imelda', NULL),
  ('bg022', 'Doña Josefa', NULL),
  ('bg023', 'Duyan-Duyan', NULL),
  ('bg024', 'E. Rodriguez', NULL),
  ('bg025', 'East Kamias', NULL),
  ('bg026', 'Escopa I', NULL),
  ('bg027', 'Escopa II', NULL),
  ('bg028', 'Escopa III', NULL),
  ('bg029', 'Escopa IV', NULL),
  ('bg030', 'Fairview', NULL),
  ('bg031', 'Greater Lagro', NULL),
  ('bg032', 'Gulod', NULL),
  ('bg033', 'Holy Spirit', NULL),
  ('bg034', 'Horseshoe', NULL),
  ('bg035', 'Immaculate Concepcion', NULL),
  ('bg036', 'Kaligayahan', NULL),
  ('bg037', 'Kalusugan', NULL),
  ('bg038', 'Kamuning', NULL),
  ('bg039', 'Katipunan', NULL),
  ('bg040', 'Kaunlaran', NULL),
  ('bg041', 'Kristong Hari', NULL),
  ('bg042', 'Krus na Ligas', NULL),
  ('bg043', 'Laging Handa', NULL),
  ('bg044', 'Libis', NULL),
  ('bg045', 'Lourdes', NULL),
  ('bg046', 'Loyola Heights', NULL),
  ('bg047', 'Maharlika', NULL),
  ('bg048', 'Malaya', NULL),
  ('bg049', 'Mariblo', NULL),
  ('bg050', 'Marilag', NULL),
  ('bg051', 'Masagana', NULL),
  ('bg052', 'Matandang Balara', NULL),
  ('bg053', 'Milagrosa', NULL),
  ('bg054', 'Nagkaisang Nayon', NULL),
  ('bg055', 'Nayon Kaunlaran', NULL),
  ('bg056', 'New Era', NULL),
  ('bg057', 'North Fairview', NULL),
  ('bg058', 'Novaliches Proper', NULL),
  ('bg059', 'N.S. Amoranto', NULL),
  ('bg060', 'Obrero', NULL),
  ('bg061', 'Old Capitol Site', NULL),
  ('bg062', 'Paang Bundok', NULL),
  ('bg063', 'Pag-ibig sa Nayon', NULL),
  ('bg064', 'Paligsahan', NULL),
  ('bg065', 'Paltok', NULL),
  ('bg066', 'Pansol', NULL),
  ('bg067', 'Paraiso', NULL),
  ('bg068', 'Pasong Putik Proper', NULL),
  ('bg069', 'Pasong Tamo', NULL),
  ('bg070', 'Payatas', NULL),
  ('bg071', 'Phil-Am', NULL),
  ('bg072', 'Pinyahan', NULL),
  ('bg073', 'Project 6', NULL),
  ('bg074', 'Quirino 2-A', NULL),
  ('bg075', 'Quirino 2-B', NULL),
  ('bg076', 'Quirino 2-C', NULL),
  ('bg077', 'Quirino 3-A', NULL),
  ('bg078', 'Roxas', NULL),
  ('bg079', 'Sacred Heart', NULL),
  ('bg080', 'Salvacion', NULL),
  ('bg081', 'San Agustin', NULL),
  ('bg082', 'San Antonio', NULL),
  ('bg083', 'San Bartolome', NULL),
  ('bg084', 'San Isidro', NULL),
  ('bg085', 'San Isidro Labrador', NULL),
  ('bg086', 'San Jose', NULL),
  ('bg087', 'San Roque', NULL),
  ('bg088', 'San Vicente', NULL),
  ('bg089', 'Santa Cruz', NULL),
  ('bg090', 'Santa Lucia', NULL),
  ('bg091', 'Santa Monica', NULL),
  ('bg092', 'Santa Teresita', NULL),
  ('bg093', 'Santo Cristo', NULL),
  ('bg094', 'Santo Domingo', NULL),
  ('bg095', 'Santo Niño', NULL),
  ('bg096', 'Santol', NULL),
  ('bg097', 'Sauyo', NULL),
  ('bg098', 'Sikatuna Village', NULL),
  ('bg099', 'Silangan', NULL),
  ('bg100', 'Socorro', NULL),
  ('bg101', 'South Triangle', NULL),
  ('bg102', 'St. Ignatius', NULL),
  ('bg103', 'St. Peter', NULL),
  ('bg104', 'Tagumpay', NULL),
  ('bg105', 'Talayan', NULL),
  ('bg106', 'Talipapa', NULL),
  ('bg107', 'Tandang Sora', NULL),
  ('bg108', 'Tatalon', NULL),
  ('bg109', 'Teachers Village East', NULL),
  ('bg110', 'Teachers Village West', NULL),
  ('bg111', 'Ugong Norte', NULL),
  ('bg112', 'Unang Sigaw', NULL),
  ('bg113', 'University Hills', NULL),
  ('bg114', 'Valencia', NULL),
  ('bg115', 'Vasra', NULL),
  ('bg116', 'Veterans Village', NULL),
  ('bg117', 'Villa Maria Clara', NULL),
  ('bg118', 'West Kamias', NULL),
  ('bg119', 'West Triangle', NULL),
  ('bg120', 'White Plains', NULL)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- DONE! ✅
-- ==========================================
-- After running this:
-- 1. Go to Supabase Dashboard → Table Editor → barangays
-- 2. Verify the table has all barangay entries
--
-- You can query all barangays with:
-- SELECT * FROM barangays ORDER BY name;
