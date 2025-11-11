-- ========================================
-- UPDATE: Add QRIS to Locations
-- ========================================
-- Description: Add QR code frame column and update images
-- Execute: After migration 009 completed
-- ========================================

-- Step 1: Add column for QR code frame image
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS qr_code_image_url TEXT;

COMMENT ON COLUMN locations.qr_code_image_url IS 'URL to QR code frame (printed at outlet entrance)';

-- Step 2: Update Outlet Lobby A with both QRIS payment and QR code frame
UPDATE locations
SET 
  qris_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/sign/assets/QRIS.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83N2JmY2YxNy0xOTgyLTQ1YWMtYWFhNy1hNTlhY2Y0MmRlYTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvUVJJUy5qcGciLCJpYXQiOjE3NjI3ODg2MDAsImV4cCI6MTc5NDMyNDYwMH0.Pf6v-K9ktBPYWxRxTRri77025OJD-bXLYm3cnwRPf6Q',
  qr_code_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/sign/assets/frame.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83N2JmY2YxNy0xOTgyLTQ1YWMtYWFhNy1hNTlhY2Y0MmRlYTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvZnJhbWUucG5nIiwiaWF0IjoxNzYyNzg5MzYxLCJleHAiOjE3OTQzMjUzNjF9.ho5dBCjXZhf1MHv1G3jV6wWfIklci3q5Kl9GRt69OAM'
WHERE qr_code = 'outlet_lobby_a';

-- For other outlets (if any), set QRIS payment only
UPDATE locations
SET qris_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/sign/assets/QRIS.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83N2JmY2YxNy0xOTgyLTQ1YWMtYWFhNy1hNTlhY2Y0MmRlYTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvUVJJUy5qcGciLCJpYXQiOjE3NjI3ODg2MDAsImV4cCI6MTc5NDMyNDYwMH0.Pf6v-K9ktBPYWxRxTRri77025OJD-bXLYm3cnwRPf6Q'
WHERE type = 'OUTLET' 
  AND is_active = TRUE
  AND qr_code != 'outlet_lobby_a';

-- Verify update
SELECT 
    id,
    name,
    qr_code,
    qr_code_image_url,
    qris_image_url,
    is_active
FROM locations
WHERE type = 'OUTLET'
ORDER BY name;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'QRIS payment and QR code images updated!' AS status;

-- ========================================
-- NOTES
-- ========================================
/*
qr_code_image_url = Frame PNG untuk ditempel di outlet (customer scan ini)
qris_image_url = QRIS untuk pembayaran (muncul setelah checkout)
*/
