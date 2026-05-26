-- Migration 045: Add admin_role column to profiles table
-- Enables role-based access control for admin sub-roles
-- Roles: MANAGER (all access), PRODUCT (products), MITRA (supplier approval), FINANCE (finance/reports)

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS admin_role TEXT 
  CHECK (admin_role IN ('MANAGER', 'PRODUCT', 'MITRA', 'FINANCE'));

COMMENT ON COLUMN profiles.admin_role IS 
  'Sub-role for ADMIN users: MANAGER=all access, PRODUCT=product management, MITRA=supplier/partner approval, FINANCE=finance & reports. NULL = legacy admin (treated as MANAGER).';

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_admin_role ON profiles(admin_role) WHERE role = 'ADMIN';
