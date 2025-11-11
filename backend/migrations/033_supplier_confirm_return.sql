-- Migration: 033_supplier_confirm_return.sql
-- Purpose: Add supplier confirmation timestamp and function to mark return as COMPLETED

BEGIN;

-- Add column to track when supplier confirms receipt of returned goods
ALTER TABLE IF EXISTS public.shipment_returns
  ADD COLUMN IF NOT EXISTS supplier_received_at TIMESTAMPTZ;

-- Function: confirm_return_received_by_supplier
-- Allows an authenticated supplier to mark an APPROVED return as COMPLETED
CREATE OR REPLACE FUNCTION public.confirm_return_received_by_supplier(
  p_return_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID := auth.uid();
  v_supplier_id UUID;
  v_row public.shipment_returns;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.id INTO v_supplier_id
  FROM public.suppliers s
  WHERE s.profile_id = v_profile_id;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier profile not found';
  END IF;

  SELECT * INTO v_row
  FROM public.shipment_returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return not found';
  END IF;

  IF v_row.supplier_id IS DISTINCT FROM v_supplier_id THEN
    RAISE EXCEPTION 'Forbidden: return does not belong to supplier';
  END IF;

  IF v_row.status NOT IN ('APPROVED') THEN
    RAISE EXCEPTION 'Invalid status transition: %', v_row.status;
  END IF;

  UPDATE public.shipment_returns
  SET status = 'COMPLETED',
      supplier_received_at = NOW(),
      updated_at = NOW()
  WHERE id = p_return_id;

  -- Optional: activity log if table exists
  BEGIN
    PERFORM 1 FROM public.activity_logs LIMIT 1;
    INSERT INTO public.activity_logs(entity_type, entity_id, action, details, created_at)
    VALUES ('shipment_return', p_return_id, 'SUPPLIER_CONFIRM_RECEIVED', jsonb_build_object('supplier_id', v_supplier_id), NOW());
  EXCEPTION WHEN undefined_table THEN
    -- ignore if activity_logs does not exist
    NULL;
  END;
END;
$$;

-- Grant execute to authenticated users so suppliers can call it via RPC
GRANT EXECUTE ON FUNCTION public.confirm_return_received_by_supplier(UUID) TO authenticated;

COMMIT;

-- Verification (optional):
-- SELECT 'SUCCESS: 033 supplier confirm return applied' AS status;
