-- Migration: 031_create_shipment_returns.sql
-- Purpose: Create tables for shipment returns and necessary RLS policies
-- Run this in Supabase SQL editor or via supabase CLI

BEGIN;

-- Create shipment_returns (header)
CREATE TABLE IF NOT EXISTS public.shipment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, COMPLETED
  requested_by UUID REFERENCES public.profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shipment_return_items (details)
CREATE TABLE IF NOT EXISTS public.shipment_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.shipment_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipment_returns_supplier ON public.shipment_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_status ON public.shipment_returns(status);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_reviewed_at ON public.shipment_returns(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_shipment_return_items_return ON public.shipment_return_items(return_id);

-- Enable RLS
ALTER TABLE public.shipment_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_return_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipment_returns
-- Suppliers can read their own returns
DROP POLICY IF EXISTS "shipment_returns_supplier_read" ON public.shipment_returns;
CREATE POLICY "shipment_returns_supplier_read"
ON public.shipment_returns FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM public.suppliers
    WHERE profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Suppliers can create returns (INSERT) for their supplier_id
DROP POLICY IF EXISTS "shipment_returns_supplier_insert" ON public.shipment_returns;
CREATE POLICY "shipment_returns_supplier_insert"
ON public.shipment_returns FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM public.suppliers
    WHERE profile_id = auth.uid()
  )
);

-- Admins can do everything
DROP POLICY IF EXISTS "shipment_returns_admin_all" ON public.shipment_returns;
CREATE POLICY "shipment_returns_admin_all"
ON public.shipment_returns FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- RLS policies for shipment_return_items
-- Suppliers can read items that belong to their returns
DROP POLICY IF EXISTS "shipment_return_items_supplier_read" ON public.shipment_return_items;
CREATE POLICY "shipment_return_items_supplier_read"
ON public.shipment_return_items FOR SELECT
TO authenticated
USING (
  return_id IN (
    SELECT id FROM public.shipment_returns
    WHERE supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE profile_id = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Suppliers can insert items only for returns that belong to them
DROP POLICY IF EXISTS "shipment_return_items_supplier_insert" ON public.shipment_return_items;
CREATE POLICY "shipment_return_items_supplier_insert"
ON public.shipment_return_items FOR INSERT
TO authenticated
WITH CHECK (
  return_id IN (
    SELECT id FROM public.shipment_returns
    WHERE supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE profile_id = auth.uid()
    )
  )
);

-- Admins can do everything on items
DROP POLICY IF EXISTS "shipment_return_items_admin_all" ON public.shipment_return_items;
CREATE POLICY "shipment_return_items_admin_all"
ON public.shipment_return_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

COMMIT;

-- Verification: check tables and policies
SELECT table_name FROM information_schema.tables WHERE table_name IN ('shipment_returns','shipment_return_items');

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('shipment_returns','shipment_return_items')
ORDER BY tablename, policyname;

SELECT 'SUCCESS: shipment_returns migration applied (or already existed)' AS status;
