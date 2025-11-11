-- ========================================
-- Fix: Upload QRIS Image URL
-- ========================================
-- Instruksi:
-- 1. Buka Supabase Storage
-- 2. Create bucket "qris" (public)
-- 3. Upload QRIS image (outlet-qris.png)
-- 4. Copy URL
-- 5. Update query di bawah dengan URL tersebut
-- ========================================

-- Update QRIS image URL
UPDATE locations
SET qris_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/qris/outlet-lobby-a-qris.png'
WHERE qr_code = 'outlet_lobby_a';

-- Verify
SELECT 
    name,
    qr_code,
    qris_image_url
FROM locations
WHERE type = 'OUTLET';
